import { FacialMetrics, getRankLabel } from "./scoring";

/**
 * Battle Win/Loss Flex Card — 9:16 shareable PNG
 * Shows winner prominently vs loser, scores side by side, mogging declaration.
 */
export async function downloadBattleCard(
    winner: "user" | "opponent" | "tie",
    userMetrics: FacialMetrics,
    oppMetrics: FacialMetrics,
    userPhoto?: string,
    oppPhoto?: string
) {
    const W = 1080; const H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Load photos
    const loadImg = async (src?: string): Promise<HTMLImageElement | null> => {
        if (!src) return null;
        return new Promise(res => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => res(null);
            img.src = src;
        });
    };
    const [uImg, oImg] = await Promise.all([loadImg(userPhoto), loadImg(oppPhoto)]);

    const isWin = winner === "user";
    const isTie = winner === "tie";
    const accentW = isWin ? "#10b981" : isTie ? "#22d3ee" : "#ef4444";
    const accentL = isWin ? "#ef4444" : isTie ? "#22d3ee" : "#10b981";

    // ─── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = "#020206";
    ctx.fillRect(0, 0, W, H);
    // Glows
    _bglow(ctx, W * 0.25, H * 0.3, 700, isWin ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.05)");
    _bglow(ctx, W * 0.75, H * 0.3, 700, isWin ? "rgba(239,68,68,0.05)" : "rgba(16,185,129,0.06)");
    _bglow(ctx, W * 0.5, H * 0.85, 500, "rgba(139,92,246,0.05)");
    // Dot grid
    ctx.save();
    for (let gx = 22; gx < W; gx += 44) for (let gy = 22; gy < H; gy += 44) {
        ctx.fillStyle = "rgba(255,255,255,0.015)"; ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // ─── Header bar ──────────────────────────────────────────────────────────
    const hGrad = ctx.createLinearGradient(0, 0, W, 0);
    hGrad.addColorStop(0, `${accentW}44`); hGrad.addColorStop(0.5, "rgba(139,92,246,0.2)"); hGrad.addColorStop(1, `${accentL}44`);
    ctx.fillStyle = hGrad; ctx.fillRect(0, 0, W, 90);
    ctx.font = "900 20px Inter, Arial, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.textAlign = "center"; ctx.letterSpacing = "10px";
    ctx.fillText("LOOKSMAX CLASH · BATTLE RESULT", W / 2, 53); ctx.letterSpacing = "0px";

    // ─── Winner headline ─────────────────────────────────────────────────────
    const headline = isWin ? "YOU MOGGED 🫵" : isTie ? "TWO CHADS ⚡" : "YOU GOT MOGGED 💀";
    const hColor = isWin ? "#10b981" : isTie ? "#22d3ee" : "#ef4444";
    ctx.save(); ctx.shadowBlur = 30; ctx.shadowColor = hColor;
    ctx.font = "italic 900 70px Inter, Arial, sans-serif"; ctx.fillStyle = hColor; ctx.textAlign = "center";
    _bfitText(ctx, headline, W / 2, 195, W - 80, "italic 900 70px Inter, Arial, sans-serif", hColor, "center");
    ctx.restore();

    // ─── Two photo circles ────────────────────────────────────────────────────
    const pr = 165; const py = 420;
    const pxL = W * 0.27; const pxR = W * 0.73;

    const drawCircle = (img: HTMLImageElement | null, cx: number, accent: string, label: string) => {
        // Ring
        const rg = ctx.createLinearGradient(cx - pr - 15, py - pr - 15, cx + pr + 15, py + pr + 15);
        rg.addColorStop(0, accent); rg.addColorStop(1, accent + "55");
        ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = rg; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(cx, py, pr + 12, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        // Photo
        ctx.save(); ctx.beginPath(); ctx.arc(cx, py, pr, 0, Math.PI * 2); ctx.clip();
        if (img && img.width > 0) {
            const a = img.width / img.height;
            let dw: number, dh: number, dx: number, dy: number;
            if (a > 1) { dh = pr * 2; dw = dh * a; dy = py - pr; dx = cx - dw / 2; }
            else { dw = pr * 2; dh = dw / a; dx = cx - pr; dy = py - dh / 2; }
            ctx.drawImage(img, dx, dy, dw, dh);
        } else {
            ctx.fillStyle = "#111"; ctx.fillRect(cx - pr, py - pr, pr * 2, pr * 2);
            ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.beginPath(); ctx.arc(cx, py - 35, 45, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx, py + 70, 70, 50, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        // Label badge
        ctx.fillStyle = accent + "22"; ctx.strokeStyle = accent + "55"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(cx - 55, py + pr + 14, 110, 36, 10); ctx.fill(); ctx.stroke();
        ctx.font = "900 15px Inter, Arial, sans-serif"; ctx.fillStyle = accent; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.letterSpacing = "3px"; ctx.fillText(label, cx, py + pr + 32); ctx.letterSpacing = "0px"; ctx.textBaseline = "alphabetic";
    };

    const userLabel = isWin ? "WINNER" : isTie ? "YOU" : "L";
    const oppLabel = isWin ? "MOGGED" : isTie ? "OPP" : "WINNER";
    drawCircle(uImg, pxL, accentW, userLabel);
    drawCircle(oImg, pxR, accentL, oppLabel);

    // VS badge
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.beginPath(); ctx.arc(W / 2, py, 38, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(W / 2, py, 38, 0, Math.PI * 2); ctx.stroke();
    ctx.font = "900 22px Inter, Arial, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("VS", W / 2, py); ctx.textBaseline = "alphabetic";

    // ─── Score Cards ─────────────────────────────────────────────────────────
    const cardY = py + pr + 68; const cardH = 180; const cardW = (W - 120 - 20) / 2; const mL = 60;

    const drawScoreCard = (m: FacialMetrics, x: number, accent: string, isWinner: boolean) => {
        _bglass(ctx, x, cardY, cardW, cardH, 28);
        if (isWinner) {
            ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = accent;
            ctx.strokeStyle = accent + "88"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(x, cardY, cardW, cardH, 28); ctx.stroke();
            ctx.restore();
        }
        const sg = ctx.createLinearGradient(x, cardY, x, cardY + cardH);
        sg.addColorStop(0, accent); sg.addColorStop(1, accent + "88");
        ctx.font = "900 72px Inter, Arial, sans-serif"; ctx.fillStyle = sg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(m.overall.toFixed(1), x + cardW / 2, cardY + 68);
        ctx.font = "italic 900 22px Inter, Arial, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        _bfitText(ctx, getRankLabel(m.overall).toUpperCase(), x + cardW / 2, cardY + 128, cardW - 30, "italic 900 22px Inter, Arial, sans-serif", "rgba(255,255,255,0.5)", "center");
        ctx.font = "900 14px Inter, Arial, sans-serif"; ctx.fillStyle = accent + "99"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`/10`, x + cardW / 2, cardY + 155); ctx.textBaseline = "alphabetic";
    };
    drawScoreCard(userMetrics, mL, accentW, isWin || isTie);
    drawScoreCard(oppMetrics, mL + cardW + 20, accentL, !isWin || isTie);

    // ─── Mini metrics comparison ──────────────────────────────────────────────
    const metY = cardY + cardH + 30;
    const metH = 52;
    const metrics: { label: string; u: number; o: number }[] = [
        { label: "SYMMETRY", u: userMetrics.symmetry, o: oppMetrics.symmetry },
        { label: "JAWLINE", u: userMetrics.jawline, o: oppMetrics.jawline },
        { label: "EYE AREA", u: userMetrics.eyeArea, o: oppMetrics.eyeArea },
        { label: "HARMONICS", u: userMetrics.harmonics, o: oppMetrics.harmonics },
    ];
    metrics.forEach((mt, i) => {
        const my = metY + i * (metH + 8);
        _bglass(ctx, mL, my, W - 120, metH, 14);
        ctx.font = "900 16px Inter, Arial, sans-serif"; ctx.letterSpacing = "2px";
        ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(mt.label, W / 2, my + metH / 2); ctx.letterSpacing = "0px";
        const uWin = mt.u >= mt.o;
        const oWin = mt.o > mt.u;
        ctx.font = "900 20px Inter, Arial, sans-serif"; ctx.fillStyle = uWin ? accentW : "rgba(255,255,255,0.35)"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(mt.u.toFixed(1), mL + 22, my + metH / 2);
        ctx.fillStyle = oWin ? accentL : "rgba(255,255,255,0.35)"; ctx.textAlign = "right";
        ctx.fillText(mt.o.toFixed(1), W - mL - 22, my + metH / 2); ctx.textBaseline = "alphabetic";
    });

    // ─── Achievement belt ─────────────────────────────────────────────────────
    const beltY = metY + metrics.length * (metH + 8) + 30;
    const beltH = 100;
    const belt = ctx.createLinearGradient(0, beltY, W, beltY + beltH);
    belt.addColorStop(0, accentW + "33"); belt.addColorStop(0.5, "rgba(139,92,246,0.2)"); belt.addColorStop(1, accentL + "33");
    ctx.fillStyle = belt; ctx.fillRect(0, beltY, W, beltH);
    const beltText = isWin ? `★ MOGGED ${(userMetrics.overall - oppMetrics.overall).toFixed(1)} POINTS ★`
        : isTie ? "★ PERFECTLY MATCHED GENETICS ★"
            : `★ LOST BY ${(oppMetrics.overall - userMetrics.overall).toFixed(1)} POINTS ★`;
    ctx.font = "900 32px Inter, Arial, sans-serif"; ctx.fillStyle = isWin ? accentW : isTie ? "#22d3ee" : accentL;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.letterSpacing = "4px";
    ctx.save(); ctx.shadowBlur = 18; ctx.shadowColor = ctx.fillStyle;
    _bfitText(ctx, beltText, W / 2, beltY + beltH / 2, W - 80, "900 32px Inter, Arial, sans-serif", ctx.fillStyle as string, "center");
    ctx.restore(); ctx.letterSpacing = "0px"; ctx.textBaseline = "alphabetic";

    // ─── Branding footer ─────────────────────────────────────────────────────
    ctx.font = "900 18px Inter, Arial, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.textAlign = "center";
    ctx.letterSpacing = "8px"; ctx.fillText("LOOKSMAX CLASH  ·  GEN-1 AI ENGINE", W / 2, H - 80); ctx.letterSpacing = "0px";

    // Export
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `battle-result-${winner}-${userMetrics.overall.toFixed(1)}.png`;
    link.href = dataUrl; link.click();
}

function _bglow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function _bglass(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
}
function _bfitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, font: string, color: string, align: CanvasTextAlign = "left", baseline?: CanvasTextBaseline) {
    ctx.font = font; ctx.textAlign = align; if (baseline) ctx.textBaseline = baseline;
    let m = ctx.measureText(text); let fs = parseInt(font.match(/(\d+)px/)?.[1] ?? "30");
    while (m.width > maxW && fs > 14) { fs -= 2; ctx.font = font.replace(/\d+px/, `${fs}px`); m = ctx.measureText(text); }
    ctx.fillStyle = color; ctx.fillText(text, x, y);
}
