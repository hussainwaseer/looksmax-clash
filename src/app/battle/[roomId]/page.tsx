"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/components/SocketProvider";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Zap, Trophy, AlertTriangle, ArrowLeft, Share2, Flame, Skull } from "lucide-react";
import { calculateScores, getRankLabel, getScoreColor, getRankColor, FacialMetrics, NLM } from "@/lib/scoring";
import { drawFaceMesh } from "@/lib/facemesh-utils";
import { playCountdownBeep, playGoSound, playVictorySound, playDefeatSound, playTieSound, vibrate } from "@/lib/sounds";
import { downloadBattleCard } from "@/lib/render-battle-card";

const ICE: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // Free TURN relay — works across different networks/mobile data
        {
            urls: [
                "turn:openrelay.metered.ca:80",
                "turn:openrelay.metered.ca:443",
                "turn:openrelay.metered.ca:443?transport=tcp",
            ],
            username: "openrelayproject",
            credential: "openrelayproject",
        },
    ],
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 10
};
const getRoomId = (r: string | string[] | undefined) => (Array.isArray(r) ? r[0] : r) ?? "";

// ── FaceCanvas: runs MediaPipe FaceLandmarker on a video, draws green-dot overlay ─
function FaceCanvas({
    videoRef, onLandmarks, active, mirrored, onReady, onLoading
}: {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    onLandmarks: (lm: NLM[]) => void;
    active: boolean;
    mirrored?: boolean;
    onReady?: (ready: boolean) => void;
    onLoading?: (loading: boolean) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fmRef = useRef<any>(null);
    const rafRef = useRef<number | undefined>(undefined);
    const lastT = useRef(0);
    const cbRef = useRef(onLandmarks);
    const TARGET_FPS = 24;
    const faceDetectedOnce = useRef(false);
    const lastW = useRef(0);
    const lastH = useRef(0);

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
            if (onLoading) onLoading(true);
            try {
                const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
                );

                let fl: any;
                // Try GPU first, fall back to CPU
                try {
                    fl = await FaceLandmarker.createFromOptions(filesetResolver, {
                        baseOptions: {
                            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                            delegate: 'GPU',
                        },
                        outputFaceBlendshapes: false,
                        runningMode: 'VIDEO',
                        numFaces: 1,
                        minFaceDetectionConfidence: 0.55,
                        minFacePresenceConfidence: 0.55,
                        minTrackingConfidence: 0.55,
                    });
                } catch {
                    fl = await FaceLandmarker.createFromOptions(filesetResolver, {
                        baseOptions: {
                            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                            delegate: 'CPU',
                        },
                        outputFaceBlendshapes: false,
                        runningMode: 'VIDEO',
                        numFaces: 1,
                        minFaceDetectionConfidence: 0.55,
                        minFacePresenceConfidence: 0.55,
                        minTrackingConfidence: 0.55,
                    });
                    console.info('[FaceLandmarker] Using CPU delegate');
                }

                if (!alive) { fl.close(); return; }
                fmRef.current = fl;
                console.log('[FaceLandmarker] Initialized');
                if (onLoading) onLoading(false);

                const loop = (t: number) => {
                    if (!alive) return;
                    rafRef.current = requestAnimationFrame(loop);
                    if (t - lastT.current < 1000 / TARGET_FPS) return;
                    lastT.current = t;

                    const v = videoRef.current;
                    const canvas = canvasRef.current;
                    // v.readyState < 2 or missing dimensions causes detectForVideo to throw
                    if (!v || !canvas || v.readyState < 2 || v.videoWidth === 0 || v.videoHeight === 0) return;

                    try {
                        const results = fl.detectForVideo(v, performance.now());
                        const lms: NLM[] = results.faceLandmarks?.[0] ?? [];

                        // Only resize canvas when video dimensions change (avoids repaint every frame)
                        const w = v.videoWidth;
                        const h = v.videoHeight;
                        if (w !== lastW.current || h !== lastH.current) {
                            canvas.width = w;
                            canvas.height = h;
                            lastW.current = w;
                            lastH.current = h;
                        }

                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;

                        if (lms.length > 0) {
                            if (!faceDetectedOnce.current) {
                                faceDetectedOnce.current = true;
                                if (onReady) onReady(true);
                            }
                            cbRef.current(lms);
                        }

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
                        console.warn('[FaceLandmarker] Frame error:', e);
                    }
                };
                rafRef.current = requestAnimationFrame(loop);
            } catch (e) {
                console.info('[FaceLandmarker] Init error:', e);
                if (onLoading) onLoading(false);
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
            style={{
                opacity: active ? 1 : 0,
                transition: "opacity 0.4s",
                // No CSS transform — ctx.scale(-1,1) in drawing already handles the mirror.
                // Adding CSS scaleX(-1) here would double-flip landmarks off the face.
            }}
        />
    );
}


