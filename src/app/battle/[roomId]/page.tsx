"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/components/SocketProvider";
import { useUser } from "@/components/UserContext";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Zap, Trophy, AlertTriangle, ArrowLeft, Share2, Flame, Skull } from "lucide-react";
import { calculateScores, getRankLabel, getScoreColor, getRankColor, FacialMetrics, NLM } from "@/lib/scoring";
import { drawFaceMesh } from "@/lib/facemesh-utils";
import { playCountdownBeep, playGoSound, playVictorySound, playDefeatSound, playTieSound, vibrate } from "@/lib/sounds";
import { downloadBattleCard } from "@/lib/render-battle-card";
import { AuthModal } from "@/components/AuthModal";

const ICE: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun.voiparound.com" },
        { urls: "stun:stun.ekiga.net" },
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
                }

                if (!alive) { fl.close(); return; }
                fmRef.current = fl;
                if (onLoading) onLoading(false);

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
                if (onLoading) onLoading(false);
            }
        };

        init();
        return () => {
            alive = false;
            console.error = origError;
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
            }}
        />
    );
}

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

function ScoreBlock({ title, m, rank, win }: { title: string, m: FacialMetrics, rank: string, win?: boolean }) {
    return (
        <div className={`relative overflow-hidden rounded-3xl p-6 border-2 transition-all ${win ? "bg-white/10 border-yellow-400/30 shadow-[0_0_30px_rgba(250,204,21,0.1)]" : "bg-white/5 border-white/5"}`}>
            <h3 className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-4">{title}</h3>
            <div className="flex justify-between items-end mb-6">
                <div className="text-left">
                    <div className={`text-3xl font-black ${getScoreColor(m.overall)} mb-1`}>{m.overall} <span className="text-xs opacity-50">/ 10</span></div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${getRankColor(m.overall)}`}>{rank}</div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Potential</div>
                    <div className="text-xl font-black text-white/50">{m.potentialScore}</div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                    <div className="text-[8px] text-zinc-600 uppercase font-black mb-1">Symmetry</div>
                    <div className="text-xs font-bold text-zinc-300">{m.symmetry}%</div>
                </div>
                <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                    <div className="text-[8px] text-zinc-600 uppercase font-black mb-1">Jawline</div>
                    <div className="text-xs font-bold text-zinc-300">{m.jawline}%</div>
                </div>
            </div>
        </div>
    );
}

export default function BattlePage() {
    const params = useParams();
    const roomId = getRoomId(params?.roomId as string | string[]);
    const socket = useSocket();
    const { profile, user, updateElo } = useUser();
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
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
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
    const [isSpectator, setIsSpectator] = useState(false);
    const [oppElo, setOppElo] = useState<number | null>(null);
    const [oppUsername, setOppUsername] = useState<string | null>(null);
    const [authOpen, setAuthOpen] = useState(false);
    const [connLog, setConnLog] = useState<string>("Waiting...");
    const [iceCount, setIceCount] = useState(0);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined" && !window.isSecureContext && location.hostname !== "localhost")
            setIsHTTPS(false);
    }, []);

    useEffect(() => {
        if (status !== "battling") return;
        const id = setInterval(() => setScanCount(c => c + 1), 800);
        return () => clearInterval(id);
    }, [status]);

    const startCamera = useCallback(async () => {
        if (streamRef.current) return streamRef.current;
        const s = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
            audio: false,
        }).catch(e => {
            setCamErr(e.message ?? "Camera denied");
            return null;
        });
        if (s) {
            streamRef.current = s;
            if (localVideoRef.current) localVideoRef.current.srcObject = s;
        }
        return s;
    }, []);

    const retryRef = useRef<(() => Promise<void>) | null>(null);
    const offerRef = useRef<(() => Promise<void>) | null>(null);

    const buildPC = useCallback(async () => {
        if (pcRef.current) return pcRef.current;
        setConnLog("Starting Camera...");
        const s = streamRef.current || await startCamera();
        if (!s) { setConnLog("Cam Failed"); return null; }

        setConnLog("Creating Peer...");
        const pc = new RTCPeerConnection(ICE);
        pcRef.current = pc;
        s.getTracks().forEach(t => pc.addTrack(t, s));
        pc.ontrack = e => {
            if (e.streams && e.streams[0]) {
                setRemoteStream(e.streams[0]);
            } else {
                setRemoteStream(new MediaStream([e.track]));
            }
            setRemoteOk(true);
        };
        pc.onicecandidate = e => {
            if (e.candidate) {
                setIceCount(c => c + 1);
                socket.emit("send-signal", { roomId, signal: { type: "candidate", candidate: e.candidate } });
            }
        };
        pc.onicegatheringstatechange = () => setConnLog(`ICE: ${pc.iceGatheringState}`);
        pc.onsignalingstatechange = () => setConnLog(`Signaling: ${pc.signalingState}`);
        pc.onconnectionstatechange = () => {
            setRtcState(pc.connectionState);
            setConnLog(`RTC: ${pc.connectionState}`);
            if (pc.connectionState === "connected") { setRemoteOk(true); socket.emit("peer-connected", roomId); }
            if (pc.connectionState === "failed") {
                setConnLog("RTC: Failed - Retrying...");
                setTimeout(() => retryRef.current?.(), 1000);
            }
        };
        return pc;
    }, [socket, roomId, startCamera]);

    const sendOffer = useCallback(async () => {
        const pc = await buildPC(); if (!pc) return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("send-signal", { roomId, signal: { type: "offer", sdp: offer } });
    }, [buildPC, socket, roomId]);
    offerRef.current = sendOffer;

    const retryConnection = useCallback(async () => {
        pcRef.current?.close(); pcRef.current = null;
        setRemoteOk(false); setRtcState("new");
        const pc = await buildPC();
        if (pc && isOfferer.current) await offerRef.current?.();
    }, [buildPC]);
    retryRef.current = retryConnection;

    const sendReady = useCallback(() => socket.emit("player-ready", roomId), [socket, roomId]);

    useEffect(() => {
        if (!mounted || !roomId) return;
        if (!isSpectator) startCamera();

        const onPlayerJoined = (d: any) => setPlayerCount(d.playerCount);
        const onJoinedInfo = (d: any) => setPlayerCount(d.playerCount);
        const onRoomReady = async () => { setPlayerCount(2); if (!isSpectator) await buildPC(); };
        const onCountdown = () => setStatus("countdown");
        const onShouldOffer = async () => { if (!isSpectator) { isOfferer.current = true; await sendOffer(); } };
        const onSignal = async ({ signal }: any) => {
            if (isSpectator) return;
            setConnLog(`Signal: ${signal.type}`);
            const pc = pcRef.current || await buildPC(); if (!pc) return;

            try {
                if (signal.type === "offer") {
                    setConnLog("Offer Received");
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    remoteDescriptionSet.current = true;
                    const ans = await pc.createAnswer();
                    await pc.setLocalDescription(ans);
                    socket.emit("send-signal", { roomId, signal: { type: "answer", sdp: ans } });

                    // Drain pending candidates
                    while (pendingCandidates.current.length > 0) {
                        const cand = pendingCandidates.current.shift();
                        if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => { });
                    }
                } else if (signal.type === "answer") {
                    setConnLog("Answer Received");
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    remoteDescriptionSet.current = true;
                    while (pendingCandidates.current.length > 0) {
                        const cand = pendingCandidates.current.shift();
                        if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => { });
                    }
                } else if (signal.type === "candidate") {
                    if (remoteDescriptionSet.current) {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => { });
                    } else {
                        pendingCandidates.current.push(signal.candidate);
                    }
                }
            } catch (err) {
                console.error("[WebRTC] Signal Error:", err);
                setConnLog("Connect Error - Retrying");
                retryConnection();
            }
        };
        const onOppScore = ({ metrics, elo }: { metrics: FacialMetrics, elo?: number }) => {
            setOppScores(metrics);
            if (elo) setOppElo(elo);
        };
        const onOppInfo = ({ username, elo }: { username: string, elo: number }) => {
            setOppUsername(username);
            setOppElo(elo);
        };
        const onSpectator = (d: any) => { setIsSpectator(true); setPlayerCount(d.playerCount); setStatus(d.status); };
        const onPlayerLeft = () => setPlayerCount(n => Math.max(0, n - 1));

        socket.on("joined-as-spectator", onSpectator);
        socket.on("player-joined", onPlayerJoined);
        socket.on("joined-room-info", onJoinedInfo);
        socket.on("room-ready", onRoomReady);
        socket.on("start-countdown", onCountdown);
        socket.on("should-create-offer", onShouldOffer);
        socket.on("receive-signal", onSignal);
        socket.on("opponent-score", onOppScore);
        socket.on("opponent-info", onOppInfo);
        socket.on("player-left", onPlayerLeft);
        socket.emit("join-room", roomId);
        // Share our info so opponent can display our name/elo
        if (!isSpectator) socket.emit("player-info", { roomId, username: profile.username, elo: profile.elo });

        return () => {
            socket.off("player-joined", onPlayerJoined);
            socket.off("joined-room-info", onJoinedInfo);
            socket.off("room-ready", onRoomReady);
            socket.off("start-countdown", onCountdown);
            socket.off("should-create-offer", onShouldOffer);
            socket.off("receive-signal", onSignal);
            socket.off("opponent-score", onOppScore);
            socket.off("opponent-info", onOppInfo);
            socket.off("player-left", onPlayerLeft);
            socket.off("joined-as-spectator", onSpectator);
        };
    }, [mounted, socket, roomId, buildPC, startCamera, sendOffer, isSpectator]);

    // Send ready when face is detected and opponent has joined
    useEffect(() => {
        if (!isSpectator && localFaceReady && playerCount >= 2 && status === "waiting") sendReady();
    }, [localFaceReady, playerCount, sendReady, isSpectator, status]);

    // Forced ready fallback: if AI is still loading or face not found after 8s with 2 players, send ready anyway
    useEffect(() => {
        if (isSpectator || playerCount < 2 || status !== "waiting") return;
        const t = setTimeout(() => {
            setConnLog("Force Ready (timeout)");
            sendReady();
        }, 8000);
        return () => clearTimeout(t);
    }, [playerCount, isSpectator, status, sendReady]);

    // Safety Fallback: Ensure buildPC is called if stuck in 'Ready to Sync' with 2 players
    useEffect(() => {
        if (playerCount >= 2 && !isSpectator && !pcRef.current && status === "waiting") {
            setConnLog("Force Syncing...");
            buildPC();
        }
    }, [playerCount, isSpectator, status, buildPC]);

    useEffect(() => {
        if (status !== "countdown") return;
        if (countdown > 0) {
            playCountdownBeep(countdown); vibrate(60);
            const t = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(t);
        }
        playGoSound(); vibrate([80, 40, 80]);
        setTimeout(() => { setShowParticles(true); setStatus("battling"); setTimeout(() => setShowParticles(false), 900); }, 800);
    }, [status, countdown]);

    // Safely assign remote stream to video element when it becomes available
    useEffect(() => {
        const vid = remoteVideoRef.current;
        if (vid && remoteStream) {
            if (vid.srcObject !== remoteStream) {
                vid.srcObject = remoteStream;
                vid.play().catch(() => { });
            }
        }
    }, [remoteStream, status]);

    useEffect(() => {
        if (status !== "battling") return;
        if (timeLeft <= 0) { if (!finishDone.current) { finishDone.current = true; finish(); } return; }
        const t = setTimeout(() => setTimeLeft(n => n - 1), 1000);
        return () => clearTimeout(t);
    }, [status, timeLeft]);

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

    useEffect(() => {
        if (userScores && oppScores && status === "finished" && winner === null) {
            const w = userScores.overall > oppScores.overall ? "user" : userScores.overall < oppScores.overall ? "opponent" : "tie";
            setWinner(w);
            if (w === "user") { playVictorySound(); vibrate([100, 50, 100, 50, 200]); }
            else if (w === "opponent") { playDefeatSound(); vibrate([300]); }
            else { playTieSound(); vibrate([100, 50, 100]); }
            if (localVideoRef.current) {
                const v = localVideoRef.current;
                const sc = document.createElement("canvas");
                sc.width = v.videoWidth; sc.height = v.videoHeight;
                const sctx = sc.getContext("2d");
                if (sctx) { sctx.scale(-1, 1); sctx.translate(-sc.width, 0); sctx.drawImage(v, 0, 0); setLocalSnapshot(sc.toDataURL("image/jpeg", 0.85)); }
            }
            if (!isSpectator) updateElo(w === "user" ? 25 : w === "opponent" ? -15 : 5, w === "user");
        }
    }, [userScores, oppScores, status, winner, isSpectator, updateElo]);

    const finish = () => {
        setStatus("finished");
        if (isSpectator) return;
        const my = calculateScores(latestLandmarks.current);
        const finalScore = my || { overall: 0, symmetry: 0, jawline: 0, eyeArea: 0, harmonics: 0, canthalTilt: 0, midfaceRatio: 0, philtrum: 0, potentialScore: 0, bestFeature: "None", strengths: [], weaknesses: [], method: 'geometric' };
        setUserScores(finalScore as FacialMetrics);
        socket.emit("share-score", { roomId, metrics: finalScore, elo: profile.elo });
    };

    useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); pcRef.current?.close(); }, []);

    if (!mounted) return <div className="min-h-screen bg-black" />;
    const urgentTimer = timeLeft <= 5 && status === "battling";

    return (
        <div className="h-screen bg-black text-white relative overflow-hidden flex flex-col">
            <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-purple-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-900/15 rounded-full blur-[100px]" />
                {urgentTimer && <motion.div className="absolute inset-0 bg-red-900/10" animate={{ opacity: [0, 0.4, 0] }} transition={{ duration: 0.5, repeat: Infinity }} />}
            </div>

            <button onClick={() => router.push("/")} className="fixed top-5 left-5 z-50 flex items-center gap-2 text-zinc-600 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
                <ArrowLeft size={14} /> Home
            </button>

            <div className="fixed top-5 right-5 z-50 flex flex-col items-end gap-2">
                <div className="bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Room: <span className="text-cyan-400">{roomId}</span>
                </div>
                {isSpectator && <div className="bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/40 text-amber-400 text-[10px] font-black uppercase tracking-widest">Spectator Mode</div>}
            </div>

            {/* ── Top Center HUD: Timer + Dual Player Info ── */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-full max-w-sm px-4">

                {/* Timer badge */}
                <motion.div animate={urgentTimer ? { scale: [1, 1.05, 1] } : {}} transition={{ duration: 0.4, repeat: Infinity }}
                    className={`bg-black/80 backdrop-blur-xl px-5 py-1.5 rounded-full border flex items-center gap-2.5 shadow-lg ${urgentTimer ? "border-red-500/60 shadow-red-900/30" : "border-white/10"}`}>
                    <Timer className={`w-4 h-4 ${urgentTimer ? "text-red-500 animate-pulse" : "text-cyan-400"}`} />
                    <span className={`font-mono text-xl font-black tabular-nums ${urgentTimer ? "text-red-400" : "text-white"}`}>
                        {status === "battling" ? `${timeLeft}s` : status === "waiting" ? "--" : status === "countdown" ? "..." : "✓"}
                    </span>
                </motion.div>

                {/* Dual player info bar */}
                {!isSpectator && (
                    <div className="w-full bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-3 py-2 flex items-center justify-between gap-2">
                        {/* You */}
                        <div className="flex flex-col items-start min-w-0">
                            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">You</span>
                            <span className="text-[11px] font-black text-white uppercase tracking-tight truncate max-w-[80px]">{profile.username}</span>
                            <span className="text-[9px] text-cyan-400 font-mono font-bold">{profile.elo} ELO</span>
                        </div>

                        {/* VS + ELO comparison bar */}
                        <div className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">VS</span>
                            {/* ELO rating comparison bar */}
                            {oppElo !== null && (
                                <div className="w-full">
                                    <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/8">
                                        {(() => {
                                            const myElo = profile.elo ?? 1000;
                                            const theirElo = oppElo ?? 1000;
                                            const total = myElo + theirElo;
                                            const myPct = total > 0 ? Math.round((myElo / total) * 100) : 50;
                                            return (
                                                <>
                                                    <motion.div animate={{ width: `${myPct}%` }} className="absolute left-0 top-0 h-full bg-cyan-500" />
                                                    <motion.div animate={{ width: `${100 - myPct}%` }} className="absolute right-0 top-0 h-full bg-purple-500" />
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex justify-between mt-0.5">
                                        <span className="text-[7px] text-cyan-400 font-mono">{profile.elo}</span>
                                        <span className="text-[7px] text-purple-400 font-mono">{oppElo}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Opponent */}
                        <div className="flex flex-col items-end min-w-0">
                            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Opp</span>
                            <span className="text-[11px] font-black text-purple-300 uppercase tracking-tight truncate max-w-[80px]">
                                {oppUsername ?? "???"}
                            </span>
                            <span className="text-[9px] text-purple-400 font-mono font-bold">{oppElo ? `${oppElo} ELO` : "—"}</span>
                        </div>
                    </div>
                )}

                {/* Mogging meter - shown during battle */}
                {(status === "battling" || status === "finished") && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                        <div className="flex justify-between mb-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${moggingLabel === "mogged" ? "text-red-400" : "text-zinc-600"}`}>
                                {moggingLabel === "mogged" ? `😭 ${oppUsername ?? "opp"}` : (oppUsername ?? "opp")}
                            </span>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${moggingLabel === "mogging" ? "text-emerald-400" : "text-zinc-600"}`}>
                                {moggingLabel === "mogging" ? `${profile.username} 🫵` : profile.username}
                            </span>
                        </div>
                        <div className="relative h-2 bg-white/5 rounded-full overflow-hidden border border-white/8">
                            <motion.div animate={{ width: `${100 - moggingLevel}%` }} className="absolute left-0 top-0 h-full bg-red-500" />
                            <motion.div animate={{ width: `${moggingLevel}%` }} className="absolute right-0 top-0 h-full bg-emerald-500" />
                        </div>
                    </motion.div>
                )}
            </div>

            <div className="relative z-10 flex-1 grid grid-rows-2 md:grid-rows-1 grid-cols-1 md:grid-cols-2 gap-2 pt-[220px] pb-2 px-2 min-h-0">
                <div className={`relative overflow-hidden rounded-2xl bg-zinc-950 min-h-0 h-full border-2 ${status === "battling" && moggingLabel === "mogging" ? "border-emerald-400/60 shadow-[0_0_40px_rgba(52,211,153,0.2)]" : "border-white/8"}`}>
                    {!isSpectator ? (
                        <>
                            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                            <FaceCanvas videoRef={localVideoRef} active={status === "battling" || status === "waiting"} mirrored={true} onLandmarks={lm => {
                                latestLandmarks.current = lm;
                                if (status === "battling") setLiveScore(calculateScores(lm)?.overall ?? null);
                                setNoFaceDetected(lm.length < 100);
                            }} onLoading={setAiLoading} onReady={setLocalFaceReady} />
                            {status === "battling" && liveScore !== null && !noFaceDetected && (
                                <div className={`absolute top-4 left-4 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 z-20 bg-gradient-to-br ${getScoreColor(liveScore)}`}>
                                    <div className="text-[8px] font-black uppercase text-white/70">Rating</div>
                                    <div className="text-xl font-black text-white">{liveScore}</div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/50">
                            <Zap className="text-zinc-700 mb-2" size={30} />
                            <p className="text-zinc-600 text-[10px] font-black uppercase">Spectating P1</p>
                        </div>
                    )}
                    {/* Local waiting overlay — show while waiting for battle to start */}
                    {status === "waiting" && !isSpectator && (
                        <div className="absolute inset-x-0 bottom-12 flex flex-col items-center gap-1 pointer-events-none">
                            {aiLoading ? (
                                <div className="bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-xl flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                                    <span className="text-[9px] text-purple-300 font-black uppercase tracking-widest">Loading Face AI...</span>
                                </div>
                            ) : noFaceDetected ? (
                                <div className="bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-xl flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce" />
                                    <span className="text-[9px] text-yellow-300 font-black uppercase tracking-widest">Position Your Face</span>
                                </div>
                            ) : (
                                <div className="bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-xl flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-[9px] text-emerald-300 font-black uppercase tracking-widest">Face Detected ✓</span>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <span className="bg-black/80 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10">Player 1</span>
                        {!isSpectator && <span className="bg-cyan-500/20 text-cyan-400 text-[8px] font-black px-2 py-0.5 rounded border border-cyan-500/20">{profile.username}</span>}
                    </div>
                </div>

                <div className={`relative overflow-hidden rounded-2xl bg-zinc-950 min-h-0 h-full border-2 ${status === "battling" && moggingLabel === "mogged" ? "border-red-400/60 shadow-[0_0_40px_rgba(239,68,68,0.2)]" : "border-white/8"}`}>
                    <video ref={remoteVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {!remoteOk && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm gap-3">
                            <div className="flex flex-col items-center gap-2 text-center">
                                {playerCount < 2 ? (
                                    <>
                                        <div className="flex gap-1">
                                            {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                                        </div>
                                        <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Waiting for Opponent</p>
                                        <p className="text-zinc-600 text-[8px] font-bold">Share Room: <span className="text-cyan-400">{roomId}</span></p>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex gap-1">
                                            {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                                        </div>
                                        <p className="text-zinc-300 text-[10px] font-black uppercase tracking-widest">Opponent Joined!</p>
                                        <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-wider">{connLog}</p>
                                        <p className="text-zinc-600 text-[8px] italic">Battle starts automatically...</p>
                                    </>
                                )}
                            </div>
                            {playerCount >= 2 && !isSpectator && (
                                <button onClick={retryConnection} className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[8px] text-cyan-400 uppercase font-black hover:bg-white/10 transition-colors">
                                    Re-Sync
                                </button>
                            )}
                        </div>
                    )}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        {oppElo && <span className="bg-amber-500/20 text-amber-400 text-[8px] font-black px-2 py-0.5 rounded border border-amber-500/20">{oppElo} ELO</span>}
                        {oppUsername && <span className="bg-purple-500/20 text-purple-300 text-[8px] font-black px-2 py-0.5 rounded border border-purple-500/20">{oppUsername}</span>}
                        <span className="bg-black/80 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10">Player 2</span>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {status === "finished" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md overflow-y-auto">
                        <motion.div initial={{ y: 40 }} animate={{ y: 0 }} className="max-w-2xl w-full bg-zinc-950 border border-white/10 rounded-[2.5rem] p-8 text-center shadow-2xl">
                            {winner === null ? (
                                <div className="py-10"><p className="animate-pulse text-zinc-500 uppercase tracking-widest text-xs font-black">Calculating Results...</p></div>
                            ) : (
                                <>
                                    <div className="mb-6">
                                        {winner === "user" ? <Trophy className="text-yellow-400 w-16 h-16 mx-auto mb-4" /> : winner === "opponent" ? <Skull className="text-red-500 w-16 h-16 mx-auto mb-4" /> : <Flame className="text-cyan-400 w-16 h-16 mx-auto mb-4" />}
                                        <h2 className={`text-5xl font-black uppercase tracking-tighter ${winner === "user" ? "text-yellow-400" : winner === "opponent" ? "text-red-500" : "text-cyan-400"}`}>
                                            {winner === "user" ? "MOGGED!" : winner === "opponent" ? "MOGGED" : "X TIE X"}
                                        </h2>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        {userScores && <ScoreBlock title="YOU" m={userScores} rank={getRankLabel(userScores.overall)} win={winner === "user"} />}
                                        {oppScores && <ScoreBlock title="OPP" m={oppScores} rank={getRankLabel(oppScores.overall)} win={winner === "opponent"} />}
                                    </div>

                                    {!user && (
                                        <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-2xl">
                                            <p className="text-[10px] text-zinc-500 uppercase font-black mb-2 tracking-widest">Guest Result</p>
                                            <p className="text-xs text-zinc-400 italic mb-3">Claim this win and save your ELO permanently.</p>
                                            <button onClick={() => setAuthOpen(true)} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Sign In to Save</button>
                                        </div>
                                    )}
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        <button onClick={() => location.reload()} className="px-8 py-3 bg-white text-black font-black uppercase text-xs rounded-xl hover:bg-zinc-200 transition-all">🔁 Play Again</button>
                                        <button onClick={() => router.push("/")} className="px-8 py-3 border border-white/10 text-white font-black uppercase text-xs rounded-xl hover:bg-white/5 transition-all">Home</button>
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
