import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// --------------------------------------------------
// Deno location
// --------------------------------------------------

const denoPath =
  "C:\\Users\\udayv\\AppData\\Local\\Microsoft\\WinGet\\Packages\\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\\deno.exe";

// --------------------------------------------------
// Allowed websites
// --------------------------------------------------

const allowedHosts = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "instagram.com",
  "www.instagram.com"
];

// --------------------------------------------------
// Check whether URL is YouTube / Instagram
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
// Download API
// --------------------------------------------------

app.post("/api/download", (req, res) => {
  const { url } = req.body;

  // ----------------------------------------------
  // Validate URL
  // ----------------------------------------------

  if (!url || !isAllowedUrl(url)) {
    return res.status(400).json({
      message:
        "Please enter a valid YouTube or Instagram URL."
    });
  }

  // ----------------------------------------------
  // Detect platform
  // ----------------------------------------------

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

  // ----------------------------------------------
  // Create temporary directory
  // ----------------------------------------------

  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "media-download-")
  );

  const output = path.join(
    tempDir,
    "%(title)s.%(ext)s"
  );

  // ----------------------------------------------
  // Build yt-dlp arguments
  // ----------------------------------------------

  const args = [
    "-m",
    "yt_dlp",

    "--no-playlist"
  ];

  // ----------------------------------------------
  // YouTube
  // ----------------------------------------------

  if (platform === "youtube") {
    args.push(
      "--js-runtimes",
      `deno:${denoPath}`,

      // Format 18 is a combined video + audio MP4
      // and does not require FFmpeg.
      "-f",
      "18"
    );
  }

  // ----------------------------------------------
  // Instagram
  // ----------------------------------------------

  if (platform === "instagram") {
    args.push(
      "-f",
      "best[ext=mp4]/best"
    );
  }

  // ----------------------------------------------
  // Output filename
  // ----------------------------------------------

  args.push(
    "-o",
    output,

    url
  );

  console.log("yt-dlp command:");
  console.log("py", args.join(" "));

  // ----------------------------------------------
  // Start yt-dlp
  // ----------------------------------------------

  const ytdlp = spawn("py", args);

  let errorText = "";

  // ----------------------------------------------
  // stdout
  // ----------------------------------------------

  ytdlp.stdout.on("data", (data) => {
    const message = data.toString();

    console.log(message);

    // Don't send stdout directly to browser.
  });

  // ----------------------------------------------
  // stderr
  // ----------------------------------------------

  ytdlp.stderr.on("data", (data) => {
    const message = data.toString();

    errorText += message;

    console.log(message);
  });

  // ----------------------------------------------
  // Process error
  // ----------------------------------------------

  ytdlp.on("error", (error) => {
    console.error("Failed to start yt-dlp:");
    console.error(error);

    if (!res.headersSent) {
      res.status(500).json({
        message:
          "Unable to start yt-dlp. Make sure Python and yt-dlp are installed."
      });
    }

    fs.rmSync(tempDir, {
      recursive: true,
      force: true
    });
  });

  // ----------------------------------------------
  // Process finished
  // ----------------------------------------------

  ytdlp.on("close", (code) => {
    console.log("yt-dlp exited with code:", code);

    // If an error response was already sent,
    // don't send another response.
    if (res.headersSent) {
      return;
    }

    // --------------------------------------------
    // Download failed
    // --------------------------------------------

    if (code !== 0) {
      console.error("yt-dlp failed:");
      console.error(errorText);

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

    // --------------------------------------------
    // Find downloaded file
    // --------------------------------------------

    let files;

    try {
      files = fs.readdirSync(tempDir);
    } catch (error) {
      console.error(
        "Could not read temporary directory:",
        error
      );

      return res.status(500).json({
        message:
          "Could not find the downloaded file."
      });
    }

    const downloaded = files.find(
      (file) =>
        !file.endsWith(".part") &&
        !file.endsWith(".ytdl")
    );

    // --------------------------------------------
    // No file found
    // --------------------------------------------

    if (!downloaded) {
      console.error(
        "No downloaded file found."
      );

      fs.rmSync(tempDir, {
        recursive: true,
        force: true
      });

      return res.status(500).json({
        message:
          "No downloadable file was produced."
      });
    }

    // --------------------------------------------
    // File path
    // --------------------------------------------

    const filePath = path.join(
      tempDir,
      downloaded
    );

    console.log(
      "Downloaded file:",
      downloaded
    );

    console.log(
      "Sending file to browser..."
    );

    // --------------------------------------------
    // Send file to browser
    // --------------------------------------------

    res.download(
      filePath,
      downloaded,
      (error) => {
        if (error) {
          console.error(
            "Error sending file:",
            error
          );
        }

        // ----------------------------------------
        // Remove temporary directory
        // ----------------------------------------

        fs.rmSync(tempDir, {
          recursive: true,
          force: true
        });

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
// Start server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `Server running at http://localhost:${PORT}`
  );
});