import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function App() {
  const [page, setPage] = useState(1);
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const download = async () => {
    if (!url.trim()) {
      setStatus("Please paste a YouTube or Instagram URL.");
      return;
    }

    setLoading(true);
    setStatus("Preparing your download...");

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Download failed.");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const match = contentDisposition.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || "download.mp4";

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      setStatus("Download completed successfully.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (page === 1) {
    return (
      <main className="screen">
        <section className="card">
          <div className="logo">↓</div>
          <h1>Media Downloader</h1>
          <p className="subtitle">Choose where you want your downloads to go.</p>

          <label>Download location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Example: Downloads"
          />

          <button
            onClick={() => setPage(2)}
            disabled={!location.trim()}
          >
            Continue <span>→</span>
          </button>

          <p className="note">
            Your browser controls the final save location for downloaded files.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="screen">
      <section className="card">
        <button className="back" onClick={() => setPage(1)}>← Back</button>

        <div className="logo">↓</div>
        <h1>Download a video</h1>
        <p className="subtitle">Paste a YouTube or Instagram video URL.</p>

        <label>Video URL</label>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setStatus("");
          }}
          placeholder="https://www.youtube.com/... or https://www.instagram.com/..."
        />

        <div className="location">
          <span>Download location</span>
          <strong>{location}</strong>
        </div>

        <button onClick={download} disabled={loading}>
          {loading ? "Downloading..." : "Download"}
        </button>

        {status && (
          <div className={`status ${status.includes("successfully") ? "success" : "error"}`}>
            {status}
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);