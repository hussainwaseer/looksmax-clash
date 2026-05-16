# 🌟 Looksmax Clash

**The Ultimate Competitive Aesthetic Analysis & AI-Driven Self-Improvement Platform.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Vision-blue?style=for-the-badge&logo=google)](https://mediapipe.dev/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-Pro-orange?style=for-the-badge&logo=google-gemini)](https://ai.google.dev/)
[![PWA](https://img.shields.io/badge/PWA-Ready-purple?style=for-the-badge&logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

Looksmax Clash is a high-performance, mobile-friendly web application designed for the competitive looksmaxxing community. By combining advanced computer vision with generative AI, it provides users with an objective, data-driven assessment of their facial aesthetics, actionable plans for improvement, and a 1v1 real-time head-to-head battle arena.

---

## 🚀 Key Features

### 🔍 Solo Face Scan & Analysis
- **Geometric Analysis**: Precision multi-angle facial landmarks via MediaPipe to measure symmetry, jawline definition, canthal tilt, and orbital harmony.
- **Progress Tracking**: Scan History memory persisting the last 10 scans into your local browser storage and charting your visual progression across different lighting/angles over time.
- **"Mogged" Flex Cards**: Downloadable, high-fidelity premium 1080x1920 "report cards" highlighting your overall score and strongest attributes to share on socials.

### 🧠 Personalized AI Guru
- **Data-Driven Insights**: Integrated Google Gemini AI that takes your specific anatomical weaknesses directly from the face scanner.
- **Actionable Blueprints**: Generates a brutal, technical, non-sugarcoated 3-step action roadmap telling you exactly how to hit your geometric potential ceiling.

### ⚔️ Face-Off (Battle Arena)
- **Real-Time Matchmaking**: Instantly find random opponents across the globe via a server-side queuing pipeline, or invite friends using direct connection codes.
- **WebRTC Peer-to-Peer Battles**: Ultra-low latency signaling routed through custom TURN relay servers ensuring smooth networking even across distinct mobile carriers.
- **Live Tracing & Spectator Mode**: See the high-fidelity green-dot face mesh overlay for real-time verification tracing. Spectators can drop into a live match and watch securely.
- **Aesthetic Judgement**: Automated, geometric-based scoring determines a definitive winner to settle all disputes objectively, wrapped in immersive Haptic and Web Audio API victory fanfares.

### 📱 Progressive Web App (PWA)
- **Add to Homescreen**: Built with a complete `manifest.json` schema. Treats the browser interface as a fully native fullscreen mobile app without going to an App Store.

---

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) 
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Computer Vision**: [MediaPipe Vision](https://google.github.io/mediapipe/)
- **Real-Time Connectivity**: [WebRTC](https://webrtc.org/) and [Socket.io](https://socket.io/) 
- **Generative AI**: [Google Gemini Flash API](https://ai.google.dev/) 

---

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ 

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/hussainwaseer/looksmax-clash.git
   cd looksmax-clash
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env.local` file in the root directory and add:
   ```env
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
   GEMINI_API_KEY=your_gemini_api_key_from_google_studio
   # Add your Metered TURN ICE server creds to the RTCPeerConnection if required
   ```

4. **Run the Socket Backend & Next.js Client**:
   ```bash
   npm run dev
   # Or alternatively run node server.js manually for custom port setups
   ```

---

## 🗺 Project Structure

```text
├── src/
│   ├── app/          # Next.js Pages (Scan, Battle, Create/Join Room, API)
│   ├── components/   # Context Providers & Reusable Models
│   ├── lib/          # Utilities, Scoring Logic, Canvas Renditions
│   └── styles/       # Global CSS
├── public/           # PWA manifest, Icons, Static assets
├── server.js         # Socket.io Signaling & Matchmaking Orchestration Server
└── package.json      # Dependencies and scripts
```
