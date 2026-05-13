import { io, Socket } from "socket.io-client";

const getSocketUrl = () => {
    // 1. Check for environment variable (production)
    if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;

    if (typeof window !== "undefined") {
        // 2. Check for manual override in localStorage (diagnostic tool)
        const override = localStorage.getItem("backend_url");
        if (override) return override;

        const hostname = window.location.hostname;
        const port = window.location.port;

        // 3. Handle IP address (LAN testing) — use same port, single-port server
        if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            return `http://${hostname}:${port || 3000}`;
        }

        // 4. Handle custom domains (ngrok) — same origin, let socket.io resolve
        if (hostname !== "localhost") {
            return window.location.origin;
        }
    }
    // 5. Default local development fallback (single-port server on 3000)
    return "http://localhost:3000";
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
