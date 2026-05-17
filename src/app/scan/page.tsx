"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Zap, Trophy, AlertTriangle, ArrowLeft, Share2, Star, Target, Crown, Info, Activity, RotateCcw, ChevronLeft, ChevronRight, Send, MessageSquare, Bot, Sparkles, X, User, Loader2, Download, Calendar } from "lucide-react";
import { calculateScores, getRankLabel, getScoreColor, getRankColor, FacialMetrics, NLM } from "@/lib/scoring";
import { drawFaceMesh } from "@/lib/facemesh-utils";
import { downloadMoggingCard } from "@/lib/render-card";
import { useUser } from "@/components/UserContext";
import { HistoryGraph } from "@/components/HistoryGraph";
import { AuthModal } from "@/components/AuthModal";

type ScanPhase = "idle" | "front1" | "left" | "right" | "front2" | "analyzing" | "finished";

const PHASE_META: Record<string, { label: string; instruction: string; icon: string; color: string; duration: number }> = {
    front1: { label: "Front View", instruction: "Face the camera directly. Relax your expression.", icon: "●", color: "cyan", duration: 3 },
    left: { label: "Left Profile", instruction: "Slowly turn your head to the LEFT. Hold still.", icon: "◀", color: "purple", duration: 3 },
    right: { label: "Right Profile", instruction: "Slowly turn your head to the RIGHT. Hold still.", icon: "▶", color: "purple", duration: 3 },
    front2: { label: "Neutral Again", instruction: "Return to neutral. Final calibration scan.", icon: "●", color: "cyan", duration: 3 },
};

const PHASE_ORDER: ScanPhase[] = ["front1", "left", "right", "front2", "finished"];

function estimateYaw(lm: NLM[]): number {
    const nose = lm[1], lEar = lm[234], rEar = lm[454];
    if (!nose || !lEar || !rEar) return 0;
    const totalW = Math.abs(rEar.x - lEar.x);
    if (totalW < 0.01) return 0;
    const noseFromLeft = Math.abs(nose.x - lEar.x);
    return (noseFromLeft / totalW - 0.5) * 2;
}

function FaceCanvas({ videoRef, onLandmarks, active, mirrored }: { videoRef: React.RefObject<HTMLVideoElement | null>; onLandmarks: (lm: NLM[]) => void; active: boolean; mirrored?: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fmRef = useRef<any>(null);
    const rafRef = useRef<number | undefined>(undefined);
    const lastT = useRef(0);
    const cbRef = useRef(onLandmarks);

    useEffect(() => { cbRef.current = onLandmarks; }, [onLandmarks]);

    useEffect(() => {
        let alive = true;
        const origError = console.error.bind(console);
        console.error = (...args: any[]) => {
            if (typeof args[0] === "string" && (args[0].startsWith("INFO:") || args[0].includes("XNNPACK"))) return;
            origError(...args);
        };

        const init = async () => {
            try {
                const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
                const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm");
                let fl = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
                    outputFaceBlendshapes: false, runningMode: "VIDEO", numFaces: 1, minFaceDetectionConfidence: 0.55
                }).catch(() => FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "CPU" },
                    outputFaceBlendshapes: false, runningMode: "VIDEO", numFaces: 1
                }));

                if (!alive) { fl.close(); return; }
                fmRef.current = fl;

                const loop = (t: number) => {
                    if (!alive) return;
                    rafRef.current = requestAnimationFrame(loop);
                    if (t - lastT.current < 50) return;
                    lastT.current = t;
                    const v = videoRef.current;
                    const canvas = canvasRef.current;
                    if (!v || !canvas || v.readyState < 2) return;
                    try {
                        const results = fl.detectForVideo(v, performance.now());
                        const lms: NLM[] = results.faceLandmarks?.[0] ?? [];
                        if (canvas.width !== v.videoWidth) { canvas.width = v.videoWidth; canvas.height = v.videoHeight; }
                        const ctx = canvas.getContext("2d");
                        if (!ctx) return;
                        if (lms.length > 0) cbRef.current(lms);
                        if (mirrored) { ctx.save(); ctx.scale(-1, 1); ctx.translate(-canvas.width, 0); drawFaceMesh(ctx, lms, canvas.width, canvas.height, lms.length > 0); ctx.restore(); }
                        else drawFaceMesh(ctx, lms, canvas.width, canvas.height, lms.length > 0);
                    } catch (e) { }
                };
                rafRef.current = requestAnimationFrame(loop);
            } catch (e) { }
        };
        init();
        return () => { alive = false; console.error = origError; if (rafRef.current) cancelAnimationFrame(rafRef.current); fmRef.current?.close?.(); };
    }, []); // eslint-disable-line
    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ opacity: active ? 1 : 0 }} />;
}