// ── Particle burst for countdown GO ──────────────────────────────────────────
function Particles({ active }: { active: boolean }) {
    if (!active) return null;
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                        left: "50%", top: "50%",
                        background: i % 3 === 0 ? "#00ffcc" : i % 3 === 1 ? "#9d00ff" : "#ffffff",
                    }}
                    initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                    animate={{
                        x: (Math.random() - 0.5) * 600,
                        y: (Math.random() - 0.5) * 600,
                        scale: 0,
                        opacity: 0,
                    }}
                    transition={{ duration: 0.8 + Math.random() * 0.5, ease: "easeOut" }}
                />
            ))}
        </div>
    );
}

// ── Main Battle Page ──────────────────────────────────────────────────────────
export default function BattlePage() {
    const params = useParams();
    const roomId = getRoomId(params?.roomId as string | string[]);
    const socket = useSocket();
    const router = useRouter();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isOfferer = useRef(false);
    const finishDone = useRef(false);
    const latestLandmarks = useRef<NLM[]>([]);
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
    const remoteDescriptionSet = useRef(false);

    const [status, setStatus] = useState<"waiting" | "countdown" | "battling" | "finished">("waiting");
    const [timeLeft, setTimeLeft] = useState(20);
    const [countdown, setCountdown] = useState(3);
    const [playerCount, setPlayerCount] = useState(1);
    const [userScores, setUserScores] = useState<FacialMetrics | null>(null);
    const [oppScores, setOppScores] = useState<FacialMetrics | null>(null);
    const [winner, setWinner] = useState<"user" | "opponent" | "tie" | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isHTTPS, setIsHTTPS] = useState(true);
    const [remoteOk, setRemoteOk] = useState(false);
    const [rtcState, setRtcState] = useState<RTCPeerConnectionState>("new");
    const [camErr, setCamErr] = useState<string | null>(null);
    const [moggingLevel, setMoggingLevel] = useState(50);
    const [moggingLabel, setMoggingLabel] = useState<"mogging" | "even" | "mogged">("even");
    const [showParticles, setShowParticles] = useState(false);
    const [scanCount, setScanCount] = useState(0);
    const [liveScore, setLiveScore] = useState<number | null>(null);
    const [noFaceDetected, setNoFaceDetected] = useState(false);
    const [localFaceReady, setLocalFaceReady] = useState(false);
    const [aiLoading, setAiLoading] = useState(true);
    const [localSnapshot, setLocalSnapshot] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined" && !window.isSecureContext && location.hostname !== "localhost")
            setIsHTTPS(false);
    }, []);

    // ── Scan counter for HUD immersion ───────────────────────────────────────
    useEffect(() => {
        if (status !== "battling") return;
        const id = setInterval(() => setScanCount(c => c + 1), 800);
        return () => clearInterval(id);
    }, [status]);

    const initializingCamera = useRef<Promise<MediaStream | null> | null>(null);
    const initializingPC = useRef<Promise<RTCPeerConnection | null> | null>(null);

    // ── Camera ───────────────────────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        if (streamRef.current) return streamRef.current;
        if (initializingCamera.current) return initializingCamera.current;

        initializingCamera.current = (async () => {
            try {
                const s = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
                    audio: false,
                });
                streamRef.current = s;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = s;
                }
                return s;
            } catch (e: any) {
                setCamErr(e.message ?? "Camera denied");
                return null;
            } finally {
                initializingCamera.current = null;
            }
        })();

        return initializingCamera.current;
    }, []);

    // ── WebRTC ───────────────────────────────────────────────────────────────
    const buildPC = useCallback(async () => {
        if (pcRef.current) return pcRef.current;
        if (initializingPC.current) return initializingPC.current;

        initializingPC.current = (async () => {
            try {
                const s = streamRef.current || await startCamera();
                if (!s) return null;

                const pc = new RTCPeerConnection(ICE);
                pcRef.current = pc;
                s.getTracks().forEach(t => pc.addTrack(t, s));

                pc.ontrack = e => {
                    console.log("[WebRTC] Track received:", e.streams[0]?.id);
                    const vid = remoteVideoRef.current;
                    if (vid && e.streams[0]) {
                        vid.srcObject = e.streams[0];
                        // Primary play attempt
                        vid.play().catch(() => {
                            // Fallback: play on canplay event (browser policy)
                            const tryPlay = () => {
                                vid.play().catch(err => console.warn('[WebRTC] remoteVideo.play() fallback failed:', err));
                                vid.removeEventListener('canplay', tryPlay);
                            };
                            vid.addEventListener('canplay', tryPlay);
                        });
                        setRemoteOk(true);
                    }
                };
                pc.onicecandidate = e => {
                    if (e.candidate) {
                        socket.emit("send-signal", { roomId, signal: { type: "candidate", candidate: e.candidate } });
                    }
                };
                pc.onconnectionstatechange = () => {
                    const state = pc.connectionState;
                    console.log("[WebRTC] Connection state:", state);
                    setRtcState(state);
                    if (state === "connected" || (state as string) === "completed") {
                        setRemoteOk(true);
                        socket.emit("peer-connected", roomId);
                    }
                };
                // Fallback: some browsers use iceConnectionState instead of connectionState
                pc.oniceconnectionstatechange = () => {
                    const s = pc.iceConnectionState;
                    console.log("[WebRTC] ICE connection state:", s);
                    if (s === "connected" || s === "completed") {
                        setRemoteOk(true);
                    }
                };
                return pc;
            } catch (e) {
                console.error("[WebRTC] buildPC error:", e);
                return null;
            } finally {
                initializingPC.current = null;
            }
        })();

        return initializingPC.current;
    }, [socket, roomId, startCamera]);

    const sendOffer = useCallback(async () => {
        const pc = await buildPC(); if (!pc) return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("send-signal", { roomId, signal: { type: "offer", sdp: offer } });
    }, [buildPC, socket, roomId]);

    const retryConnection = useCallback(async () => {
        console.log("[WebRTC] Manually retrying connection...");
        pcRef.current?.close();
        pcRef.current = null;
        setRemoteOk(false);
        setRtcState("new");
        const pc = await buildPC();
        if (pc && isOfferer.current) {
            await sendOffer();
        }
    }, [buildPC, sendOffer]);

    const sendReady = useCallback(() => {
        // Server deduplicates — safe to call multiple times
        socket.emit("player-ready", roomId);
    }, [socket, roomId]);

    // ── Socket listeners ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!mounted || !roomId) return;
        startCamera();

        const onPlayerJoined = (d: any) => setPlayerCount(d.playerCount);
        const onJoinedInfo = (d: any) => { setPlayerCount(d.playerCount); };
        // When room is ready (2 players joined), both sides build PC so offer/answer is snappy
        const onRoomReady = async () => {
            setPlayerCount(2);
            await buildPC(); // answerer pre-builds peer connection
        };
        const onCountdown = () => setStatus("countdown");
        const onShouldOffer = async () => { isOfferer.current = true; await sendOffer(); };
        const onSignal = async ({ signal }: any) => {
            console.log("[Socket] Signal received:", signal.type);
            let pc = pcRef.current; if (!pc) pc = await buildPC(); if (!pc) return;

            if (signal.type === "offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                remoteDescriptionSet.current = true;
                const ans = await pc.createAnswer();
                await pc.setLocalDescription(ans);
                socket.emit("send-signal", { roomId, signal: { type: "answer", sdp: ans } });
                while (pendingCandidates.current.length > 0) {
                    const cand = pendingCandidates.current.shift();
                    if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.warn("[WebRTC] queued candidate error", e));
                }
            } else if (signal.type === "answer") {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                remoteDescriptionSet.current = true;
                while (pendingCandidates.current.length > 0) {
                    const cand = pendingCandidates.current.shift();
                    if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.warn("[WebRTC] queued candidate error", e));
                }
            } else if (signal.type === "candidate") {
                if (remoteDescriptionSet.current) {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(e => console.warn("[WebRTC] candidate error", e));
                } else {
                    pendingCandidates.current.push(signal.candidate);
                }
            }
        };
        const onOppScore = ({ metrics }: { metrics: FacialMetrics }) => setOppScores(metrics);
        const onPlayerLeft = () => setPlayerCount(n => Math.max(0, n - 1));

        socket.on("player-joined", onPlayerJoined);
        socket.on("joined-room-info", onJoinedInfo);
        socket.on("room-ready", onRoomReady);
        socket.on("start-countdown", onCountdown);
        socket.on("should-create-offer", onShouldOffer);
        socket.on("receive-signal", onSignal);
        socket.on("opponent-score", onOppScore);
        socket.on("player-left", onPlayerLeft);

        // Sync room state on mount
        socket.emit("join-room", roomId);

        return () => {
            socket.off("player-joined", onPlayerJoined);
            socket.off("joined-room-info", onJoinedInfo);
            socket.off("room-ready", onRoomReady);
            socket.off("start-countdown", onCountdown);
            socket.off("should-create-offer", onShouldOffer);
            socket.off("receive-signal", onSignal);
            socket.off("opponent-score", onOppScore);
            socket.off("player-left", onPlayerLeft);
        };
    }, [mounted, socket, roomId, buildPC, startCamera, sendOffer]); // eslint-disable-line

    // ── Send ready when face is detected (does NOT wait for WebRTC — server triggers countdown) ──
    useEffect(() => {
        if (localFaceReady && playerCount >= 2) {
            // Signal ready immediately — WebRTC video link can finalize independently in parallel
            sendReady();
        }
    }, [localFaceReady, playerCount, sendReady]);

    // ── Countdown — with sound effects ──────────────────────────────────────
    useEffect(() => {
        if (status !== "countdown") return;
        if (countdown > 0) {
            playCountdownBeep(countdown);
            vibrate(60);
            const t = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(t);
        }
        // countdown === 0 means "GO!"
        playGoSound();
        vibrate([80, 40, 80]);
        const t = setTimeout(() => {
            setShowParticles(true);
            setStatus("battling");
            setTimeout(() => setShowParticles(false), 900);
        }, 800);
        return () => clearTimeout(t);
    }, [status, countdown, sendOffer]);

    // ── Battle Timer — FIXED: only runs during "battling" ────────────────────
    useEffect(() => {
        if (status !== "battling") return;
        if (timeLeft <= 0) {
            if (!finishDone.current) { finishDone.current = true; finish(); }
            return;
        }
        const t = setTimeout(() => setTimeLeft(n => n - 1), 1000);
        return () => clearTimeout(t);
    }, [status, timeLeft]); // eslint-disable-line

    // ── Mogging Bar — animated random during battle (scoring at end) ──────────
    useEffect(() => {
        if (status !== "battling") return;
        const id = setInterval(() => {
            setMoggingLevel(prev => {
                const next = Math.max(5, Math.min(95, prev + (Math.random() - 0.47) * 22));
                setMoggingLabel(next >= 60 ? "mogging" : next <= 40 ? "mogged" : "even");
                return next;
            });
        }, 1600);
        return () => clearInterval(id);
    }, [status]);

    // ── Winner resolution — with sound effects ───────────────────────────────
    useEffect(() => {
        if (userScores && oppScores && status === "finished" && winner === null) {
            const w = userScores.overall > oppScores.overall ? "user" : userScores.overall < oppScores.overall ? "opponent" : "tie";
            setWinner(w);
            // Sound + haptic
            if (w === "user") { playVictorySound(); vibrate([100, 50, 100, 50, 200]); }
            else if (w === "opponent") { playDefeatSound(); vibrate([300]); }
            else { playTieSound(); vibrate([100, 50, 100]); }
            // Capture local snapshot for share card
            if (localVideoRef.current) {
                const v = localVideoRef.current;
                const sc = document.createElement("canvas");
                sc.width = v.videoWidth; sc.height = v.videoHeight;
                const sctx = sc.getContext("2d");
                if (sctx) { sctx.scale(-1, 1); sctx.translate(-sc.width, 0); sctx.drawImage(v, 0, 0); setLocalSnapshot(sc.toDataURL("image/jpeg", 0.85)); }
            }
            const myS = userScores.overall; const oppS = oppScores.overall;
            const total = myS + oppS;
            setMoggingLevel(total > 0 ? Math.round((myS / total) * 100) : 50);
        }
    }, [userScores, oppScores, status, winner]);

    const finish = () => {
        setStatus("finished");
        // Ensure we calculate the final score from the last known landmarks
        const my = calculateScores(latestLandmarks.current);
        if (my) {
            setUserScores(my);
            socket.emit("share-score", { roomId, metrics: my });
        } else {
            // Fallback if no face was ever detected
            const fallback: FacialMetrics = {
                symmetry: 0, jawline: 0, eyeArea: 0, harmonics: 0,
                canthalTilt: 0, midfaceRatio: 0, philtrum: 0,
                overall: 0, potentialScore: 0, bestFeature: "None",
                strengths: ["None Detected"], weaknesses: ["No Face Scanned"], method: 'geometric'
            };
            setUserScores(fallback);
            socket.emit("share-score", { roomId, metrics: fallback });
        }
    };

    useEffect(() => () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        pcRef.current?.close();
    }, []);

    if (!mounted) return <div className="min-h-screen bg-black" />;

    const urgentTimer = timeLeft <= 5 && status === "battling";

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
            {/* Ambient background glow */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-purple-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-900/15 rounded-full blur-[100px]" />
                {urgentTimer && (
                    <motion.div
                        className="absolute inset-0 bg-red-900/10"
                        animate={{ opacity: [0, 0.4, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                    />
                )}
            </div>

            {/* Back */}
            <button onClick={() => router.push("/")} className="fixed top-5 left-5 z-50 flex items-center gap-2 text-zinc-600 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
                <ArrowLeft size={14} /> Home
            </button>

            {/* Room ID badge */}
            <div className="fixed top-5 right-5 z-50">
                <div className="bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Room: <span className="text-cyan-400">{roomId}</span>
                </div>
            </div>

            {/* Top HUD Bar */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 flex-wrap justify-center">
                {/* Timer */}
                <motion.div
                    animate={urgentTimer ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.4, repeat: Infinity }}
                    className={`bg-black/80 backdrop-blur-xl px-5 py-2 rounded-full border flex items-center gap-2.5 shadow-lg ${urgentTimer ? "border-red-500/60 shadow-red-900/30" : "border-white/10"}`}
                >
                    <Timer className={`w-4 h-4 ${urgentTimer ? "text-red-500 animate-pulse" : "text-cyan-400"}`} />
                    <span className={`font-mono text-xl font-black tabular-nums ${urgentTimer ? "text-red-400" : "text-white"}`}>
                        {status === "battling" ? `${timeLeft}s` : status === "waiting" ? "--" : status === "countdown" ? "..." : "✓"}
                    </span>
                </motion.div>

                {/* Status badge */}
                {status === "waiting" && (
                    <div className="bg-cyan-500/10 px-4 py-2 rounded-full border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-widest animate-pulse">
                        {aiLoading ? (
                            "⏳ Initializing AI..."
                        ) : !localFaceReady ? (
                            "📸 Face Detection Required"
                        ) : playerCount < 2 ? (
                            "⌛ Waiting for Opponent..."
                        ) : !remoteOk ? (
                            "🔗 Syncing Video Feed... (match starting)"
                        ) : (
                            "✅ Ready — Match starting!"
                        )}
                    </div>
                )}
                {status === "battling" && (
                    <div className="flex items-center gap-2 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/30">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">LIVE BATTLE</span>
                    </div>
                )}
            </div>

            {/* Mogging Bar — shows during battle */}
            <AnimatePresence>
                {(status === "battling" || status === "finished") && (
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="absolute top-[68px] left-1/2 -translate-x-1/2 z-40 w-full max-w-xs px-4"
                    >
                        <div className="flex justify-between mb-1">
                            <motion.span animate={{ scale: moggingLabel === "mogged" ? 1.12 : 1 }}
                                className={`text-[9px] font-black uppercase tracking-widest ${moggingLabel === "mogged" ? "text-red-400" : "text-zinc-600"}`}>
                                {moggingLabel === "mogged" ? "😭 Losing" : "Opp"}
                            </motion.span>
                            <motion.span animate={{ scale: moggingLabel === "mogging" ? 1.12 : 1 }}
                                className={`text-[9px] font-black uppercase tracking-widest ${moggingLabel === "mogging" ? "text-emerald-400" : "text-zinc-600"}`}>
                                {moggingLabel === "mogging" ? "Winning 🫵" : "You"}
                            </motion.span>
                        </div>
                        <div className="relative h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/8">
                            <motion.div animate={{ width: `${100 - moggingLevel}%` }} transition={{ duration: 0.7, ease: "easeInOut" }}
                                className="absolute left-0 top-0 h-full rounded-full" style={{ background: "linear-gradient(to right,#ef4444,#f97316)" }} />
                            <motion.div animate={{ width: `${moggingLevel}%` }} transition={{ duration: 0.7, ease: "easeInOut" }}
                                className="absolute right-0 top-0 h-full rounded-full" style={{ background: "linear-gradient(to left,#10b981,#06b6d4)" }} />
                            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30 -translate-x-1/2 z-10" />
                        </div>
                        <div className="flex justify-center mt-1">
                            <motion.div key={moggingLabel} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${moggingLabel === "mogging"
                                    ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                    : moggingLabel === "mogged" ? "bg-red-500/20 border-red-500/30 text-red-400"
                                        : "bg-white/5 border-white/10 text-zinc-500"}`}>
                                {moggingLabel === "mogging" ? "🔥 Dominating" : moggingLabel === "mogged" ? "💀 Opponent Winning" : "⚔️ Neck & Neck"}
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Battle Arena ── */}
            <div className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 pt-[116px] pb-2 px-2">

                {/* YOU */}
                <div className={`relative overflow-hidden rounded-2xl bg-zinc-950 min-h-[40vh] transition-all duration-500 ${status === "battling" && moggingLabel === "mogging"
                    ? "border-2 border-emerald-400/60 shadow-[0_0_40px_rgba(52,211,153,0.2)]"
                    : status === "battling" && moggingLabel === "mogged"
                        ? "border-2 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                        : "border-2 border-white/8"}`}>

                    {camErr ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950">
                            <AlertTriangle className="text-red-500" size={40} />
                            <p className="text-red-400 text-sm text-center px-6">{camErr}</p>
                            <button onClick={() => { setCamErr(null); startCamera(); }} className="px-4 py-2 bg-white/10 rounded-lg text-xs uppercase font-bold hover:bg-white/20 transition-colors">Retry</button>
                        </div>
                    ) : (
                        <>
                            {/* ✅ FIX: Mirror local video so it feels like a natural selfie-mirror */}
                            <video
                                ref={localVideoRef}
                                autoPlay playsInline muted
                                className="w-full h-full object-cover"
                                style={{ transform: "scaleX(-1)" }}
                            />
                            {/* FaceCanvas is NOT mirrored in transform — its drawing is flipped internally */}
                            <FaceCanvas
                                videoRef={localVideoRef}
                                onLandmarks={lm => {
                                    latestLandmarks.current = lm;
                                    if (status === "battling") {
                                        const s = calculateScores(lm);
                                        setLiveScore(s?.overall ?? null);
                                        setNoFaceDetected(!s);
                                    } else {
                                        setNoFaceDetected(lm.length < 100);
                                    }
                                }}
                                active={status === "battling" || status === "waiting"}
                                mirrored={true}
                                onLoading={setAiLoading}
                                onReady={setLocalFaceReady}
                            />
                            {/* LIVE RATING OVERLAY */}
                            {status === "battling" && liveScore !== null && !noFaceDetected && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={`absolute top-4 left-4 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 shadow-xl z-20 bg-gradient-to-br ${getScoreColor(liveScore)}`}
                                >
                                    <div className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-0.5">Live Rating</div>
                                    <div className="text-3xl font-black text-white leading-none">{liveScore} <span className="text-sm font-bold opacity-70">/ 10</span></div>
                                </motion.div>
                            )}

                            {/* NO FACE DETECTED OVERLAY */}
                            {noFaceDetected && (status === "battling" || status === "countdown") && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-30 p-6 text-center">
                                    <motion.div
                                        animate={{ scale: [1, 1.1, 1] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                        className="bg-red-500/20 p-4 rounded-full mb-4 border border-red-500/40"
                                    >
                                        <AlertTriangle className="text-red-500" size={40} />
                                    </motion.div>
                                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">Face Not Detected</h3>
                                    <p className="text-zinc-300 text-xs uppercase font-bold tracking-widest max-w-[200px]">Position your face clearly in the camera to receive a rating</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Win glow ring */}
                    {status === "battling" && moggingLabel === "mogging" && (
                        <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute inset-0 pointer-events-none rounded-2xl border-2 border-emerald-400/60" />
                    )}

                    {/* HUD scan info */}
                    <div className="absolute bottom-3 left-3 flex flex-col gap-1">
                        <span className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border border-white/10 text-white">You</span>
                        {status === "battling" && (
                            <motion.span
                                animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.2, repeat: Infinity }}
                                className="text-[9px] text-cyan-400 font-bold uppercase bg-black/60 px-2 py-0.5 rounded border border-cyan-500/20">
                                🔬 AI Scanning... #{scanCount}
                            </motion.span>
                        )}
                    </div>

                    {/* Corner scan brackets decoration */}
                    {status === "battling" && (
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-cyan-400/60 rounded-tl" />
                            <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-cyan-400/60 rounded-tr" />
                            <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-cyan-400/60 rounded-bl" />
                            <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-cyan-400/60 rounded-br" />
                        </div>
                    )}
                </div>

                {/* OPPONENT */}
                <div className={`relative overflow-hidden rounded-2xl bg-zinc-950 min-h-[40vh] transition-all duration-500 ${status === "battling" && moggingLabel === "mogged"
                    ? "border-2 border-red-400/60 shadow-[0_0_40px_rgba(239,68,68,0.2)]"
                    : "border-2 border-white/8"}`}>
                    {/* Opponent video — NOT mirrored (we see them as they are) */}
                    {/* Muted by default to bypass autoplay restrictions */}
                    <video ref={remoteVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                    {/* Lose glow */}
                    {status === "battling" && moggingLabel === "mogged" && (
                        <motion.div animate={{ opacity: [0.3, 0.65, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute inset-0 pointer-events-none rounded-2xl border-2 border-red-500/60" />
                    )}

                    <div className="absolute bottom-3 right-3">
                        <span className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border border-white/10 text-white">Opponent</span>
                    </div>

                    {/* Waiting overlay */}
                    {!remoteOk && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                                <Zap className="text-zinc-600" size={44} />
                            </motion.div>
                            <p className="text-zinc-500 text-sm uppercase tracking-widest font-black">
                                {playerCount < 2 ? "Awaiting Opponent..." : "Connecting Feed..."}
                            </p>
                            {playerCount >= 2 && (
                                <>
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => (
                                            <motion.div key={i} className="w-1.5 h-1.5 bg-cyan-500 rounded-full"
                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
                                        ))}
                                    </div>
                                    <button
                                        onClick={retryConnection}
                                        className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                                    >
                                        Retry Sync
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Corner brackets for opponent */}
                    {status === "battling" && remoteOk && (
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-red-400/50 rounded-tl" />
                            <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-red-400/50 rounded-tr" />
                            <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-red-400/50 rounded-bl" />
                            <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-red-400/50 rounded-br" />
                        </div>
                    )}
                </div>
            </div>

            {/* Diagnostic Badge */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
                <div className={`px-2 py-1 rounded border text-[8px] font-black uppercase tracking-widest backdrop-blur-md ${rtcState === "connected" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" :
                    rtcState === "failed" ? "bg-red-500/20 border-red-500/40 text-red-400" :
                        "bg-white/5 border-white/10 text-zinc-500"
                    }`}>
                    Net: {rtcState}
                </div>
            </div>

            {/* HTTPS warning */}
            {/* Non-secure context overlay (LAN/HTTP issues) */}
            {!isHTTPS && (
                <div className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
                    <div className="max-w-md w-full bg-zinc-900 border border-red-500/40 p-8 rounded-[2rem] text-center shadow-2xl">
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                            <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 text-white">Secure Connection Required</h2>
                        <div className="text-zinc-400 text-sm space-y-4 mb-8 text-left bg-black/40 p-5 rounded-2xl border border-white/5">
                            <p>Browsers block camera access on non-secure (HTTP) connections when using IP addresses.</p>
                            <div className="space-y-2">
                                <p className="font-bold text-white text-[10px] uppercase tracking-widest">To fix this on LAN:</p>
                                <ol className="list-decimal list-inside text-xs space-y-1.5 opacity-80">
                                    <li>Use <span className="text-cyan-400">localhost</span> on the host machine.</li>
                                    <li>Use an <span className="text-cyan-400">ngrok https://</span> link for external access.</li>
                                    <li>Enable "Insecure origins treated as secure" in <span className="text-zinc-200 font-mono">chrome://flags</span>.</li>
                                </ol>
                            </div>
                        </div>
                        <button
                            className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-colors shadow-lg active:scale-95"
                            onClick={() => location.reload()}>
                            Refresh Page
                        </button>
                    </div>
                </div>
            )}

            {/* Countdown overlay */}
            <AnimatePresence>
                {status === "countdown" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xl">
                        {/* Animated rings */}
                        <div className="absolute">
                            {[1, 2, 3].map(i => (
                                <motion.div key={i} className="absolute rounded-full border border-cyan-500/20"
                                    style={{ width: i * 120, height: i * 120, top: -(i * 60), left: -(i * 60) }}
                                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} />
                            ))}
                        </div>
                        <Particles active={showParticles} />
                        <AnimatePresence mode="wait">
                            <motion.div key={countdown}
                                initial={{ scale: 0.4, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 2, opacity: 0, y: -20 }}
                                transition={{ duration: 0.4, ease: "backOut" }}
                                className="text-center relative z-10">
                                <div className={`font-black italic tracking-tighter text-transparent bg-clip-text leading-none select-none ${countdown === 0
                                    ? "text-[8rem] md:text-[11rem] bg-gradient-to-r from-emerald-400 to-cyan-400"
                                    : "text-[10rem] md:text-[14rem] bg-gradient-to-b from-white to-zinc-600"}`}>
                                    {countdown === 0 ? "GO!" : countdown}
                                </div>
                                <motion.p
                                    animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }}
                                    className="text-zinc-400 text-xs uppercase tracking-[0.4em] mt-3 font-bold">
                                    {countdown === 0 ? "⚡ AI Analyzing Now..." : countdown === 1 ? "Get Ready!" : "Position your face in frame"}
                                </motion.p>
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Results overlay */}
            <AnimatePresence>
                {status === "finished" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md overflow-y-auto">
                        <motion.div initial={{ y: 60, scale: 0.92 }} animate={{ y: 0, scale: 1 }}
                            transition={{ type: "spring", duration: 0.6, bounce: 0.25 }}
                            className="max-w-4xl w-full rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10 text-center my-4 shadow-2xl">

                            {winner === null && !oppScores ? (
                                <div className="py-16">
                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                                        className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full mx-auto mb-5" />
                                    <p className="text-zinc-500 uppercase tracking-widest text-sm">Waiting for opponent score...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Winner announcement */}
                                    <AnimatePresence>
                                        {winner === "user" && (
                                            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: "spring", bounce: 0.4 }}
                                                className="flex flex-col items-center gap-3 mb-8">
                                                <motion.div
                                                    animate={{ y: [0, -8, 0], filter: ["drop-shadow(0 0 20px rgba(250,204,21,0.4))", "drop-shadow(0 0 40px rgba(250,204,21,0.8))", "drop-shadow(0 0 20px rgba(250,204,21,0.4))"] }}
                                                    transition={{ duration: 1.8, repeat: Infinity }}>
                                                    <Trophy className="text-yellow-400 w-20 h-20" />
                                                </motion.div>
                                                <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-yellow-400 leading-none">You Mogged!</h2>
                                                <span className="text-2xl">🫵</span>
                                                {userScores?.method === "geometric" && <span className="text-[10px] text-cyan-400 uppercase tracking-widest border border-cyan-500/30 px-3 py-1 rounded-full">AI-Geometric Analysis</span>}
                                            </motion.div>
                                        )}
                                        {winner === "opponent" && (
                                            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: "spring", bounce: 0.4 }}
                                                className="flex flex-col items-center gap-3 mb-8">
                                                <Skull className="text-red-500 w-20 h-20" />
                                                <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-red-400 leading-none">You Got Mogged</h2>
                                                <span className="text-2xl">💀</span>
                                            </motion.div>
                                        )}
                                        {winner === "tie" && (
                                            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: "spring", bounce: 0.4 }}
                                                className="flex flex-col items-center gap-3 mb-8">
                                                <Flame className="text-cyan-400 w-20 h-20" />
                                                <h2 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-cyan-400 leading-none">Two Chads</h2>
                                                <span className="text-2xl">⚡</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Score cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                                        {userScores && <ScoreBlock title="Your Stats" m={userScores} rank={getRankLabel(userScores.overall)} win={winner === "user"} />}
                                        {oppScores
                                            ? <ScoreBlock title="Opponent Stats" m={oppScores} rank={getRankLabel(oppScores.overall)} win={winner === "opponent"} />
                                            : <div className="rounded-3xl border-2 border-white/5 bg-white/5 flex items-center justify-center p-8">
                                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                                                    className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full" />
                                            </div>
                                        }
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        <button
                                            className="group relative px-10 py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl overflow-hidden active:scale-95 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                                            onClick={() => location.reload()}>
                                            <span className="relative z-10">🔁 Rematch</span>
                                            <div className="absolute inset-0 bg-cyan-400 -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
                                        </button>
                                        {userScores && oppScores && winner && (
                                            <button
                                                className="px-10 py-4 border border-emerald-500/30 bg-emerald-500/10 font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-emerald-400"
                                                onClick={() => downloadBattleCard(winner, userScores, oppScores, localSnapshot ?? undefined)}>
                                                ⬇️ Flex Card
                                            </button>
                                        )}
                                        <button
                                            className="px-10 py-4 border border-white/10 bg-white/5 font-black uppercase tracking-widest rounded-xl hover:bg-white/10 flex items-center justify-center gap-2 active:scale-95 transition-all"
                                            onClick={() => router.push("/")}>
                                            <Share2 size={18} /> Home
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ScoreBlock({ title, m, rank, win }: { title: string; m: FacialMetrics; rank: string; win: boolean }) {
    const scoreColor = getScoreColor(m.overall);
    const rankColor = getRankColor(m.overall);
    const pct = m.percentile ?? 50;

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-3xl border-2 text-left relative overflow-hidden ${win
                ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_40px_rgba(16,185,129,0.08)]"
                : "border-white/8 bg-white/3"}`}>

            {/* Percentile badge */}
            <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest
                ${pct >= 70 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : pct >= 40 ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                        : pct >= 20 ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                            : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                Top {100 - pct + 1}%
            </div>

            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">{title}</h3>
            <div className="text-5xl font-black mb-0.5 flex items-baseline gap-2 justify-center">
                <span className={`text-transparent bg-clip-text bg-gradient-to-br ${scoreColor}`}>{m.overall}</span>
                <span className="text-lg text-zinc-600">/ 10</span>
            </div>
            <div className={`font-extrabold uppercase italic tracking-[0.15em] mb-4 text-sm text-center ${rankColor}`}>{rank}</div>
            {m.method === "geometric" && (
                <div className="flex justify-center mb-4">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest border border-white/10 rounded-full px-2 py-0.5">Geometric AI Scan</span>
                </div>
            )}
            <div className="space-y-3 mb-5">
                {[["Symmetry", m.symmetry], ["Jawline", m.jawline], ["Eye Space", m.eyeArea], ["Harmony", m.harmonics]].map(([l, v]) => {
                    const barColor = (v as number) >= 8.0 ? "bg-emerald-400/60" : (v as number) >= 6.5 ? "bg-cyan-400/60" : (v as number) >= 5.0 ? "bg-yellow-400/60" : "bg-red-500/60";
                    return (
                        <div key={l as string} className="flex justify-between items-center text-xs uppercase font-bold tracking-widest">
                            <span className="text-zinc-500">{l}</span>
                            <div className="flex items-center gap-3">
                                <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${(v as number) * 10}%` }} transition={{ duration: 1.0, ease: "easeOut", delay: 0.2 }}
                                        className={`h-full rounded-full ${barColor}`} />
                                </div>
                                <span className={`min-w-[2.2rem] text-right tabular-nums ${(v as number) >= 8.0 ? "text-emerald-400" : (v as number) >= 6.5 ? "text-white" : (v as number) >= 5.0 ? "text-yellow-400" : "text-red-400"}`}>{v}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <span className="text-[10px] uppercase tracking-tighter text-emerald-400 font-bold block mb-2">Strengths</span>
                    <ul className="text-[10px] space-y-1 text-zinc-300 leading-tight">{m.strengths.slice(0, 2).map((s, i) => <li key={i}>• {s}</li>)}</ul>
                </div>
                <div>
                    <span className="text-[10px] uppercase tracking-tighter text-red-500/70 font-bold block mb-2">Weaknesses</span>
                    <ul className="text-[10px] space-y-1 text-zinc-300 leading-tight">{m.weaknesses.slice(0, 2).map((w, i) => <li key={i}>• {w}</li>)}</ul>
                </div>
            </div>
        </motion.div>
    );
}
