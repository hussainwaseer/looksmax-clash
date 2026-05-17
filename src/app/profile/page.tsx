"use client";

import { useState } from "react";
import { useUser } from "@/components/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import {
    User, Edit2, Check, X, LogOut, Swords,
    Trophy, Zap, Shield, Camera,
    Globe, Link as LinkIcon, Trash2, ChevronLeft
} from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
    const { profile, user, updateProfile, loading } = useUser();
    const router = useRouter();

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        username: profile.username,
        avatarUrl: profile.avatarUrl || "",
        bio: profile.bio || "",
        instagram: profile.socials?.instagram || "",
        tiktok: profile.socials?.tiktok || ""
    });

    const [updating, setUpdating] = useState(false);

    const handleSave = async () => {
        setUpdating(true);
        try {
            await updateProfile({
                username: editData.username,
                avatarUrl: editData.avatarUrl,
                bio: editData.bio,
                socials: {
                    instagram: editData.instagram,
                    tiktok: editData.tiktok
                }
            });
            setIsEditing(false);
        } catch (error) {
            console.error("Update failed", error);
        } finally {
            setUpdating(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/");
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>;

    const winRate = profile.battles > 0 ? Math.round((profile.wins / profile.battles) * 100) : 0;

    return (
        <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30 overflow-x-hidden">
            {/* Background elements */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
            </div>

            <div className="container mx-auto px-6 py-12 relative z-10 max-w-4xl">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group">
                        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-xs font-black uppercase tracking-widest">Back to Arena</span>
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                        <LogOut size={14} /> Logout
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Sidebar / Main Info */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="glass-card p-8 text-center border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-cyan-400" />

                            <div className="relative mb-6 inline-block">
                                <div className="w-32 h-32 rounded-[2.5rem] bg-zinc-900 border-2 border-white/10 overflow-hidden mx-auto shadow-2xl relative">
                                    {profile.avatarUrl ? (
                                        <img src={profile.avatarUrl} alt={profile.username} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <User size={48} className="text-zinc-700" />
                                        </div>
                                    )}
                                    {isEditing && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <Camera size={24} className="text-white" />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-purple-600 to-cyan-400 p-2.5 rounded-2xl shadow-xl border border-white/20">
                                    <Shield size={16} className="text-white" />
                                </div>
                            </div>

                            <div className="space-y-1 mb-8">
                                <h1 className="text-2xl font-black tracking-tight uppercase italic">{profile.username}</h1>
                                <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest leading-none">{profile.elo} ELO RANKED</p>
                            </div>

                            <AnimatePresence mode="wait">
                                {!isEditing ? (
                                    <motion.button
                                        key="edit"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        onClick={() => setIsEditing(true)}
                                        className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                                    >
                                        <Edit2 size={12} /> Edit Profile
                                    </motion.button>
                                ) : (
                                    <motion.div
                                        key="edit-actions"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="flex gap-2"
                                    >
                                        <button
                                            onClick={handleSave}
                                            disabled={updating}
                                            className="flex-1 py-3 bg-cyan-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-cyan-400 transition-colors disabled:opacity-50"
                                        >
                                            {updating ? "..." : <Check size={12} />} Save
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Social Links */}
                        <div className="glass-card p-6 border border-white/5">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Mogger Socials</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-zinc-400 group">
                                    <Camera size={18} className="group-hover:text-pink-500 transition-colors" />
                                    <span className="text-[10px] uppercase font-bold tracking-widest truncate">
                                        {profile.socials?.instagram || "Not Linked"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-zinc-400 group">
                                    <Globe size={18} className="group-hover:text-cyan-400 transition-colors" />
                                    <span className="text-[10px] uppercase font-bold tracking-widest truncate">
                                        {profile.socials?.tiktok || "Not Linked"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Dashboard */}
                    <div className="lg:col-span-2 space-y-8">
                        {isEditing ? (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 border border-white/5 space-y-6">
                                <h2 className="text-xl font-black uppercase tracking-tighter">Profile Settings</h2>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Battle Name</label>
                                        <input
                                            type="text"
                                            value={editData.username}
                                            onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                                            placeholder="Enter username..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Avatar Image URL</label>
                                        <div className="relative">
                                            <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                                            <input
                                                type="text"
                                                value={editData.avatarUrl}
                                                onChange={(e) => setEditData({ ...editData, avatarUrl: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                                                placeholder="https://..."
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Bio / Motto</label>
                                        <textarea
                                            value={editData.bio}
                                            onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors h-24 resize-none"
                                            placeholder="Tell the arena who you are..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Instagram</label>
                                            <input
                                                type="text"
                                                value={editData.instagram}
                                                onChange={(e) => setEditData({ ...editData, instagram: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                                                placeholder="@handle"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">TikTok</label>
                                            <input
                                                type="text"
                                                value={editData.tiktok}
                                                onChange={(e) => setEditData({ ...editData, tiktok: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                                                placeholder="@handle"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="space-y-8">
                                {/* Stats Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div className="glass-card p-6 border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Swords className="text-zinc-600" size={18} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Battles</span>
                                        </div>
                                        <div className="text-3xl font-black italic">{profile.battles}</div>
                                    </div>
                                    <div className="glass-card p-6 border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Trophy className="text-yellow-500/50" size={18} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Win Rate</span>
                                        </div>
                                        <div className="text-3xl font-black italic text-cyan-400">{winRate}%</div>
                                    </div>
                                    <div className="glass-card p-6 border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Zap className="text-purple-500/50" size={18} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Top ELO</span>
                                        </div>
                                        <div className="text-3xl font-black italic">1,240</div>
                                    </div>
                                </div>

                                {/* Bio Section */}
                                <div className="glass-card p-8 border border-white/5">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Identity</h3>
                                    <p className="text-zinc-400 text-sm italic leading-relaxed">
                                        {profile.bio || "No motto set. Win a battle to prove your worth."}
                                    </p>
                                </div>

                                {/* Recent Scans */}
                                <div className="glass-card p-8 border border-white/5 relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Evolution History</h3>
                                        <Link href="/scan" className="text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:underline">New Scan</Link>
                                    </div>
                                    <div className="space-y-4">
                                        {profile.history.length > 0 ? profile.history.slice(-3).reverse().map((scan, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center text-cyan-400 font-black">
                                                        {scan.score.toFixed(1)}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold uppercase tracking-widest">Face Scan</div>
                                                        <div className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">{new Date(scan.date).toLocaleDateString()}</div>
                                                    </div>
                                                </div>
                                                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Verified</div>
                                            </div>
                                        )) : (
                                            <p className="text-center py-8 text-zinc-700 text-xs uppercase tracking-widest font-black">No scans recorded yet</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

