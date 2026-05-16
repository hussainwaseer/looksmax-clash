"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Zap, Trophy, AlertTriangle, ArrowLeft, Share2, Star, Target, Crown, Info, Activity, RotateCcw, ChevronLeft, ChevronRight, Send, MessageSquare, Bot, Sparkles, X, User, Loader2, Download } from "lucide-react";
import { calculateScores, getRankLabel, getScoreColor, getRankColor, FacialMetrics, NLM } from "@/lib/scoring";
import { drawFaceMesh } from "@/lib/facemesh-utils";
import { downloadMoggingCard } from "@/lib/render-card";


// ─── Scan phases ──────────────────────────────────────────────────────────────
type ScanPhase = "idle" | "front1" | "left" | "right" | "front2" | "analyzing" | "finished";

const PHASE_META: Record<string, { label: string; instruction: string; icon: string; color: string; duration: number }> = {
    front1: { label: "Front View", instruction: "Face the camera directly. Relax your expression.", icon: "●", color: "cyan", duration: 3 },
    left: { label: "Left Profile", instruction: "Slowly turn your head to the LEFT. Hold still.", icon: "◀", color: "purple", duration: 3 },
    right: { label: "Right Profile", instruction: "Slowly turn your head to the RIGHT. Hold still.", icon: "▶", color: "purple", duration: 3 },
    front2: { label: "Neutral Again", instruction: "Return to neutral. Final calibration scan.", icon: "●", color: "cyan", duration: 3 },
};

const PHASE_ORDER: ScanPhase[] = ["front1", "left", "right", "front2", "finished"];

// ─── Yaw estimation from landmarks (nose vs ear position) ────────────────────
function estimateYaw(lm: NLM[]): number {
    // Nose tip (1) vs left ear (234) and right ear (454)
    const nose = lm[1], lEar = lm[234], rEar = lm[454];
    if (!nose || !lEar || !rEar) return 0;
    const totalW = Math.abs(rEar.x - lEar.x);
    if (totalW < 0.01) return 0;
    const noseFromLeft = Math.abs(nose.x - lEar.x);
    // 0.5 = perfectly centered, <0.35 = turned right, >0.65 = turned left
    return (noseFromLeft / totalW - 0.5) * 2; // -1..+1
}

// ─── FaceCanvas ───────────────────────────────────────────────────────────────
function FaceCanvas({
    videoRef, onLandmarks, active, mirrored, phaseColor,
}: {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    onLandmarks: (lm: NLM[]) => void;
    active: boolean;
    mirrored?: boolean;
    phaseColor?: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fmRef = useRef<any>(null);
    const rafRef = useRef<number | undefined>(undefined);
    const lastT = useRef(0);
    const cbRef = useRef(onLandmarks);
    const TARGET_FPS = 20;

    useEffect(() => { cbRef.current = onLandmarks; }, [onLandmarks]);

    useEffect(() => {
        let alive = true;
        // Suppress MediaPipe INFO logs routed through console.error globally within this effect
        const origError = console.error.bind(console);
        console.error = (...args: any[]) => {
            if (typeof args[0] === "string" && (args[0].startsWith("INFO:") || args[0].includes("XNNPACK"))) return;
            origError(...args);
        };

        const init = async () => {
            try {
                const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
                );
                let fl: any;
                // Try GPU first, fall back to CPU
                try {
                    fl = await FaceLandmarker.createFromOptions(filesetResolver, {
                        baseOptions: {
                            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                            delegate: "GPU",
                        },
                        outputFaceBlendshapes: false,
                        runningMode: "VIDEO",
                        numFaces: 1,
                        minFaceDetectionConfidence: 0.55,
                        minFacePresenceConfidence: 0.55,
                        minTrackingConfidence: 0.55,
                    });
                } catch {
                    fl = await FaceLandmarker.createFromOptions(filesetResolver, {
                        baseOptions: {
                            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                            delegate: "CPU",
                        },
                        outputFaceBlendshapes: false,
                        runningMode: "VIDEO",
                        numFaces: 1,
                        minFaceDetectionConfidence: 0.55,
                        minFacePresenceConfidence: 0.55,
                        minTrackingConfidence: 0.55,
                    });
                    console.info("[FaceLandmarker] Using CPU delegate");
                }

                if (!alive) { fl.close(); return; }
                fmRef.current = fl;
                console.log("[FaceLandmarker] Initialized successfully");

                const loop = (t: number) => {
                    if (!alive) return;
                    rafRef.current = requestAnimationFrame(loop);
                    if (t - lastT.current < 1000 / TARGET_FPS) return;
                    lastT.current = t;

                    const v = videoRef.current;
                    const canvas = canvasRef.current;
                    if (!v || !canvas || v.readyState < 2 || v.videoWidth === 0 || v.videoHeight === 0) return;

                    try {
                        const results = fl.detectForVideo(v, performance.now());
                        const lms: NLM[] = results.faceLandmarks?.[0] ?? [];
                        const w = v.videoWidth;
                        const h = v.videoHeight;
                        if (canvas.width !== w || canvas.height !== h) {
                            canvas.width = w;
                            canvas.height = h;
                        }
                        const ctx = canvas.getContext("2d");
                        if (!ctx) return;

                        if (lms.length > 0) cbRef.current(lms);

                        if (mirrored) {
                            ctx.save();
                            ctx.scale(-1, 1);
                            ctx.translate(-w, 0);
                            drawFaceMesh(ctx, lms, w, h, lms.length > 0);
                            ctx.restore();
                        } else {
                            drawFaceMesh(ctx, lms, w, h, lms.length > 0);
                        }
                    } catch (e) {
                        console.warn("[FaceLandmarker] Frame error:", e);
                    }
                };
                rafRef.current = requestAnimationFrame(loop);
            } catch (e) {
                console.info("[FaceLandmarker] Init error:", e);
            }
        };

        init();
        return () => {
            alive = false;
            console.error = origError; // Restore original console.error
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            fmRef.current?.close?.();
        };
    }, []); // eslint-disable-line

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ opacity: active ? 1 : 0, transition: "opacity 0.4s" }}
        />
    );
}

