# 🌮 LinguaMex

Your personal Mexican Spanish Comprehensible Input PWA.

## Features
- 📖 **E-Reader** — Upload .txt or .pdf books. Tap any word for instant Claude-powered translation. Add words to flashcards.
- 🎬 **Media Player** — Play local video/audio. Load .srt subtitles. Tap subtitle words to translate.
- 🎓 **AI Tutor** — Upload your grammar book. Chat chapter-by-chapter with Claude as your tutor.
- 📊 **Input Tracker** — Log active and passive learning sessions. Track hours and flashcards.

## Setup

### 1. Add your Claude API Key
After deploying, you need to add your API key in Vercel:
1. Go to your project on vercel.com
2. Settings → Environment Variables
3. Add: `VITE_ANTHROPIC_API_KEY` = your key from console.anthropic.com

### 2. Install on your Android tablet
1. Open your Vercel URL in Chrome
2. Tap ⋮ menu → Add to Home Screen
3. Done!

## Local Development
```bash
npm install
npm run dev
```
