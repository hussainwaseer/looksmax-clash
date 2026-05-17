"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { X, Mail, Lock, Globe, Loader2, Sparkles } from "lucide-react";

export function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setLoading(true);
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
                    >
                        {/* Decorative background */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 via-cyan-400 to-purple-600" />
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-600/10 rounded-full blur-[80px]" />
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-400/10 rounded-full blur-[80px]" />

                        <button onClick={onClose} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>

                        <div className="text-center mb-8">
                            <div className="inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 mb-4">
                                <Sparkles className="text-cyan-400" size={24} />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tight">{isLogin ? "Welcome Back" : "Join the Arena"}</h2>
                            <p className="text-zinc-500 text-xs mt-2 uppercase tracking-widest">Master your aesthetics across devices</p>
                        </div>

                        <form onSubmit={handleAuth} className="space-y-4">
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                                    required
                                />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                                    required
                                />
                            </div>

                            {error && (
                                <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest text-center">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" size={18} /> : (isLogin ? "Sign In" : "Create Account")}
                            </button>
                        </form>

                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/5"></div>
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase font-black text-zinc-600 tracking-[0.2em] bg-zinc-950 px-4">
                                or continue with
                            </div>
                        </div>

                        <button
                            onClick={handleGoogle}
                            disabled={loading}
                            className="w-full py-4 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                            <Globe size={18} className="text-cyan-400" /> Google Account
                        </button>

                        <p className="text-center mt-8 text-xs text-zinc-500">
                            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-cyan-400 font-bold hover:underline"
                            >
                                {isLogin ? "Sign Up" : "Log In"}
                            </button>
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
