import { io, Socket } from "socket.io-client";

const getSocketUrl = () => {
    if (typeof window !== "undefined") {
        // 1. Check for manual override in localStorage (diagnostic tool)
        const override = localStorage.getItem("backend_url");
        if (override) return override;

        const hostname = window.location.hostname;
        const port = window.location.port;

        // 2. Handle IP address (LAN testing) — use same port, single-port server
        if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            return `http://${hostname}:${port || 3000}`;
        }

        // 3. Handle custom domains (Railway / ngrok / Vercel) — same origin
        if (hostname !== "localhost") {
            return window.location.origin;
        }
    }

    // 4. Default local development fallback
    return process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";
};

export const socket: Socket = io(getSocketUrl(), {
    autoConnect: false,
    transports: ["websocket", "polling"],
});

if (typeof window !== "undefined") {
    socket.on("connect", () => console.log("[Socket] Connected:", socket.id));
    socket.on("disconnect", (reason) => console.warn("[Socket] Disconnected:", reason));
    socket.on("connect_error", (err) => console.error("[Socket] Connect error:", err.message));
}
