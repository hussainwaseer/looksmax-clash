import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { SocketProvider } from "@/components/SocketProvider";
import { UserProvider } from "@/components/UserContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Face-Off | The Ultimate Looksmaxxing Battle",
  description: "AI-powered real-time face rating battles. Competitive self-improvement for Gen-Z.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script src="https://js.puter.com/v2/" strategy="beforeInteractive" />
        <UserProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </UserProvider>



        {/* FaceLandmarker is loaded via dynamic import inside components */}
      </body>
    </html>
  );
}
