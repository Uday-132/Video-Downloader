# Simple Media Downloader

A minimal React + Express website for downloading media from supported YouTube and Instagram URLs using yt-dlp.

## Requirements

- Node.js 18+
- yt-dlp installed and available in your PATH

## Install

From the project root:

```bash
npm install
npm run install-all
```

## Run

```bash
npm run dev
```

Open:

http://localhost:5173

The API runs on:

http://localhost:5000

## Important

The "download location" field is a UI preference only in a normal website. Browsers do not allow a webpage to directly write into an arbitrary local folder. The browser decides where the downloaded file is saved.

Use this only for content you have permission to download and in accordance with the applicable platform terms.
