import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadYtDlp() {
  const isWin = process.platform === "win32";
  const binDir = path.join(__dirname, "bin");
  const binName = isWin ? "yt-dlp.exe" : "yt-dlp";
  const binPath = path.join(binDir, binName);

  if (fs.existsSync(binPath)) {
    console.log(`yt-dlp binary already exists at ${binPath}`);
    return;
  }

  // Check if yt-dlp is in system PATH
  try {
    execSync(isWin ? "where yt-dlp" : "which yt-dlp", { stdio: "ignore" });
    console.log("yt-dlp found in system PATH.");
    return;
  } catch {}

  // Check if python -m yt_dlp module exists
  const pyCmd = isWin ? "py" : "python3";
  try {
    execSync(`${pyCmd} -m yt_dlp --version`, { stdio: "ignore" });
    console.log("yt_dlp Python module found.");
    return;
  } catch {}

  console.log(`yt-dlp not found on system. Downloading standalone binary to ${binPath}...`);
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const downloadUrl = isWin
    ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download yt-dlp: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(binPath, Buffer.from(arrayBuffer));

  if (!isWin) {
    fs.chmodSync(binPath, 0o755);
  }

  console.log("yt-dlp standalone binary downloaded successfully!");
}

downloadYtDlp().catch((err) => {
  console.error("yt-dlp setup script warning:", err.message);
});
