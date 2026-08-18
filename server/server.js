import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --------------------------------------------------
// Local Windows Deno
// --------------------------------------------------

const localDenoPath =
  "C:\\Users\\udayv\\AppData\\Local\\Microsoft\\WinGet\\Packages\\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\\deno.exe";

// --------------------------------------------------
// Platform commands
// --------------------------------------------------

const pythonCommand =
  process.platform === "win32"
    ? "py"
    : "python3";

// --------------------------------------------------
// Allowed hosts
// --------------------------------------------------

const allowedHosts = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "instagram.com",
  "www.instagram.com"
];

// --------------------------------------------------
// Detect platform
// --------------------------------------------------

function getPlatform(value) {
  try {
    const url = new URL(value);

    const hostname = url.hostname.toLowerCase();

    if (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "youtu.be"
    ) {
      return "youtube";
    }

    if (
      hostname === "instagram.com" ||
      hostname === "www.instagram.com"
    ) {
      return "instagram";
    }

    return null;
  } catch {
    return null;
  }
}

// --------------------------------------------------
// Validate URL
// --------------------------------------------------

function isAllowedUrl(value) {
  try {
    const url = new URL(value);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      allowedHosts.some(
        (host) =>
          url.hostname === host ||
          url.hostname.endsWith("." + host)
      )
    );
  } catch {
    return false;
  }
}

// --------------------------------------------------
// Health
// --------------------------------------------------

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    platform: process.platform,
    python: pythonCommand
  });
});

// --------------------------------------------------
// Download
// --------------------------------------------------

app.post("/api/download", (req, res) => {
  const { url } = req.body;

  if (!url || !isAllowedUrl(url)) {
    return res.status(400).json({
      message:
        "Please enter a valid YouTube or Instagram URL."
    });
  }

  const platform = getPlatform(url);

  if (!platform) {
    return res.status(400).json({
      message:
        "Only YouTube and Instagram URLs are supported."
    });
  }

  console.log("----------------------------------------");
  console.log("Platform:", platform);
  console.log("URL:", url);
  console.log("Operating system:", process.platform);
  console.log("Python command:", pythonCommand);

  // ------------------------------------------------
  // Temporary directory
  // ------------------------------------------------

  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "media-download-")
  );

  const output = path.join(
    tempDir,
    "%(title)s.%(ext)s"
  );

  // ------------------------------------------------
  // yt-dlp arguments
  // ------------------------------------------------

  const args = [
    "-m",
    "yt_dlp",
    "--no-playlist"
  ];

  // ------------------------------------------------
  // YouTube
  // ------------------------------------------------

  if (platform === "youtube") {
    let jsRuntime = "node";

    if (
      process.platform === "win32" &&
      fs.existsSync(localDenoPath)
    ) {
      jsRuntime = `deno:${localDenoPath}`;
    }

    args.push(
      "--js-runtimes",
      jsRuntime,

      // Combined video + audio.
      // No FFmpeg required.
      "-f",
      "18"
    );
  }

  // ------------------------------------------------
  // Instagram
  // ------------------------------------------------

  if (platform === "instagram") {
    args.push(
      "-f",
      "best[ext=mp4]/best"
    );
  }

  // ------------------------------------------------
  // Output
  // ------------------------------------------------

  args.push(
    "-o",
    output,
    url
  );

  console.log(
    "Running:",
    pythonCommand,
    args.join(" ")
  );

  // ------------------------------------------------
  // Start yt-dlp
  // ------------------------------------------------

  const ytdlp = spawn(
    pythonCommand,
    args
  );

  let errorText = "";

  // ------------------------------------------------
  // stdout
  // ------------------------------------------------

  ytdlp.stdout.on("data", (data) => {
    console.log(
      data.toString()
    );
  });

  // ------------------------------------------------
  // stderr
  // ------------------------------------------------

  ytdlp.stderr.on("data", (data) => {
    const message =
      data.toString();

    errorText += message;

    console.log(message);
  });

  // ------------------------------------------------
  // Process error
  // ------------------------------------------------

  ytdlp.on("error", (error) => {

    console.error(
      "yt-dlp process error:",
      error
    );

    fs.rmSync(tempDir, {
      recursive: true,
      force: true
    });

    if (!res.headersSent) {
      return res.status(500).json({
        message:
          "Unable to start yt-dlp. Make sure Python and yt-dlp are installed on the server."
      });
    }
  });

  // ------------------------------------------------
  // Process finished
  // ------------------------------------------------

  ytdlp.on("close", (code) => {

    console.log(
      "yt-dlp exited with code:",
      code
    );

    if (res.headersSent) {
      return;
    }

    // ----------------------------------------------
    // Failed
    // ----------------------------------------------

    if (code !== 0) {

      console.error(
        "yt-dlp failed:"
      );

      console.error(
        errorText
      );

      fs.rmSync(tempDir, {
        recursive: true,
        force: true
      });

      return res.status(500).json({
        message:
          errorText ||
          "Download failed."
      });
    }

    // ----------------------------------------------
    // Find file
    // ----------------------------------------------

    let files;

    try {

      files =
        fs.readdirSync(
          tempDir
        );

    } catch (error) {

      console.error(
        error
      );

      fs.rmSync(tempDir, {
        recursive: true,
        force: true
      });

      return res.status(500).json({
        message:
          "Unable to find downloaded file."
      });
    }

    const downloaded =
      files.find(
        (file) =>
          !file.endsWith(".part") &&
          !file.endsWith(".ytdl")
      );

    if (!downloaded) {

      fs.rmSync(tempDir, {
        recursive: true,
        force: true
      });

      return res.status(500).json({
        message:
          "No downloadable file was produced."
      });
    }

    const filePath =
      path.join(
        tempDir,
        downloaded
      );

    console.log(
      "Downloaded:",
      downloaded
    );

    // ----------------------------------------------
    // Send file
    // ----------------------------------------------

    res.download(
      filePath,
      downloaded,
      (error) => {

        if (error) {
          console.error(
            "File sending error:",
            error
          );
        }

        fs.rmSync(
          tempDir,
          {
            recursive: true,
            force: true
          }
        );

        console.log(
          "Temporary files removed."
        );

        console.log(
          "----------------------------------------"
        );
      }
    );
  });
});

// --------------------------------------------------
// Serve React frontend
// --------------------------------------------------

const clientPath =
  path.join(
    __dirname,
    "../client/dist"
  );

if (
  fs.existsSync(clientPath)
) {

  console.log(
    "Serving frontend:",
    clientPath
  );

  app.use(
    express.static(
      clientPath
    )
  );

  app.get(
    "*",
    (req, res) => {

      res.sendFile(
        path.join(
          clientPath,
          "index.html"
        )
      );

    }
  );

} else {

  app.get(
    "/",
    (req, res) => {

      res.send(
        "Social Video Downloader API is running."
      );

    }
  );
}

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `Platform: ${process.platform}`
    );

    console.log(
      `Python command: ${pythonCommand}`
    );

  }
);