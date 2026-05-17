# 🌟 Looksmax Clash

**The Ultimate Competitive Aesthetic Analysis & AI-Driven Self-Improvement Platform.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_&_DB-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Vision-blue?style=for-the-badge&logo=google)](https://mediapipe.dev/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-Pro-orange?style=for-the-badge&logo=google-gemini)](https://ai.google.dev/)
[![PWA](https://img.shields.io/badge/PWA-Ready-purple?style=for-the-badge&logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

Looksmax Clash is a high-performance, mobile-friendly web application designed for the competitive looksmaxxing community. By combining advanced computer vision with generative AI, it provides users with an objective, data-driven assessment of their facial aesthetics, actionable plans for improvement, and a 1v1 real-time head-to-head battle arena.

---

## 🚀 Key Features

### 👤 Cloud Accounts & Persistent Identity
- **Firebase Integration**: Secure Login/Signup with Email or Google Account via a premium glassmorphism `AuthModal`.
- **Seamless Migration**: Start as a guest and instantly sync your local ELO, Wins, and Scan History to your permanent cloud account upon first login.
- **Global Rankings**: Your ELO is now persistent across all devices, ensuring your status in the aesthetics arena is never lost.

### 🔍 Solo Face Scan & Analysis
- **Geometric Analysis**: Precision multi-angle facial landmarks via MediaPipe to measure symmetry, jawline definition, canthal tilt, and orbital harmony.
- **Persistent Scan History**: Full history tracking with SVG-based growth charts to visualize your facial evolution over weeks and months.
- **"Mogged" Flex Cards**: Downloadable, high-fidelity premium 1080x1920 "report cards" highlighting your overall score and strongest attributes to share on socials.

### 🧠 Personalized AI Guru
- **Data-Driven Insights**: Integrated Google Gemini AI that takes your specific anatomical weaknesses directly from the face scanner.
- **Actionable Blueprints**: Generates a brutal, technical, non-sugarcoated 30-day action roadmap telling you exactly how to hit your geometric potential ceiling.

### ⚔️ Face-Off (Battle Arena)
- **Real-Time Matchmaking**: Instantly find random opponents across the globe via a server-side queuing pipeline, or invite friends using direct connection codes.
- **WebRTC Peer-to-Peer Battles**: Ultra-low latency signaling with automated scoring triggers, wrapped in immersive Haptic and Web Audio API sensory fanfares.
- **Spectator Mode**: Watch high-level battles in real-time. Experience the total "mogging" atmosphere without joining the queue.

---

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) 
- **Database/Auth**: [Firebase](https://firebase.google.com/) (Auth & Firestore)
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
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ```
   *Note: Firebase configuration is located in `src/lib/firebase.ts`.*

4. **Run the Socket Backend & Next.js Client**:
   ```bash
   npm run dev
   # Or alternatively run node server.js manually for custom port setups
   ```

---

## 📜 License
MIT License. Built for the mog era.
