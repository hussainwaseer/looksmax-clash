# 🌟 Looksmax Clash

**The Ultimate Competitive Aesthetic Analysis & AI-Driven Self-Improvement Platform.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Vision-blue?style=for-the-badge&logo=google)](https://mediapipe.dev/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-Pro-orange?style=for-the-badge&logo=google-gemini)](https://ai.google.dev/)

Looksmax Clash is a high-performance web application designed for the competitive looksmaxxing community. By combining advanced computer vision with generative AI, it provides users with an objective, data-driven assessment of their facial aesthetics and actionable plans for improvement.

---

## 🚀 Key Features

### 🔍 Solo Face Scan
- **Geometric Analysis**: Precision landmarks using MediaPipe to measure facial symmetry, jawline definition, orbital harmony, and more.
- **Deep Scoring**: A rigorous, non-sugarcoated rating model that provides an honest assessment of your current aesthetic standing.
- **Potential Tracking**: Estimates your "aesthetic ceiling" based on bone structure and features.

### ⚔️ Face-Off (Battle Mode)
- **Real-Time Competition**: Connect with opponents via WebRTC for live head-to-head aesthetic battles.
- **Live Tracing**: High-fidelity green-dot face mesh overlay for real-time verification and tracing.
- **Fair Scoring**: Automated, geometric-based scoring ensures a objective winner every time.

### 🧠 AI Guru Chat
- **Personalized Advice**: Integrated Gemini AI acting as a "no-nonsense" looksmaxxing guru.
- **Data-Driven Insights**: The AI analyzes your scan data to provide specific, step-by-step improvement plans.
- **Smart Retries**: Robust client-side logic to ensure a seamless chat experience even under high load.

---

## 🛠 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server Actions)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) with an emphasis on premium, dark-mode aesthetics.
- **Animations**: [Framer Motion](https://www.framer.com/motion/) for smooth micro-interactions and transitions.
- **Computer Vision**: [MediaPipe](https://google.github.io/mediapipe/) & [TensorFlow.js](https://www.tensorflow.org/js) for facial landmark detection.
- **Real-Time Connectivity**: [WebRTC](https://webrtc.org/) and [Socket.io](https://socket.io/) for low-latency synchronization in battle mode.
- **Generative AI**: [Google Gemini Pro API](https://ai.google.dev/) for intelligent analysis and advice.

---

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ 
- NPM / Yarn / Bun

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
   Create a `.env.local` file in the root directory and add your configurations:
   ```env
   NEXT_PUBLIC_SOCKET_URL=your_socket_server_url
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

---

## 🗺 Project Structure

The project has been restructured for a cleaner root-level development experience:

```text
├── src/
│   ├── app/          # Next.js App Router (Layouts, Pages, APIs)
│   ├── components/   # Reusable UI components
│   ├── lib/          # Utilities, Scoring Logic, AI Integration
│   └── styles/       # Global CSS & Tailwind Config
├── public/           # Static assets, local MediaPipe models
├── server.js         # Custom server for Socket.io & WebRTC signaling
├── package.json      # Dependencies and scripts
└── .gitignore        # Optimized for Next.js & Node projects
```

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Generated with ❤️ for the Looksmaxxing Community.
</p>