export default function FaceScanPage() {
    const router = useRouter();
    const { profile, saveScan } = useUser();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const snapFront = useRef<NLM[]>([]);
    const snapLeft = useRef<NLM[]>([]);
    const snapRight = useRef<NLM[]>([]);
    const latestLms = useRef<NLM[]>([]);

    const [phase, setPhase] = useState<ScanPhase>("idle");
    const [timeLeft, setTimeLeft] = useState(3);
    const [scanResults, setScanResults] = useState<FacialMetrics | null>(null);
    const [camErr, setCamErr] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [noFace, setNoFace] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => {
        if (mounted) navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }).then(s => { streamRef.current = s; if (videoRef.current) videoRef.current.srcObject = s; }).catch(e => setCamErr(e.message));
        return () => streamRef.current?.getTracks().forEach(t => t.stop());
    }, [mounted]);

    useEffect(() => {
        if (!["front1", "left", "right", "front2"].includes(phase)) return;
        if (timeLeft <= 0) {
            const idx = PHASE_ORDER.indexOf(phase);
            const next = PHASE_ORDER[idx + 1];
            if (next === "finished") {
                const v = videoRef.current;
                if (v) { const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; const ctx = c.getContext("2d"); if (ctx) { ctx.scale(-1, 1); ctx.translate(-c.width, 0); ctx.drawImage(v, 0, 0); setCapturedPhoto(c.toDataURL("image/jpeg")); } }
                setPhase("analyzing");
                setTimeout(() => {
                    const res = calculateScores(snapFront.current.length > 0 ? snapFront.current : latestLms.current);
                    if (res) { setScanResults(res as FacialMetrics); saveScan(res.overall); }
                    setPhase("finished");
                }, 1500);
            } else {
                setPhase(next as ScanPhase);
                setTimeLeft(3);
                setScanProgress(0);
            }
            return;
        }
        const t = setTimeout(() => { setTimeLeft(prev => prev - 0.1); setScanProgress(prev => Math.min(100, prev + 3.33)); }, 100);
        return () => clearTimeout(t);
    }, [phase, timeLeft, saveScan]);

    if (!mounted) return <div className="min-h-screen bg-black" />;

    return (
        <div className="min-h-screen bg-black text-white flex flex-col font-sans overflow-x-hidden">
            <header className="p-5 flex justify-between items-center border-b border-white/5">
                <button onClick={() => router.push("/")} className="text-zinc-400 hover:text-white flex items-center gap-2 text-xs font-black uppercase"><ArrowLeft size={16} /> Home</button>
                <div className="flex items-center gap-2"><Activity size={16} className="text-cyan-400" /><span className="text-sm font-black uppercase italic">Face-Scan AI</span></div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6 relative">
                {phase === "finished" && scanResults ? (
                    <ScanResultsView metrics={scanResults} photo={capturedPhoto} onReset={() => setPhase("idle")} />
                ) : phase === "analyzing" ? (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-cyan-400" size={48} />
                        <h2 className="text-xl font-black uppercase italic">Analyzing Geometry...</h2>
                    </div>
                ) : (
                    <div className="w-full max-w-xl flex flex-col items-center gap-6">
                        <div className="relative w-full aspect-[3/4] rounded-[2.5rem] overflow-hidden border-2 border-white/10">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                            <FaceCanvas videoRef={videoRef} mirrored active={true} onLandmarks={lm => {
                                latestLms.current = lm;
                                if (phase === "front1" || phase === "front2") snapFront.current = lm;
                                else if (phase === "left") snapLeft.current = lm;
                                else if (phase === "right") snapRight.current = lm;
                                setNoFace(lm.length < 100);
                            }} />
                            {phase !== "idle" && (
                                <div className="absolute top-4 inset-x-4 bg-black/60 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase text-zinc-500">{PHASE_META[phase]?.label}</span>
                                        <span className="text-xs font-bold">{PHASE_META[phase]?.instruction}</span>
                                    </div>
                                    <span className="text-3xl font-black tabular-nums">{Math.ceil(timeLeft)}</span>
                                </div>
                            )}
                            <div className="absolute bottom-0 inset-x-0 h-1.5 bg-white/5"><motion.div className="h-full bg-cyan-400" initial={{ width: 0 }} animate={{ width: `${scanProgress}%` }} /></div>
                        </div>
                        {phase === "idle" && (
                            <button onClick={() => setPhase("front1")} disabled={noFace} className={`px-12 py-5 rounded-2xl font-black uppercase tracking-widest transition-all ${noFace ? "bg-zinc-900 text-zinc-700" : "bg-white text-black hover:scale-105 active:scale-95 shadow-xl"}`}>
                                Start Full Scan
                            </button>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

function FeatureBar({ label, score }: { label: string; score: number }) {
    const pct = (score / 10) * 100;
    const barColor =
        score >= 8.0 ? "bg-emerald-400" :
            score >= 7.0 ? "bg-cyan-400" :
                score >= 6.0 ? "bg-white" :
                    score >= 5.0 ? "bg-yellow-400" :
                        score >= 4.0 ? "bg-orange-400" : "bg-red-500";
    const textColor =
        score >= 8.0 ? "text-emerald-400" :
            score >= 7.0 ? "text-cyan-400" :
                score >= 6.0 ? "text-white" :
                    score >= 5.0 ? "text-yellow-400" :
                        score >= 4.0 ? "text-orange-400" : "text-red-400";
    return (
        <div className="flex items-center gap-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 w-24 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div className={`h-full rounded-full ${barColor}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
            </div>
            <span className={`text-xs font-black tabular-nums w-6 text-right ${textColor}`}>{score}</span>
        </div>
    );
}

function ScanResultsView({ metrics, photo, onReset }: { metrics: FacialMetrics, photo: string | null, onReset: () => void }) {
    const { profile, user } = useUser();
    const [showPlan, setShowPlan] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);

    const features = [
        { label: "Symmetry", score: metrics.symmetry },
        { label: "Jawline", score: metrics.jawline },
        { label: "Eye Area", score: metrics.eyeArea },
        { label: "Facial Thirds", score: metrics.harmonics },
        { label: "Canthal Tilt", score: metrics.canthalTilt ?? 5.5 },
        { label: "Midface", score: metrics.midfaceRatio ?? 5.5 },
        { label: "Philtrum", score: metrics.philtrum ?? 5.5 },
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl flex flex-col gap-8 relative">
            <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

            {/* Top: Photo + Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative group rounded-[2.5rem] overflow-hidden border border-white/10 aspect-[3/4] bg-zinc-900">
                    {photo ? <img src={photo} className="w-full h-full object-cover" alt="Scan" /> : <div className="w-full h-full flex items-center justify-center text-zinc-800 font-black uppercase">No Snapshot</div>}
                    <div className="absolute top-4 left-4 bg-black/80 px-4 py-2 rounded-2xl border border-white/10">
                        <div className="text-[10px] font-black uppercase text-zinc-500">Overall Rating</div>
                        <div className={`text-4xl font-black ${getScoreColor(metrics.overall)}`}>{metrics.overall}</div>
                    </div>
                    {metrics.percentile !== undefined && (
                        <div className="absolute top-4 right-4 bg-black/80 px-3 py-2 rounded-2xl border border-white/10 text-center">
                            <div className="text-[8px] font-black uppercase text-zinc-500">Percentile</div>
                            <div className="text-lg font-black text-purple-400">Top {100 - metrics.percentile}%</div>
                        </div>
                    )}
                    <div className="absolute bottom-4 inset-x-4 bg-black/60 backdrop-blur-md p-4 rounded-3xl border border-white/10">
                        <div className="text-[10px] font-black uppercase text-zinc-500 mb-1">Status</div>
                        <div className={`text-xl font-black uppercase italic tracking-tighter ${getRankColor(metrics.overall)}`}>{getRankLabel(metrics.overall)}</div>
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    {!user && (
                        <div className="bg-gradient-to-r from-purple-900/40 to-cyan-900/40 border border-white/10 p-5 rounded-3xl flex flex-col items-center gap-3 text-center">
                            <div className="text-[10px] font-black uppercase text-cyan-400 tracking-widest">Guest Progress</div>
                            <p className="text-xs text-zinc-400 italic">&quot;Log in to save your ELO and sync your scan history across devices.&quot;</p>
                            <button onClick={() => setAuthOpen(true)} className="px-6 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all">Sign In to Sync</button>
                        </div>
                    )}
                    <HistoryGraph history={profile.history} />
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 border border-white/10 p-4 rounded-3xl">
                            <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Potential</div>
                            <div className="text-2xl font-black text-cyan-400">{metrics.potentialScore}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-3xl">
                            <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Best Feature</div>
                            <div className="text-xs font-black text-white leading-tight">{metrics.bestFeature}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature Breakdown */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Feature Breakdown</h3>
                    <span className="text-[9px] text-zinc-600 font-black uppercase">Score / 10</span>
                </div>
                <div className="flex flex-col gap-3">
                    {features.map(f => <FeatureBar key={f.label} label={f.label} score={f.score} />)}
                </div>
            </div>

            {/* Strengths + Weaknesses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-3xl p-5">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-3">✦ Strengths</h3>
                    <ul className="flex flex-col gap-2">
                        {metrics.strengths.map((s, i) => (
                            <li key={i} className="text-[10px] text-zinc-300 font-bold flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />{s}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-red-950/40 border border-red-500/20 rounded-3xl p-5">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-3">✦ Weaknesses</h3>
                    <ul className="flex flex-col gap-2">
                        {metrics.weaknesses.map((w, i) => (
                            <li key={i} className="text-[10px] text-zinc-300 font-bold flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />{w}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* 30-Day Plan */}
            <button onClick={() => setShowPlan(!showPlan)} className="w-full py-4 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <Calendar size={18} /> {showPlan ? "Hide Improvement Plan" : "Generate 30-Day Plan"}
            </button>
            {showPlan && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-white/5 border border-purple-500/20 rounded-3xl p-6 text-zinc-300 text-xs italic leading-relaxed">
                    <p className="font-bold text-purple-400 mb-2 uppercase tracking-widest">PERSONALIZED STRATEGY:</p>
                    Focus on improving your {metrics.weaknesses[0] || "jawline definition"}. We recommend a 30-day regimen of specific facial posture exercises and optimized hydration to reach your {metrics.potentialScore} potential.
                </motion.div>
            )}

            <div className="flex gap-4 justify-center">
                <button onClick={onReset} className="px-10 py-4 bg-zinc-900 border border-white/10 rounded-2xl font-black uppercase tracking-widest text-xs">New Scan</button>
                <button onClick={() => downloadMoggingCard(metrics)} className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2"><Download size={16} /> Save Card</button>
            </div>
        </motion.div>
    );
}