// ─── Phase Progress Steps ─────────────────────────────────────────────────────
function PhaseSteps({ phase }: { phase: ScanPhase }) {
    const steps = [
        { key: "front1", label: "Front" },
        { key: "left", label: "Left" },
        { key: "right", label: "Right" },
        { key: "front2", label: "Final" },
    ];
    const idx = PHASE_ORDER.indexOf(phase);

    return (
        <div className="flex items-center gap-0">
            {steps.map((s, i) => {
                const done = idx > i;
                const active = idx === i;
                const pending = idx < i;
                return (
                    <div key={s.key} className="flex items-center">
                        <div className={`flex flex-col items-center gap-1 transition-all duration-500 ${active ? "scale-110" : ""}`}>
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all duration-500
                                ${done ? "border-emerald-400 bg-emerald-400/20 text-emerald-400"
                                    : active ? "border-cyan-400 bg-cyan-400/20 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                                        : "border-white/15 bg-white/5 text-zinc-600"}`}>
                                {done ? "✓" : i + 1}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${active ? "text-cyan-400" : done ? "text-emerald-400" : "text-zinc-600"}`}>
                                {s.label}
                            </span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`w-8 h-0.5 mx-1 mb-4 transition-all duration-500 ${done ? "bg-emerald-400/60" : "bg-white/10"}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Phase Instruction Overlay ────────────────────────────────────────────────
function PhaseInstruction({ phase, timeLeft }: { phase: ScanPhase; timeLeft: number }) {
    const meta = PHASE_META[phase];
    if (!meta) return null;

    const colorMap: Record<string, string> = {
        cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
        purple: "border-purple-500/40 bg-purple-500/10 text-purple-300",
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={phase}
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                className={`absolute top-4 inset-x-4 backdrop-blur-md rounded-2xl border px-5 py-3 flex items-center gap-3 z-20 ${colorMap[meta.color]}`}
            >
                {phase === "left" && <ChevronLeft size={20} className="shrink-0" />}
                {phase === "right" && <ChevronRight size={20} className="shrink-0" />}
                {(phase === "front1" || phase === "front2") && (
                    <div className="w-4 h-4 rounded-full border-2 border-current shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-70">{meta.label}</div>
                    <div className="text-xs font-semibold leading-tight">{meta.instruction}</div>
                </div>
                <div className="shrink-0 text-2xl font-black tabular-nums">{Math.ceil(timeLeft)}</div>
            </motion.div>
        </AnimatePresence>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FaceScanPage() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Per-phase landmark snapshots (best-quality frames)
    const snapFront1 = useRef<NLM[]>([]);
    const snapLeft = useRef<NLM[]>([]);
    const snapRight = useRef<NLM[]>([]);
    const snapFront2 = useRef<NLM[]>([]);
    const latestLms = useRef<NLM[]>([]);

    const [phase, setPhase] = useState<ScanPhase>("idle");
    const [timeLeft, setTimeLeft] = useState(3);
    const [scanResults, setScanResults] = useState<FacialMetrics | null>(null);
    const [camErr, setCamErr] = useState<string | null>(null);
    const [isHTTPS, setIsHTTPS] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [liveScore, setLiveScore] = useState<number | null>(null);
    const [noFace, setNoFace] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [yaw, setYaw] = useState(0);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined" && !window.isSecureContext && location.hostname !== "localhost")
            setIsHTTPS(false);
    }, []);

    const startCamera = useCallback(async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                audio: false,
            });
            streamRef.current = s;
            if (videoRef.current) videoRef.current.srcObject = s;
            return s;
        } catch (e: any) { setCamErr(e.message ?? "Camera denied"); return null; }
    }, []);

    useEffect(() => {
        if (mounted) startCamera();
        return () => streamRef.current?.getTracks().forEach(t => t.stop());
    }, [mounted, startCamera]);

    const beginScan = () => {
        if (noFace) return;
        // Reset all snapshots
        snapFront1.current = [];
        snapLeft.current = [];
        snapRight.current = [];
        snapFront2.current = [];
        setPhase("front1");
        setTimeLeft(3);
        setScanProgress(0);
        setCapturedPhoto(null);
    };

    const captureFrame = () => {
        if (!videoRef.current) return;
        const v = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            // Mirror flip the capture to match the mirrored preview
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            ctx.drawImage(v, 0, 0);
            setCapturedPhoto(canvas.toDataURL("image/jpeg", 0.9));
        }
    };


    // ── Phase timer ───────────────────────────────────────────────────────────
    useEffect(() => {
        const scanning = ["front1", "left", "right", "front2"].includes(phase);
        if (!scanning) return;

        if (timeLeft <= 0) {
            advancePhase(phase);
            return;
        }

        const phaseDuration = PHASE_META[phase]?.duration ?? 3;
        const t = setTimeout(() => {
            setTimeLeft(prev => prev - 0.1);
            setScanProgress(prev => Math.min(100, prev + (100 / (phaseDuration * 10))));
        }, 100);
        return () => clearTimeout(t);
    }, [phase, timeLeft]); // eslint-disable-line

    const advancePhase = (current: ScanPhase) => {
        const idx = PHASE_ORDER.indexOf(current);
        const next = PHASE_ORDER[idx + 1];
        if (next === "finished" || !next) {
            // All phases done — capture photo and compute final score
            captureFrame();
            setPhase("analyzing");
            setTimeout(() => computeFinalScore(), 1800);
        } else {

            setPhase(next as ScanPhase);
            setTimeLeft(PHASE_META[next as string]?.duration ?? 3);
            setScanProgress(0);
        }
    };

    // ── Collect landmarks per phase ───────────────────────────────────────────
    const onLandmarks = useCallback((lm: NLM[]) => {
        latestLms.current = lm;
        const y = estimateYaw(lm);
        setYaw(y);

        if (lm.length >= 200) {
            // Store best landmark sample per phase based on face quality
            if (phase === "front1") snapFront1.current = lm;
            if (phase === "left") snapLeft.current = lm;
            if (phase === "right") snapRight.current = lm;
            if (phase === "front2") snapFront2.current = lm;

            const sc = calculateScores(lm);
            if (sc) { setLiveScore(sc.overall); setNoFace(false); }
            else { setLiveScore(null); setNoFace(true); }
        } else {
            setLiveScore(null);
            setNoFace(true);
        }
    }, [phase]);

    // ── Final multi-angle score computation ───────────────────────────────────
    const computeFinalScore = () => {
        try {
            // Use best available front sample (prefer front2 as final calibration)
            const frontLm = snapFront2.current.length >= 200 ? snapFront2.current
                : snapFront1.current.length >= 200 ? snapFront1.current
                    : latestLms.current;

            if (frontLm.length < 200) {
                console.warn("[Compute] No valid face captured across phases.");
                setPhase("idle");
                setNoFace(true);
                return;
            }

            const base = calculateScores(frontLm);
            if (!base) {
                console.warn("[Compute] calculateScores returned null.");
                setPhase("idle");
                setNoFace(true);
                return;
            }

            // Enhance jaw score if we captured profiles
            let jawBonus = 0;
            if (snapLeft.current.length >= 200 || snapRight.current.length >= 200) {
                const profileLm = snapLeft.current.length >= 200 ? snapLeft.current : snapRight.current;
                const profileScore = calculateScores(profileLm);
                if (profileScore) {
                    const blendedJaw = parseFloat((base.jawline * 0.6 + profileScore.jawline * 0.4).toFixed(1));
                    jawBonus = blendedJaw - base.jawline;
                }
            }

            // Enhance symmetry if we have two front scans
            let symBonus = 0;
            if (snapFront1.current.length >= 200 && snapFront2.current.length >= 200) {
                const s1 = calculateScores(snapFront1.current);
                const s2 = calculateScores(snapFront2.current);
                if (s1 && s2) {
                    symBonus = ((s1.symmetry + s2.symmetry) / 2 - base.symmetry);
                }
            }

            const enhancedJaw = parseFloat(Math.min(10, Math.max(1.5, base.jawline + jawBonus)).toFixed(1));
            const enhancedSym = parseFloat(Math.min(10, Math.max(1.5, base.symmetry + symBonus)).toFixed(1));

            // Recompute overall with enhanced values
            // Ensure all values are strictly numbers using defaults if needed
            const s = (val: any) => typeof val === "number" && !isNaN(val) ? val : 5.5;

            const finalMetrics: FacialMetrics = {
                ...base,
                jawline: enhancedJaw,
                symmetry: enhancedSym,
                overall: parseFloat(((s(enhancedSym) + s(enhancedJaw) + s(base.eyeArea) + s(base.harmonics) + s(base.canthalTilt) + s(base.midfaceRatio) + s(base.philtrum)) / 7).toFixed(1)),
            };

            // Recalculate potential with new overall
            const potBonus = parseFloat(Math.min(2.5, (10 - finalMetrics.overall) * 0.4 + (base.weaknesses.length * 0.3)).toFixed(1));
            finalMetrics.potentialScore = parseFloat(Math.max(finalMetrics.overall + 0.3, Math.min(9.9, finalMetrics.overall + potBonus)).toFixed(1));

            // Save to history (now handled in ScanResults on mount, but we can also just let ScanResults check history array. Wait, if we save it here, ScanResults reads it. Let's keep it saving here so it's consistent)
            try {
                const histRaw = localStorage.getItem("looksmax_history");
                let hist = histRaw ? JSON.parse(histRaw) : [];
                hist.push({ date: new Date().toISOString(), overall: finalMetrics.overall, potential: finalMetrics.potentialScore });
                if (hist.length > 10) hist = hist.slice(hist.length - 10);
                localStorage.setItem("looksmax_history", JSON.stringify(hist));
            } catch (_) { }

            setScanResults(finalMetrics);
            setPhase("finished");
        } catch (e) {
            console.error("[Compute] Critical scoring error:", e);
            setPhase("idle");
            setNoFace(true);
        }
    };

    const isScanning = ["front1", "left", "right", "front2"].includes(phase);

    if (!mounted) return <div className="min-h-screen bg-black" />;

    return (
        <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden flex flex-col font-sans">
            {/* Ambient Glows */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/8 rounded-full blur-[120px]" />
                <div className="absolute inset-0 opacity-[0.02]"
                    style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
            </div>

            {/* Header */}
            <header className="relative z-50 p-5 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/5">
                <button onClick={() => router.push("/")} className="flex items-center gap-2 group transition-all">
                    <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                        <ArrowLeft size={18} className="text-zinc-400 group-hover:text-white" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-400 group-hover:text-white">Exit</span>
                </button>

                {/* Phase steps in header */}
                {phase !== "idle" && phase !== "finished" && (
                    <PhaseSteps phase={phase} />
                )}

                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-cyan-400 rounded-lg flex items-center justify-center">
                        <Activity size={16} className="text-white" />
                    </div>
                    <span className="text-sm font-black uppercase tracking-tighter italic">Face-Scan AI</span>
                </div>
            </header>

            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 gap-6">
                {phase === "finished" ? (
                    <ScanResults metrics={scanResults!} capturedPhoto={capturedPhoto} onReset={() => { setPhase("idle"); setScanResults(null); setLiveScore(null); }} />
                ) : phase === "analyzing" ? (

                    <AnalyzingOverlay />
                ) : (
                    <div className="w-full max-w-2xl flex flex-col items-center gap-6">

                        {/* Camera / Scanner */}
                        <div className={`relative w-full aspect-[3/4] md:aspect-video rounded-[2.5rem] overflow-hidden border-4 transition-all duration-700
                            ${phase === "left" ? "border-purple-400/60 shadow-[0_0_60px_rgba(168,85,247,0.2)] scale-[1.01]"
                                : phase === "right" ? "border-purple-400/60 shadow-[0_0_60px_rgba(168,85,247,0.2)] scale-[1.01]"
                                    : isScanning ? "border-cyan-400/60 shadow-[0_0_60px_rgba(34,211,238,0.2)] scale-[1.02]"
                                        : "border-white/10 shadow-2xl"}`}>

                            <video
                                ref={videoRef}
                                autoPlay playsInline muted
                                className="w-full h-full object-cover"
                                style={{ transform: "scaleX(-1)" }}
                            />
                            <FaceCanvas
                                videoRef={videoRef}
                                onLandmarks={onLandmarks}
                                active={true}
                                mirrored={true}
                                phaseColor={phase === "left" || phase === "right" ? "purple" : "cyan"}
                            />

                            {/* Phase instruction at top */}
                            {isScanning && <PhaseInstruction phase={phase} timeLeft={timeLeft} />}

                            {/* Idle target oval */}
                            {phase === "idle" && !noFace && (
                                <motion.div
                                    animate={{ scale: [1, 1.04, 1], opacity: [0.25, 0.55, 0.25] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                >
                                    <div className="w-48 h-64 border-2 border-white/20 rounded-[4rem] border-dashed" />
                                </motion.div>
                            )}

                            {/* Profile guide arrows */}
                            {(phase === "left" || phase === "right") && (
                                <motion.div
                                    animate={{ x: phase === "left" ? [-6, 6, -6] : [6, -6, 6] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                >
                                    <div className="text-purple-400/40 text-[100px] font-black select-none">
                                        {phase === "left" ? "◀" : "▶"}
                                    </div>
                                </motion.div>
                            )}

                            {/* No face warning */}
                            {noFace && isScanning && (
                                <div className="absolute inset-x-4 bottom-20 flex items-center gap-2 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-xl px-4 py-2">
                                    <AlertTriangle size={14} className="text-red-400 shrink-0" />
                                    <span className="text-red-300 text-[10px] font-bold uppercase tracking-widest">
                                        {phase === "left" || phase === "right" ? "Turn further — show profile" : "Position face in frame"}
                                    </span>
                                </div>
                            )}

                            {/* HUD bottom */}
                            <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none">
                                <div className="flex justify-between items-end">
                                    <div className="flex flex-col gap-1">
                                        <AnimatePresence mode="wait">
                                            {isScanning ? (
                                                <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                    className={`flex items-center gap-2 backdrop-blur-md px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest
                                                    ${phase === "left" || phase === "right" ? "bg-purple-500/20 border-purple-500/30 text-purple-300" : "bg-cyan-500/20 border-cyan-500/30 text-cyan-400"}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${phase === "left" || phase === "right" ? "bg-purple-400" : "bg-cyan-400"}`} />
                                                    Capturing {PHASE_META[phase]?.label}
                                                </motion.div>
                                            ) : (
                                                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                    className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                    {noFace ? "No Face Detected" : "Ready — Begin 4-Phase Scan"}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        {liveScore && <div className="text-2xl font-black tabular-nums">{liveScore}<span className="text-xs font-bold opacity-40 ml-1">/ 10</span></div>}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Head Angle</div>
                                        <div className={`text-sm font-bold ${Math.abs(yaw) < 0.12 ? "text-cyan-400" : "text-purple-400"}`}>
                                            {Math.abs(yaw) < 0.08 ? "Centered ●" : yaw > 0 ? `Left ${Math.round(Math.abs(yaw) * 90)}°` : `Right ${Math.round(Math.abs(yaw) * 90)}°`}
                                        </div>
                                    </div>
                                </div>

                                {/* Phase progress bar */}
                                {isScanning && (
                                    <div className="mt-4 w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <motion.div
                                            className={`h-full rounded-full ${phase === "left" || phase === "right" ? "bg-gradient-to-r from-purple-500 to-pink-400" : "bg-gradient-to-r from-cyan-500 to-blue-400"}`}
                                            initial={{ width: "0%" }}
                                            animate={{ width: `${scanProgress}%` }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Corner brackets */}
                            {isScanning && (
                                <div className="absolute inset-0 pointer-events-none">
                                    {[["top-3 left-3", "border-t-2 border-l-2 rounded-tl-lg"], ["top-3 right-3", "border-t-2 border-r-2 rounded-tr-lg"],
                                    ["bottom-3 left-3", "border-b-2 border-l-2 rounded-bl-lg"], ["bottom-3 right-3", "border-b-2 border-r-2 rounded-br-lg"]].map(([pos, cls]) => (
                                        <div key={pos} className={`absolute ${pos} w-5 h-5 ${cls} ${phase === "left" || phase === "right" ? "border-purple-400/70" : "border-cyan-400/70"}`} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col items-center gap-4 w-full">
                            {phase === "idle" && (
                                <>
                                    <button
                                        onClick={beginScan}
                                        disabled={noFace}
                                        className={`group relative py-5 px-14 rounded-[2rem] font-black uppercase tracking-widest transition-all overflow-hidden text-lg
                                            ${noFace ? "bg-zinc-900 border border-white/5 text-zinc-600" : "bg-white text-black hover:scale-105 active:scale-95 shadow-[0_0_50px_rgba(255,255,255,0.15)]"}`}
                                    >
                                        <span className="relative z-10 flex items-center gap-3">
                                            Begin 4-Phase Scan <Zap className={noFace ? "" : "text-cyan-600"} size={22} fill={noFace ? "none" : "currentColor"} />
                                        </span>
                                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-purple-600/10 to-cyan-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    </button>

                                    {/* Phase preview */}
                                    <div className="grid grid-cols-4 gap-2 w-full max-w-sm">
                                        {[
                                            { icon: "●", label: "Front", color: "cyan" },
                                            { icon: "◀", label: "Left", color: "purple" },
                                            { icon: "▶", label: "Right", color: "purple" },
                                            { icon: "●", label: "Final", color: "cyan" },
                                        ].map((s, i) => (
                                            <div key={i} className="flex flex-col items-center gap-1 bg-white/3 border border-white/5 rounded-2xl p-3">
                                                <span className={`text-lg ${s.color === "cyan" ? "text-cyan-500/60" : "text-purple-500/60"}`}>{s.icon}</span>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{s.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-zinc-600 text-[10px] text-center uppercase tracking-widest">4 poses · 3 seconds each · multi-angle analysis</p>
                                </>
                            )}

                            {isScanning && (
                                <button onClick={() => { setPhase("idle"); setScanProgress(0); setTimeLeft(3); }}
                                    className="text-zinc-600 hover:text-zinc-300 text-xs font-bold uppercase tracking-widest flex items-center gap-1 transition-colors">
                                    <RotateCcw size={12} /> Cancel Scan
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {camErr && (
                <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-8">
                    <div className="max-w-sm w-full bg-zinc-900 border border-red-500/30 p-8 rounded-3xl text-center">
                        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <p className="text-red-400 text-sm mb-6">{camErr}</p>
                        <button className="w-full py-3 bg-white text-black font-black uppercase rounded-xl" onClick={() => { setCamErr(null); startCamera(); }}>Retry</button>
                    </div>
                </div>
            )}

            {!isHTTPS && (
                <div className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-8 backdrop-blur-2xl">
                    <div className="max-w-md w-full bg-zinc-900 border border-red-500/30 p-10 rounded-[3rem] text-center shadow-2xl">
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                            <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Encryption Required</h2>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-10">AI face scanning requires HTTPS. Use your <span className="text-cyan-400">https://</span> URL.</p>
                        <button className="w-full py-5 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-200 transition-colors" onClick={() => location.reload()}>Retry Securely</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Analyzing Overlay ────────────────────────────────────────────────────────
function AnalyzingOverlay() {
    const steps = ["Processing Symmetry Matrix", "Mapping Mandibular Geometry", "Calibrating Orbital Ratios", "Running Golden Ratio Analysis", "Finalizing Score..."];
    const [step, setStep] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 320);
        return () => clearInterval(id);
    }, []); // eslint-disable-line

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-8 py-16">
            <div className="relative">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-24 h-24 rounded-full border-4 border-cyan-400/20 border-t-cyan-400"
                />
                <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-3 rounded-full border-4 border-purple-400/20 border-t-purple-400"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Activity size={24} className="text-white" />
                </div>
            </div>
            <div className="text-center">
                <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Analyzing 4-Angle Data</h3>
                <AnimatePresence mode="wait">
                    <motion.p key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-cyan-400/80 text-xs font-black uppercase tracking-widest">
                        {steps[step]}
                    </motion.p>
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// ─── Results ──────────────────────────────────────────────────────────────────
function ScanResults({ metrics, onReset, capturedPhoto }: { metrics: FacialMetrics; onReset: () => void; capturedPhoto: string | null }) {
    const scoreGrad = getScoreColor(metrics.overall);

    const rankColor = getRankColor(metrics.overall);
    const pct = metrics.percentile ?? 50;
    const isLowScore = metrics.overall < 5.5;
    const [isChatOpen, setIsChatOpen] = useState(false);

    // AI Plan & History State
    const [aiPlanString, setAiPlanString] = useState<string | null>(null);
    const [generatingPlan, setGeneratingPlan] = useState(false);
    const [scanHistory, setScanHistory] = useState<{ date: string; overall: number; potential: number }[]>([]);

    useEffect(() => {
        try {
            const h = localStorage.getItem("looksmax_history");
            if (h) setScanHistory(JSON.parse(h));
        } catch (_) { }
    }, []);

    const generateAIPlan = async () => {
        if (!metrics || generatingPlan || aiPlanString) return;
        setGeneratingPlan(true);
        try {
            const prompt = `Give me a concise 3-step actionable looksmaxxing plan to improve my ${metrics.overall}/10 rating to my ${metrics.potentialScore}/10 potential. My main structural weaknesses are: ${metrics.weaknesses.join(", ")}. Format strictly as 3 bullet points starting with "- ". Keep each point short and brutally honest.`;
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ metrics, messages: [{ role: "user", content: prompt }] })
            });
            const data = await res.json();
            if (data.content) setAiPlanString(data.content);
        } catch (err) {
            console.error("AI Plan Gen Error", err);
        } finally {
            setGeneratingPlan(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl flex flex-col gap-8 pb-12">

            {/* Main Score & Rank */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 relative group">
                    <div className={`absolute inset-0 rounded-[2.5rem] blur-xl opacity-40 group-hover:opacity-70 transition-opacity ${isLowScore ? "bg-red-900/30" : "bg-gradient-to-r from-purple-600/10 to-cyan-400/10"}`} />
                    <div className="relative bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center overflow-hidden h-full">

                        {/* Badges row */}
                        <div className="absolute top-5 inset-x-5 flex justify-between items-center">
                            <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                                <Crown className="text-yellow-400" size={12} />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-400">4-Angle Analysis</span>
                            </div>
                            {/* Percentile badge */}
                            <div className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest
                                ${pct >= 70 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    : pct >= 40 ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                                        : pct >= 20 ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                                            : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                                Top {100 - pct + 1}% · {pct}th percentile
                            </div>
                        </div>

                        <div className="text-zinc-500 text-[11px] font-black uppercase tracking-[0.3em] mb-4 mt-6">Overall Aesthetic Rating</div>

                        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }} className="flex items-baseline gap-2 mb-2">
                            <span className={`text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br ${scoreGrad}`}>
                                {metrics.overall}
                            </span>
                            <span className="text-2xl font-black text-zinc-700">/10</span>
                        </motion.div>

                        <div className={`text-2xl font-black italic uppercase tracking-tighter mb-6 ${rankColor}`}>
                            {getRankLabel(metrics.overall)}
                        </div>

                        {/* Honest note for low scores */}
                        {isLowScore && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                                className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 text-red-300 text-[10px] font-bold uppercase tracking-widest text-center">
                                ⚠ Multiple structural disadvantages detected
                            </motion.div>
                        )}

                        {/* Potential bar */}
                        <div className="flex items-center gap-5 w-full max-w-sm">
                            <div className="flex-1 h-2 bg-white/5 rounded-full relative overflow-hidden">
                                <motion.div
                                    className={`absolute left-0 h-full rounded-full bg-gradient-to-r ${scoreGrad} opacity-30`}
                                    initial={{ width: 0 }} animate={{ width: `${metrics.overall * 10}%` }}
                                    transition={{ duration: 1, delay: 0.5 }}
                                />
                                <motion.div
                                    className="absolute left-0 h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-300"
                                    initial={{ width: 0 }} animate={{ width: `${metrics.potentialScore * 10}%` }}
                                    transition={{ duration: 1.5, delay: 0.7 }}
                                />
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Max Potential</span>
                                <span className="text-lg font-black text-purple-400">{metrics.potentialScore}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest mt-3">
                            {isLowScore
                                ? `Realistically improvable to ~${metrics.potentialScore} via non-surgical methods`
                                : `+${(metrics.potentialScore - metrics.overall).toFixed(1)} optimization points available`}
                        </p>
                    </div>
                </div>

                {/* Best Feature Card */}
                <div className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-xl">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border mb-6
                        ${metrics.overall >= 7.0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-zinc-800/60 border-white/10"}`}>
                        <Trophy className={metrics.overall >= 7.0 ? "text-emerald-400" : "text-zinc-500"} size={28} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Strongest Feature</div>
                        <h3 className={`text-xl font-black uppercase tracking-tight mb-4 leading-tight ${rankColor}`}>{metrics.bestFeature}</h3>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            {metrics.overall >= 7.0 ? "Elite structural development detected across all scan angles."
                                : metrics.overall >= 5.5 ? "This is your relative best — still room to develop."
                                    : "Even with structural disadvantages, this area is your best asset."}
                        </p>
                    </div>
                    <div className="mt-6 pt-5 border-t border-white/5">
                        <div className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${rankColor}`}>
                            <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                            {pct >= 70 ? "Top Tier" : pct >= 40 ? "Mid Range" : pct >= 20 ? "Below Average" : "Below Median"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-5">
                    <h3 className="flex items-center gap-3 text-lg font-black uppercase tracking-tighter border-l-4 border-cyan-500 pl-4">Geometric Metrics</h3>
                    <div className="space-y-4 bg-zinc-900/40 p-7 rounded-[2rem] border border-white/5">
                        {[
                            { label: "Symmetry", value: metrics.symmetry, detail: "Bilateral deviation vs nose midline (2-scan avg)" },
                            { label: "Mandibular Angle", value: metrics.jawline, detail: "Gonion projection + jaw width ratio (profile scored)" },
                            { label: "Orbital Harmony", value: metrics.eyeArea, detail: "IPD ratio + Eye Aspect Ratio (hunter vs round)" },
                            { label: "Canthal Tilt", value: metrics.canthalTilt ?? 5.5, detail: "Inner/outer corner elevation (positive = attractive)" },
                            { label: "Midface Ratio", value: metrics.midfaceRatio ?? 5.5, detail: "Glabella-to-lip vs eye width (compact = better)" },
                            { label: "Philtrum/Chin", value: metrics.philtrum ?? 5.5, detail: "Lower third height ratio (ideal 2.0-2.5)" },
                        ].map((item, i) => {
                            const barColor =
                                item.value >= 8.0 ? "bg-emerald-400/70"
                                    : item.value >= 6.5 ? "bg-cyan-400/60"
                                        : item.value >= 5.0 ? "bg-yellow-400/60"
                                            : item.value >= 4.0 ? "bg-orange-400/70"
                                                : "bg-red-500/70";
                            return (
                                <div key={i} className="group relative">
                                    <div className="flex justify-between items-end mb-1.5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{item.label}</span>
                                            <span className="text-[9px] text-zinc-600 hidden group-hover:block">{item.detail}</span>
                                        </div>
                                        <span className={`text-sm font-black tabular-nums
                                            ${item.value >= 8.0 ? "text-emerald-400" : item.value >= 6.5 ? "text-white" : item.value >= 5.0 ? "text-yellow-400" : item.value >= 4.0 ? "text-orange-400" : "text-red-400"}`}>
                                            {item.value.toFixed(1)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            className={`h-full rounded-full ${barColor}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${item.value * 10}%` }}
                                            transition={{ duration: 1, delay: 0.08 * i }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col gap-5">
                    {/* Strengths */}
                    <div className="bg-emerald-500/[0.03] border border-emerald-500/10 p-6 rounded-[2rem]">
                        <div className="flex items-center gap-3 mb-3 text-emerald-400 text-xs font-black uppercase tracking-widest">
                            <Zap size={14} /> Key Strengths
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {metrics.strengths.map((s, i) => (
                                <span key={i} className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-xl border border-emerald-500/15">{s}</span>
                            ))}
                        </div>
                    </div>

                    {/* Weaknesses — honest severity coloring */}
                    <div className={`border p-6 rounded-[2rem] ${isLowScore ? "bg-red-500/[0.05] border-red-500/20" : "bg-orange-500/[0.03] border-orange-500/10"}`}>
                        <div className={`flex items-center gap-3 mb-3 text-xs font-black uppercase tracking-widest ${isLowScore ? "text-red-400" : "text-orange-400"}`}>
                            <Target size={14} /> {isLowScore ? "Structural Issues" : "Optimization Areas"}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {metrics.weaknesses.map((w, i) => {
                                const isSevere = w.startsWith("Significant") || w.startsWith("Severely") || w.startsWith("Poor Jaw");
                                return (
                                    <span key={i} className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border
                                        ${isSevere ? "bg-red-500/15 text-red-400 border-red-500/25" : "bg-orange-500/10 text-orange-400 border-orange-500/15"}`}>
                                        {w}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {/* Coach advice */}
                    <div className="bg-gradient-to-br from-purple-900/10 to-transparent border border-purple-500/10 p-6 rounded-[2rem] relative overflow-hidden">
                        <h4 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-3 flex items-center gap-2">
                            <Activity size={12} />
                            {isLowScore ? "Honest Looksmax Roadmap" : `Path to ${metrics.potentialScore} Tier`}
                        </h4>

                        {!aiPlanString && !generatingPlan && (
                            <div className="flex flex-col items-start gap-4">
                                <ul className="text-[11px] text-zinc-400 space-y-1.5 line-clamp-2 blur-[1px]">
                                    <li className="flex gap-2">• <span className="text-zinc-500">Body Fat:</span> Sub-15% BF reveals jaw & cheekbone definition (+0.5).</li>
                                    <li className="flex gap-2">• <span className="text-zinc-500">Mewing:</span> Consistent tongue posture develops maxilla over time.</li>
                                </ul>
                                <button
                                    onClick={generateAIPlan}
                                    className="w-full py-3 bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-purple-500/30 text-purple-300 font-black uppercase tracking-widest rounded-xl hover:bg-purple-500/20 transition-all text-[10px] flex items-center justify-center gap-2">
                                    <Sparkles size={14} /> Generate Personalized AI Plan
                                </button>
                            </div>
                        )}

                        {generatingPlan && (
                            <div className="flex items-center gap-3 py-4">
                                <Loader2 size={16} className="text-purple-400 animate-spin" />
                                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Querying Neural Engine...</span>
                            </div>
                        )}

                        {aiPlanString && (
                            <ul className="text-[11px] text-zinc-300 space-y-2">
                                {aiPlanString.split("\n").filter((l: string) => l.trim().length > 0).map((line: string, idx: number) => (
                                    <li key={idx} className="flex gap-2 leading-relaxed">
                                        <span className="text-purple-400 font-bold shrink-0">·</span>
                                        {line.replace(/^-\s*/, "").replace(/^\d+\.\s*/, "").replace(/\*\*/g, "")}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Scan History Chart */}
                    {scanHistory.length > 0 && (
                        <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem]">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                                <Activity size={12} /> Scan History (Last {scanHistory.length})
                            </h4>
                            <div className="flex gap-2 items-end h-[60px] overflow-hidden">
                                {scanHistory.map((sh: { overall: number, potential: number, date: string }, idx: number) => {
                                    const isCurrent = idx === scanHistory.length - 1;
                                    const hPercent = (sh.overall / 10) * 100;
                                    return (
                                        <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                                            <div className="w-full bg-white/5 rounded-t-sm relative flex items-end" style={{ height: "40px" }}>
                                                <div
                                                    className={`w-full rounded-t-sm transition-all ${isCurrent ? "bg-cyan-400" : "bg-white/20"} opacity-80 group-hover:opacity-100`}
                                                    style={{ height: `${hPercent}%` }}
                                                />
                                            </div>
                                            <div className="text-[8px] text-zinc-500 tabular-nums">
                                                {sh.overall.toFixed(1)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                            <button onClick={onReset} className="flex-1 py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-cyan-400 active:scale-95 transition-all text-xs">
                                Retake Scan
                            </button>
                            <button className="flex-1 py-4 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 active:scale-95 transition-all text-xs flex items-center justify-center gap-2">
                                <Share2 size={14} /> Share
                            </button>
                        </div>
                        <button
                            onClick={() => downloadMoggingCard(metrics, capturedPhoto || undefined)}
                            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                        >
                            <Download size={16} /> Download Premium Report Card
                        </button>
                    </div>



                    {/* AI Chat Link */}
                    <button
                        onClick={() => setIsChatOpen(true)}
                        className="group w-full py-5 bg-gradient-to-r from-purple-900/40 to-cyan-900/40 border border-purple-500/20 rounded-[2rem] flex items-center justify-center gap-4 hover:border-purple-500/40 transition-all active:scale-[0.98]"
                    >

                        <div className="p-2.5 bg-gradient-to-br from-purple-600 to-cyan-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                            <Bot size={20} className="text-white" />
                        </div>
                        <div className="text-left">
                            <div className="text-xs font-black uppercase tracking-widest text-white">Ask AI Guru</div>
                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Expert Analysis & Tips</div>
                        </div>
                        <ChevronRight className="ml-auto mr-4 text-zinc-600 group-hover:text-white transition-colors" size={20} />
                    </button>


                    <AIChat metrics={metrics} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
                </div>
            </div>
        </motion.div>
    );
}

// ─── AI Chat Component ────────────────────────────────────────────────────────
function AIChat({ metrics, isOpen, onClose }: { metrics: FacialMetrics; isOpen: boolean; onClose: () => void }) {
    const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([
        { role: "ai", content: `Analysis complete. I have mapped your data (${metrics.overall}/10). I am ready to discuss your structural strengths and optimization roadmap. What specific area should we analyze?` }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async (retryContent?: string) => {
        const userMsg = retryContent || input.trim();
        if (!userMsg || loading) return;

        if (!retryContent) setInput("");

        setMessages(prev => {
            const base = retryContent ? prev.filter(m => !(m as any).isError) : prev;
            return [...base, { role: "user", content: userMsg }];
        });
        setLoading(true);

        const attemptSend = async (retriesLeft = 3): Promise<void> => {
            try {
                // Keep last 10 messages for token efficiency (skipping initial greeting)
                const historyLimit = 10;
                const recentMessages = messages.length > historyLimit
                    ? [messages[0], ...messages.slice(-historyLimit)]
                    : messages;

                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        metrics,
                        messages: [...recentMessages, { role: "user", content: userMsg }]
                    })
                });

                if (res.status === 429 && retriesLeft > 0) {
                    // API is busy — wait 1.5s and retry silently
                    await new Promise(r => setTimeout(r, 1500));
                    return attemptSend(retriesLeft - 1);
                }

                const data = await res.json();
                if (data.content) {
                    setMessages(prev => [...prev, { role: "ai", content: data.content }]);
                } else {
                    const errMsg = data.message || "Unknown AI error.";
                    setMessages(prev => [...prev, {
                        role: "ai",
                        content: `⚠️ ${errMsg}`,
                        isError: true,
                        lastUserMsg: userMsg
                    } as any]);
                }
            } catch (error) {
                if (retriesLeft > 0) {
                    await new Promise(r => setTimeout(r, 2000));
                    return attemptSend(retriesLeft - 1);
                }
                setMessages(prev => [...prev, {
                    role: "ai",
                    content: "⚠️ Connection failed — check your internet or server sync.",
                    isError: true,
                    lastUserMsg: userMsg
                } as any]);
            }
        };

        await attemptSend();
        setLoading(false);
    };





    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                >
                    <div className="w-full max-w-xl bg-zinc-950 border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col h-[80vh] shadow-2xl">
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-cyan-900/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-br from-purple-600 to-cyan-500 rounded-xl shadow-lg">
                                    <Bot size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-white">AI Looksmax Guru</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                        <span className="text-[9px] font-black text-emerald-400/80 uppercase tracking-widest">Active System</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                            {messages.map((m: any, i) => (
                                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${m.role === "user" ? "bg-cyan-500/10 border-cyan-500/20"
                                            : m.isError ? "bg-red-500/10 border-red-500/20"
                                                : "bg-purple-500/10 border-purple-500/20"}`}>
                                            {m.role === "user" ? <User size={14} className="text-cyan-400" /> : m.isError ? <AlertTriangle size={14} className="text-red-400" /> : <Sparkles size={14} className="text-purple-400" />}
                                        </div>
                                        <div className={`p-4 rounded-2xl text-[13px] leading-relaxed ${m.role === "user" ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-50"
                                            : m.isError ? "bg-red-500/10 border border-red-500/20 text-red-300"
                                                : "bg-white/5 border border-white/10 text-zinc-300 shadow-sm"}`}>
                                            {m.content}
                                            {m.isError && m.lastUserMsg && (
                                                <button
                                                    onClick={() => handleSend(m.lastUserMsg)}
                                                    className="mt-3 block w-full py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/30 transition-all"
                                                >
                                                    Tap to Retry Sync
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="flex gap-3 max-w-[85%]">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border bg-purple-500/10 border-purple-500/20">
                                            <Loader2 size={14} className="text-purple-400 animate-spin" />
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-zinc-500 italic text-[11px] animate-pulse">
                                            Analyzing facial geometry...
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-4 bg-[#080808] border-t border-white/5">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleSend()}
                                    placeholder="Ask anything about your scan..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-zinc-600"
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || loading}
                                    className="absolute right-2 top-2 p-3 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-xl text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

