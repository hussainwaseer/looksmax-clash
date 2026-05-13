"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/components/SocketProvider";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, AlertCircle, ArrowLeft, Swords } from "lucide-react";

export default function JoinRoom() {
    const socket = useSocket();
    const router = useRouter();
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = code.trim().toUpperCase();
        if (trimmed.length !== 6) return;

        setLoading(true);
        setError(null);

        socket.emit("join-room", trimmed);

        socket.once("joined-room-info", (data: { roomId: string }) => {
            router.push(`/battle/${data.roomId}`);
        });

        socket.once("room-error", (msg: string) => {
            setError(msg);
            setLoading(false);
        });

        socket.once("error", (msg: string) => {
            setError(msg);
            setLoading(false);
        });

        setTimeout(() => {
            setError(prev => prev ?? "Connection timed out. Check the room code and try again.");
            setLoading(false);
        }, 7000);
    };

    if (!mounted) return <div className="min-h-screen bg-[#050505]" />;

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-white relative overflow-hidden">
            {/* Background glow */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-1/3 right-1/4 w-[500px] h-[400px] bg-purple-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 left-1/4 w-[350px] h-[350px] bg-cyan-500/8 rounded-full blur-[100px]" />
            </div>

            {/* Back Button */}
            <motion.button whileHover={{ x: -3 }} onClick={() => router.push("/")}
                className="fixed top-6 left-6 z-50 flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest">
                <ArrowLeft size={16} /> Home
            </motion.button>

            <motion.div initial={{ opacity: 0, y: 24, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "backOut" }}
                className="relative z-10 max-w-md w-full">

                <div className="glass-card p-10 border border-white/8 shadow-[0_0_60px_rgba(0,0,0,0.5)]">

                    {/* Logo */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-cyan-400 rounded-lg flex items-center justify-center">
                            <Swords size={16} className="text-white" />
                        </div>
                        <span className="text-sm font-black uppercase tracking-widest text-zinc-400">Face-Off</span>
                    </div>

                    <h1 className="text-2xl font-black mb-1 uppercase tracking-tighter text-center">Join Battle</h1>
                    <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-8 text-center">Enter the 6-character room code</p>

                    <form onSubmit={handleJoin} className="space-y-5">
                        <div>
                            <label className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2.5 block font-bold">Room Code</label>
                            {/* Code input with individual character boxes feel */}
                            <motion.input
                                type="text"
                                maxLength={6}
                                value={code}
                                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
                                placeholder="E.g. XJ92LK"
                                autoComplete="off"
                                spellCheck={false}
                                whileFocus={{ borderColor: "rgba(0,255,204,0.4)", boxShadow: "0 0 0 2px rgba(0,255,204,0.08)" }}
                                className="w-full bg-white/4 border border-white/8 rounded-xl px-6 py-5 text-3xl font-black text-center tracking-[0.4em] focus:outline-none transition-all placeholder:text-zinc-800 uppercase font-mono"
                            />
                            {/* Character counter */}
                            <div className="flex justify-end mt-1.5">
                                <span className={`text-[10px] font-mono tabular-nums ${code.length === 6 ? "text-cyan-400" : "text-zinc-700"}`}>
                                    {code.length}/6
                                </span>
                            </div>
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -4, height: 0 }}
                                    className="flex items-start gap-2.5 text-red-400 text-sm bg-red-500/8 p-4 rounded-xl border border-red-500/20">
                                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.button
                            type="submit"
                            disabled={code.trim().length !== 6 || loading}
                            whileHover={{ scale: code.trim().length === 6 ? 1.01 : 1 }}
                            whileTap={{ scale: code.trim().length === 6 ? 0.97 : 1 }}
                            className="w-full py-5 bg-white text-black font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2.5 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyan-400 transition-all text-sm relative overflow-hidden group">
                            <AnimatePresence mode="wait">
                                {loading ? (
                                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="flex items-center gap-2">
                                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                                            className="w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                                        Joining...
                                    </motion.div>
                                ) : (
                                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="flex items-center gap-2">
                                        Enter Battle Arena <ChevronRight size={18} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    </form>

                    <div className="text-center text-[10px] text-zinc-700 mt-8 uppercase tracking-widest">
                        Need a code?{" "}
                        <button onClick={() => router.push("/create")} type="button"
                            className="text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors font-black">
                            Create your own room
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
