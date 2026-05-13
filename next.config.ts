import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'comma-ethanol-strainer.ngrok-free.dev',
    '*.ngrok-free.dev',
    '*.ngrok.io',
    '*.ngrok-free.app',
    'localhost:3000'
  ]
};

export default nextConfig;
