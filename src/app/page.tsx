"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Swords, Zap, ChevronRight, Menu, X, Star, Target, Flame, Crown, Users, Search, Trophy } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/components/UserContext";
import { useSocket } from "@/components/SocketProvider";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/AuthModal";

const STATS = [
  { label: "Battles Fought", value: "48,291", icon: "⚔️" },
  { label: "Active Users", value: "3,847", icon: "👥" },
  { label: "Avg Score", value: "7.4", icon: "📊" },
  { label: "Elite Tier", value: "2.1%", icon: "👑" },
];

const LEADERBOARD = [
  { rank: 1, name: "🇸🇦 FaceGod_SA", score: "9.8", label: "Elite", wins: 42 },
  { rank: 2, name: "🇺🇸 ChadMaxxer", score: "9.4", label: "Chad", wins: 38 },
  { rank: 3, name: "🇯🇵 Ryujin99", score: "9.1", label: "Chad", wins: 31 },
  { rank: 4, name: "🇧🇷 LooksmaxGod", score: "8.7", label: "Chad Lite", wins: 27 },
  { rank: 5, name: "🇩🇪 GermanJaw", score: "8.4", label: "Chad Lite", wins: 22 },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeBattles, setActiveBattles] = useState(24);
  const [isSearching, setIsSearching] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const orbX = useTransform(mouseX, [-1, 1], [-30, 30]);
  const orbY = useTransform(mouseY, [-1, 1], [-20, 20]);
  const orbX2 = useTransform(mouseX, [-1, 1], [30, -30]);
  const orbY2 = useTransform(mouseY, [-1, 1], [20, -20]);

  const { profile, user, loading } = useUser();
  const socket = useSocket();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setActiveBattles(n => n + (Math.random() > 0.5 ? 1 : -1)), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("match-found", (roomId: string) => {
      setIsSearching(false);
      router.push(`/battle/${roomId}`);
    });
    return () => { socket.off("match-found"); };
  }, [socket, router]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(((e.clientX - rect.left) / rect.width - 0.5) * 2);
    mouseY.set(((e.clientY - rect.top) / rect.height - 0.5) * 2);
  };

  const handleFindMatch = () => {
    if (isSearching) {
      socket.emit("cancel-match");
      setIsSearching(false);
    } else {
      socket.emit("find-match");
      setIsSearching(true);
    }
  };

  const handleLogout = () => {
    const { auth } = require("@/lib/firebase");
    require("firebase/auth").signOut(auth);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500 selection:text-white overflow-x-hidden">
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* ── Animated Background ── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div style={{ x: orbX, y: orbY }}
          className="orb-pulse absolute top-[-20%] left-[-10%] w-[700px] h-[700px] bg-purple-600/18 rounded-full blur-[140px]" />
        <motion.div style={{ x: orbX2, y: orbY2 }}
          className="orb-pulse absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/12 rounded-full blur-[120px]" />
        <div className="orb-pulse absolute top-[40%] left-[40%] w-[400px] h-[400px] bg-purple-800/8 rounded-full blur-[100px]" style={{ animationDelay: "1.5s" }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "80px 80px"
        }} />
      </div>

      {/* ── Header ── */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-400 ${scrolled ? "bg-black/85 backdrop-blur-2xl border-b border-white/5 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.5)]" : "bg-transparent py-4 md:py-6"}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <motion.div whileHover={{ rotate: 10, scale: 1.1 }} className="w-9 h-9 bg-gradient-to-br from-purple-600 to-cyan-400 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(157,0,255,0.4)]">
              <Swords size={18} className="text-white" />
            </motion.div>
            <span className="text-xl font-black tracking-tighter uppercase italic text-white group-hover:text-cyan-400 transition-colors">Face-Off</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-8 items-center text-sm font-medium uppercase tracking-widest text-zinc-400">
            <Link href="/scan" className="hover:text-cyan-400 transition-colors">Face Scan</Link>
            <Link href="/join" className="hover:text-cyan-400 transition-colors">Join Battle</Link>

            {/* User Profile Badge */}
            <div className="flex items-center gap-4 pl-4 border-l border-white/10">
              {user ? (
                <>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-white leading-none mb-0.5">{profile.username}</span>
                    <span className="text-[10px] font-bold text-cyan-400 leading-none">{profile.elo} ELO</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden hover:bg-white/10 transition-colors group"
                  >
                    <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-cyan-400/20 flex items-center justify-center group-hover:from-purple-500/30 group-hover:to-cyan-400/30">
                      <span className="text-xs font-black text-white/50">{profile.username[0]}</span>
                    </div>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>
          </nav>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            onClick={() => setMobileNavOpen(v => !v)} aria-label="Toggle menu">
            <AnimatePresence mode="wait">
              {mobileNavOpen
                ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X size={20} /></motion.div>
                : <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><Menu size={20} /></motion.div>
              }
            </AnimatePresence>
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -10, height: 0 }}
              className="md:hidden absolute top-full left-0 right-0 bg-black/98 backdrop-blur-2xl border-b border-white/8 py-6 px-6 flex flex-col gap-4">
              <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-lg font-black text-cyan-400">{profile.username[0]}</span>
                </div>
                <div>
                  <div className="text-sm font-black text-white uppercase">{profile.username}</div>
                  <div className="text-xs font-bold text-zinc-500">{profile.elo} ELO • {profile.battles} BATTLES</div>
                </div>
              </div>
              {["Face Scan", "Join Battle"].map(item => (
                <Link key={item} href={`/${item.toLowerCase().replace(/ /g, "")}`}
                  className="text-zinc-400 hover:text-white py-2 text-sm font-bold uppercase tracking-widest transition-colors border-b border-white/5"
                  onClick={() => setMobileNavOpen(false)}>{item}</Link>
              ))}
              <div className="flex flex-col gap-3 pt-2">
                <Link href="/create" className="w-full py-3 bg-white text-black font-black uppercase tracking-widest rounded-xl text-center hover:bg-cyan-400 transition-colors text-sm"
                  onClick={() => setMobileNavOpen(false)}>Create Match</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero ── */}
      <section ref={heroRef} onMouseMove={handleMouseMove}
        className="relative z-10 pt-32 md:pt-44 pb-24 text-center px-6 min-h-[90vh] flex flex-col items-center justify-center">

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="flex flex-col items-center max-w-5xl mx-auto">

          {/* Live pill */}
          <motion.div whileHover={{ scale: 1.03 }}
            className="inline-flex items-center gap-2.5 px-5 py-2 mb-8 text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase border border-cyan-500/25 rounded-full bg-cyan-500/5 text-cyan-400 cursor-default">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span>⚡ {activeBattles} Live Battles Now</span>
          </motion.div>

          <h1 className="text-5xl md:text-[7rem] lg:text-[9rem] font-black tracking-tight mb-6 leading-[0.88] uppercase">
            Can Your Face{" "}
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-300 to-purple-400 bg-[length:200%_auto] animate-gradient">
              Dominate?
            </span>
          </h1>

          <p className="text-base md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
            AI-powered real-time face ratings. No bias. No excuses.{" "}
            <br className="hidden md:block" />
            The most addictive self-improvement arena for Gen-Z.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-14 w-full px-10">
            {/* Find Match Button (Random) */}
            <button
              onClick={handleFindMatch}
              className={`group relative w-full sm:w-[280px] py-6 rounded-2xl overflow-hidden active:scale-95 transition-all text-center shadow-2xl border ${isSearching ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-white text-black border-white"}`}
            >
              <div className="relative z-10 flex flex-col items-center gap-1">
                {isSearching ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Search className="animate-spin" size={20} />
                      <span className="text-sm font-black uppercase tracking-[0.2em]">Searching...</span>
                    </div>
                    <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Click to Cancel</span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Zap size={20} fill="black" />
                      <span className="text-sm font-black uppercase tracking-[0.2em]">Find Match</span>
                    </div>
                    <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Auto Matchmaking</span>
                  </>
                )}
              </div>
              {!isSearching && <div className="absolute inset-0 bg-cyan-400 -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />}
            </button>

            <Link href="/scan"
              className="group relative w-full sm:w-[280px] py-6 bg-zinc-900 border border-white/5 text-white rounded-2xl overflow-hidden active:scale-95 transition-all text-center">
              <div className="relative z-10 flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <Target size={20} className="text-purple-400" />
                  <span className="text-sm font-black uppercase tracking-[0.2em]">Solo Scan</span>
                </div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI Assessment</span>
              </div>
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl">
            {STATS.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
                className="flex flex-col items-center gap-0.5 p-3 rounded-2xl bg-white/3 border border-white/5">
                <span className="text-lg">{s.icon}</span>
                <span className="text-lg font-black text-white tabular-nums">{s.value}</span>
                <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">{s.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-28 px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4">Powered by AI</h2>
            <p className="text-zinc-500 text-sm uppercase tracking-widest">Real-time geometric analysis. Zero human bias.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <FeatureCard icon={<Zap className="text-yellow-400" size={26} />} title="Real-Time AI"
              desc="Sub-second MediaPipe landmark detection scores symmetry, jawline, orbital harmony, and golden ratio — live." badge="468 Landmarks" />
            <FeatureCard icon={<Crown className="text-purple-400" size={26} />} title="Global Rankings"
              desc="Climb from Normie to Elite Tier. Every battle updates your standing. No rank decay." badge="5 Tiers" />
            <FeatureCard icon={<Flame className="text-cyan-400" size={26} />} title="Mogging Meter"
              desc="Live dominance bar shifts in real-time as AI scans both faces. Watch the mog unfold." badge="Live" />
          </div>
        </div>
      </section>

      {/* ── Leaderboard ── */}
      <section id="leaderboard" className="relative z-10 py-28 px-6">
        <div className="container mx-auto max-w-xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-3">Top Competitors</h2>
            <p className="text-zinc-500 text-sm uppercase tracking-widest">This week&apos;s elite</p>
          </motion.div>

          <div className="space-y-2.5">
            {LEADERBOARD.map((entry, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.08 }} whileHover={{ x: 4 }}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-default ${i === 0
                  ? "border-yellow-500/25 bg-yellow-500/5 shadow-[0_0_20px_rgba(234,179,8,0.06)]"
                  : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                <span className={`text-base font-black min-w-[2rem] text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-600" : "text-zinc-600"}`}>
                  {i === 0 ? "👑" : `#${entry.rank}`}
                </span>
                <span className="flex-1 font-bold tracking-tight text-sm">{entry.name}</span>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${i === 0 ? "bg-yellow-500/20 text-yellow-400" : "bg-white/5 text-zinc-400"}`}>
                  {entry.label}
                </span>
                <span className="font-black text-lg tabular-nums text-cyan-400">{entry.score}</span>
                <span className="text-xs text-zinc-600 hidden sm:block font-bold">{entry.wins}W</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6 text-center text-zinc-700 text-xs uppercase tracking-widest">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 bg-gradient-to-br from-purple-600 to-cyan-400 rounded flex items-center justify-center">
            <Swords size={11} className="text-white" />
          </div>
          <span className="font-black text-zinc-500">Face-Off</span>
        </div>
        <p>© 2025 Face-Off — AI-Powered. Built for the mog era.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc, badge }: { icon: React.ReactNode; title: string; desc: string; badge?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      whileHover={{ y: -6, scale: 1.01 }} transition={{ type: "spring", stiffness: 300 }}
      className="p-8 glass-card border border-white/6 text-left group hover:border-white/12 transition-all cursor-default relative overflow-hidden">
      <div className="absolute top-4 right-4">
        {badge && <span className="text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full bg-white/5 text-zinc-500 border border-white/6">{badge}</span>}
      </div>
      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-5 group-hover:bg-white/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-lg font-black mb-2 uppercase tracking-tight">{title}</h3>
      <p className="text-zinc-500 leading-relaxed text-sm">{desc}</p>
    </motion.div>
  );
}
