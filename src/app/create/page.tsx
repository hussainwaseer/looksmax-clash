"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/components/SocketProvider";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Copy, Check, AlertTriangle, ArrowLeft, Swords, Users } from "lucide-react";

export default function CreateRoom() {
    const socket = useSocket();
    const router = useRouter();
    const [roomId, setRoomId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [dots, setDots] = useState(".");
    const hasCreated = useRef(false);
    const roomIdRef = useRef<string | null>(null);

    useEffect(() => { setMounted(true); }, []);

    // Animated dots for waiting text
    useEffect(() => {
        const id = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!socket || !mounted) return;

        const handleCreated = (id: string) => {
            roomIdRef.current = id;
            setRoomId(id);
            setConnectionError(null);
        };

        const handleRoomReady = () => {
            const id = roomIdRef.current;
            if (id) router.push(`/battle/${id}`);
        };

        const handlePlayerJoined = (data: { roomId: string; playerCount: number }) => {
            if (data.playerCount >= 2 && data.roomId) {
                router.push(`/battle/${data.roomId}`);
            }
        };

        const handleConnectError = (err: Error) => {
            setConnectionError(err.message);
            hasCreated.current = false;
        };

        const onConnect = () => {
            if (hasCreated.current) return;
            hasCreated.current = true;
            socket.emit("create-room");
            setConnectionError(null);
        };

        socket.on("room-created", handleCreated);
        socket.on("room-ready", handleRoomReady);
        socket.on("player-joined", handlePlayerJoined);
        socket.on("connect_error", handleConnectError);
        socket.on("connect", onConnect);

        if (socket.connected) onConnect();
        else socket.connect();

        return () => {
            socket.off("room-created", handleCreated);
            socket.off("room-ready", handleRoomReady);
            socket.off("player-joined", handlePlayerJoined);
            socket.off("connect_error", handleConnectError);
            socket.off("connect", onConnect);
        };
    }, [socket, router, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

    const copyCode = () => {
        if (roomId) {
            navigator.clipboard.writeText(roomId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!mounted) return <div className="min-h-screen bg-[#050505]" />;

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background glow */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/8 rounded-full blur-[100px]" />
            </div>

            {/* Back Button */}
            <motion.button whileHover={{ x: -3 }} onClick={() => router.push("/")}
                className="fixed top-6 left-6 z-50 flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest">
                <ArrowLeft size={16} /> Home
            </motion.button>

            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "backOut" }}
                className="relative z-10 max-w-md w-full">

                {/* Card */}
                <div className="glass-card p-10 text-center border border-white/8 shadow-[0_0_60px_rgba(0,0,0,0.5)]">

                    {/* Logo */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-cyan-400 rounded-lg flex items-center justify-center">
                            <Swords size={16} className="text-white" />
                        </div>
                        <span className="text-sm font-black uppercase tracking-widest text-zinc-400">Looksmax Clash</span>
                    </div>

                    <AnimatePresence mode="wait">
                        {roomId ? (
                            <motion.div key="room-ready" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                <div className="mb-2 flex justify-center">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                        Room Active
                                    </span>
                                </div>
                                <h1 className="text-2xl font-black mb-1 uppercase tracking-tighter">Room Ready</h1>
                                <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-8">Share this code with your opponent</p>

                                {/* Code display */}
                                <motion.div whileHover={{ scale: 1.02 }} onClick={copyCode}
                                    className="p-6 bg-white/4 rounded-2xl border border-cyan-500/15 mb-6 cursor-pointer group hover:border-cyan-500/30 transition-all">
                                    <span className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3 block">Room Code</span>
                                    <div className="text-5xl font-black text-cyan-400 tracking-[0.3em] mb-4 select-all font-mono">
                                        {roomId}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                                        <AnimatePresence mode="wait">
                                            {copied
                                                ? <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5 text-green-400">
                                                    <Check size={14} /> Copied!
                                                </motion.div>
                                                : <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5">
                                                    <Copy size={14} /> Click to copy
                                                </motion.div>
                                            }
                                        </AnimatePresence>
                                    </div>
                                </motion.div>

                                {/* Waiting indicator */}
                                <div className="flex items-center justify-center gap-3 text-zinc-500 text-sm mb-5">
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => (
                                            <motion.div key={i} className="w-1.5 h-1.5 bg-cyan-500 rounded-full"
                                                animate={{ opacity: [0.2, 1, 0.2] }}
                                                transition={{ duration: 1, repeat: Infinity, delay: i * 0.3 }} />
                                        ))}
                                    </div>
                                    <span className="text-sm font-medium">Waiting for opponent{dots}</span>
                                </div>

                                <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-700 uppercase tracking-widest">
                                    <Users size={12} />
                                    Battle starts automatically when opponent joins
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="creating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <h1 className="text-2xl font-black mb-8 uppercase tracking-tighter">Create Battle</h1>
                                <div className="flex flex-col items-center gap-6 py-6">
                                    <div className="relative">
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: connectionError ? 0 : 2, repeat: Infinity, ease: "linear" }}
                                            className={`w-16 h-16 rounded-full border-4 border-t-transparent ${connectionError ? "border-red-500/30 border-t-red-500" : "border-purple-500/30 border-t-purple-500"}`} />
                                        {connectionError && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <AlertTriangle size={22} className="text-red-500" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5 text-center">
                                        <span className="text-zinc-400 uppercase tracking-widest text-sm font-black block">
                                            {connectionError ? "Connection Failed" : `Generating room${dots}`}
                                        </span>
                                        {connectionError && <p className="text-red-400 text-xs max-w-[220px] mx-auto">{connectionError}</p>}
                                    </div>

                                    {connectionError && (
                                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                            onClick={() => { hasCreated.current = false; socket.disconnect().connect(); }}
                                            className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-xs uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
                                            Retry Connection
                                        </motion.button>
                                    )}

                                    {/* Advanced: custom backend URL */}
                                    <div className="w-full pt-4 border-t border-white/5 space-y-3">
                                        <p className="text-[10px] text-zinc-700 uppercase tracking-tighter text-center">Custom backend (ngrok / LAN):</p>
                                        <div className="flex gap-2">
                                            <input type="text" placeholder="https://your-ngrok.ngrok.io"
                                                className="flex-1 bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-[10px] text-zinc-300 focus:outline-none focus:border-cyan-500/40 transition-colors"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        const url = (e.target as HTMLInputElement).value.trim();
                                                        if (url) { localStorage.setItem("backend_url", url); window.location.reload(); }
                                                    }
                                                }} />
                                            <button onClick={(e) => {
                                                const input = (e.currentTarget as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                                                if (input.value.trim()) { localStorage.setItem("backend_url", input.value.trim()); window.location.reload(); }
                                            }} className="bg-white/8 px-3 py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-white/15 transition-colors">Set</button>
                                        </div>
                                        <button className="text-[10px] text-zinc-700 hover:text-red-400 block mx-auto underline uppercase transition-colors"
                                            onClick={() => { localStorage.removeItem("backend_url"); window.location.reload(); }}>
                                            Reset to Auto
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
