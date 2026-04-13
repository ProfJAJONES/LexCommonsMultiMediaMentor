# AudioFeedback App — Setup Guide

## What goes in your AudioFeedback App folder

```
AudioFeedback App/
├── .mcp.json       ← MCP server config for Claude Code
├── setup.sh        ← Run this first to initialize everything
└── README.md       ← This file
```

---

## Step 1 — Edit .mcp.json before anything else

Open `.mcp.json` and make two changes:

1. Replace `YOUR_GITHUB_PAT_HERE` with your GitHub Personal Access Token
   - Go to: github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens
   - Generate a new token with repo read/write permissions
   - Paste it in the file

2. Replace `/PATH/TO/YOUR/PROJECT` with your actual path:
   - Mac: `/Users/yourname/Desktop/AudioFeedback App`
   - Windows: `C:\Users\yourname\Desktop\AudioFeedback App`

---

## Step 2 — Install Node.js (if you haven't already)

Download from: https://nodejs.org  
Choose the LTS version.

Verify in terminal:
```bash
node -v
npm -v
```

---

## Step 3 — Install Claude Code (if you haven't already)

```bash
npm install -g @anthropic-ai/claude-code
```

---

## Step 4 — Run the setup script

Open your terminal, navigate to the project folder, and run:

```bash
cd ~/Desktop/AudioFeedback\ App
bash setup.sh
```

This will:
- Check for Node.js and Claude Code
- Initialize an Electron + TypeScript project
- Install all core dependencies (audio, video, annotation libraries)
- Create the folder structure
- Create starter files

---

## Step 5 — Launch Claude Code

```bash
claude
```

Then inside Claude Code verify your MCP servers:
```
/mcp
```

All 6 servers should show as connected.

---

## Step 6 — First Claude Code prompt to get started

Paste this to orient Claude Code to the project:

```
We are building AudioFeedback App — a desktop application for 
law professors and students to analyze oral advocacy skills. 
It also serves vocal coaches, musicians, and actors.

Core features to build:
- Import student video or audio recordings
- Playback controls and audio editing
- Real-time vocal graph showing decibel level and pitch 
  (pitch mapped to a piano keyboard like singingcarrots.com)
- Audio input options: video audio, separate synced audio file, 
  microphone, Bluetooth, or virtual audio routing (BlackHole pattern)
- Metronome with visual and audio tick options
- Professor note-taking area (text, audio, video feedback)
- Quick pause-comment-resume for feedback recording
- Annotation tools to draw on video (circle gestures, expressions)
- Sharing options
- Video conferencing

Tech stack: Electron, TypeScript, React, Web Audio API, 
Konva.js for annotation, FFmpeg for media processing, 
pitchfinder for pitch detection.

Please review the current folder structure and suggest what 
to build first.
```

---

## Folder Structure (after setup.sh runs)

```
AudioFeedback App/
├── .mcp.json
├── setup.sh
├── README.md
├── package.json
├── tsconfig.json
├── assets/
└── src/
    ├── main/          ← Electron main process
    │   └── index.ts
    ├── renderer/      ← UI (React + HTML)
    │   └── index.html
    ├── audio/         ← Audio engine, pitch detection, metronome
    ├── video/         ← Video import, playback, sync
    ├── annotation/    ← Drawing tools, Konva.js layer
    └── feedback/      ← Professor notes, recording, sharing
```

---

## Key Libraries Being Used

| Library | Purpose |
|---|---|
| Electron | Cross-platform desktop app shell |
| TypeScript | Typed JavaScript for reliability |
| React | UI component framework |
| Web Audio API | Real-time audio processing |
| pitchfinder | Pitch detection algorithm |
| Konva.js | Canvas annotation drawing layer |
| fluent-ffmpeg | Video/audio file processing |
| electron-builder | Package app for Mac and Windows |

---

## MCP Servers (what they do in Claude Code)

| Server | Purpose |
|---|---|
| github | Search libraries, manage code, create issues |
| filesystem | Claude reads/writes your project files directly |
| sequential-thinking | Breaks complex tasks into steps |
| context7 | Live docs for Web Audio API, Electron, Konva |
| playwright | UI testing for the Electron app |
| sqlite | Query your annotation/session database |
