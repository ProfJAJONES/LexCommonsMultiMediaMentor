#!/bin/bash

# AudioFeedback App — Project Setup Script
# Run this from inside your AudioFeedback App folder on the Desktop
# Usage: bash setup.sh

echo "🎙️  AudioFeedback App — Setup Starting..."
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install it from https://nodejs.org then re-run this script."
  exit 1
fi
echo "✅ Node.js found: $(node -v)"

# Check for npm
if ! command -v npm &> /dev/null; then
  echo "❌ npm not found. Please install Node.js from https://nodejs.org"
  exit 1
fi
echo "✅ npm found: $(npm -v)"

# Check for Claude Code
if ! command -v claude &> /dev/null; then
  echo "❌ Claude Code not found. Installing now..."
  npm install -g @anthropic-ai/claude-code
else
  echo "✅ Claude Code found: $(claude --version)"
fi

echo ""
echo "📦 Initializing Electron + TypeScript project..."

# Initialize package.json
npm init -y

# Install core dependencies
npm install electron
npm install --save-dev typescript ts-node @types/node electron-builder

# Install audio/video libraries
npm install web-audio-api
npm install fluent-ffmpeg
npm install pitchfinder
npm install konva

# Install UI framework
npm install react react-dom
npm install --save-dev @types/react @types/react-dom

# Create tsconfig
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
echo "✅ tsconfig.json created"

# Create folder structure
mkdir -p src/main
mkdir -p src/renderer
mkdir -p src/audio
mkdir -p src/video
mkdir -p src/annotation
mkdir -p src/feedback
mkdir -p assets

echo "✅ Folder structure created"

# Create a basic Electron main entry point
cat > src/main/index.ts << 'EOF'
import { app, BrowserWindow } from 'electron';
import path from 'path';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'AudioFeedback App',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadFile(path.join(__dirname, '../../src/renderer/index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
EOF
echo "✅ Electron main entry point created"

# Create a basic renderer HTML file
cat > src/renderer/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>AudioFeedback App</title>
  <style>
    body { margin: 0; font-family: sans-serif; background: #1a1a2e; color: #eee; }
    h1 { text-align: center; padding: 2rem; }
  </style>
</head>
<body>
  <h1>🎙️ AudioFeedback App</h1>
  <p style="text-align:center">Ready to build. Open Claude Code and start prompting.</p>
</body>
</html>
EOF
echo "✅ Renderer HTML created"

# Update package.json scripts
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.main = 'src/main/index.ts';
pkg.scripts = {
  ...pkg.scripts,
  'start': 'electron .',
  'build': 'tsc && electron-builder',
  'dev': 'ts-node src/main/index.ts'
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"
echo "✅ package.json scripts updated"

echo ""
echo "================================================"
echo "✅ AudioFeedback App project initialized!"
echo ""
echo "Next steps:"
echo "  1. Edit .mcp.json — add your GitHub token and fix the filesystem path"
echo "  2. Run: claude"
echo "  3. Inside Claude Code, run: /mcp  (to verify servers)"
echo "  4. Start building!"
echo "================================================"
