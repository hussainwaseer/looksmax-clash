import { FacialMetrics, getRankLabel } from "./scoring";

/**
 * Ultra-Premium "Flex Card" — 9:16 Social Sharing Report Card
 * Fully recalculated layout: zero overlap, holographic dark aesthetic.
 */
export async function downloadMoggingCard(metrics: FacialMetrics, userPhoto?: string) {
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ─── 0. Load Photo ───────────────────────────────────────────────────────
    let photoImg: HTMLImageElement | null = null;
    if (userPhoto) {
        photoImg = new Image();
        photoImg.src = userPhoto;
        await new Promise((res) => {
            photoImg!.onload = res;
            photoImg!.onerror = res;
        });
    }

    const isElite = metrics.overall >= 7.5;
    const isGod = metrics.overall >= 9.0;
    const accentA = isGod ? "#FFD700" : isElite ? "#10b981" : "#22d3ee";
    const accentB = isGod ? "#FF8C00" : isElite ? "#34d399" : "#a855f7";

    // ─── 1. Background — Deep Space ──────────────────────────────────────────
    ctx.fillStyle = "#030308";
    ctx.fillRect(0, 0, W, H);

    // Radial mesh glows
    _glow(ctx, W * 0.2, H * 0.12, 700, "rgba(139,92,246,0.07)");
    _glow(ctx, W * 0.85, H * 0.35, 600, "rgba(34,211,238,0.05)");
    _glow(ctx, W * 0.5, H * 0.75, 800, isElite ? "rgba(16,185,129,0.04)" : "rgba(168,85,247,0.04)");

    // Subtle dot grid
    ctx.save();
    for (let gx = 0; gx < W; gx += 44) {
        for (let gy = 0; gy < H; gy += 44) {
            ctx.fillStyle = "rgba(255,255,255,0.018)";
            ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.restore();

    // ─── 2. Top Header Bar ───────────────────────────────────────────────────
    const headerH = 90;
    const hGrad = ctx.createLinearGradient(0, 0, W, 0);
    hGrad.addColorStop(0, "rgba(139,92,246,0.35)");
    hGrad.addColorStop(0.5, "rgba(34,211,238,0.20)");
    hGrad.addColorStop(1, "rgba(139,92,246,0.35)");
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, W, headerH);

    // Header border bottom
    const hLine = ctx.createLinearGradient(0, 0, W, 0);
    hLine.addColorStop(0, "transparent");
    hLine.addColorStop(0.5, accentA);
    hLine.addColorStop(1, "transparent");
    ctx.strokeStyle = hLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, headerH); ctx.lineTo(W, headerH); ctx.stroke();

    // Header text
    ctx.font = "900 22px Inter, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "center";
    ctx.letterSpacing = "10px";
    ctx.fillText("LOOKSMAX CLASH · GENETIC REPORT", W / 2, headerH / 2 + 8);
    ctx.letterSpacing = "0px";

    // ─── 3. Photo Circle ─────────────────────────────────────────────────────
    const photoR = 190;         // radius
    const photoX = W / 2;
    const photoY = headerH + 30 + photoR + 20; // 330

    // Outer glow ring (double)
    for (const [r, alpha] of [[photoR + 28, 0.25], [photoR + 16, 0.55]] as [number, number][]) {
        const rg = ctx.createLinearGradient(photoX - r, photoY - r, photoX + r, photoY + r);
        rg.addColorStop(0, accentA);
        rg.addColorStop(1, accentB);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = rg;
        ctx.lineWidth = r === photoR + 28 ? 4 : 6;
        ctx.beginPath(); ctx.arc(photoX, photoY, r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }

    // Photo clip
    ctx.save();
    ctx.beginPath(); ctx.arc(photoX, photoY, photoR, 0, Math.PI * 2); ctx.clip();
    if (photoImg && photoImg.width > 0) {
        const aspect = photoImg.width / photoImg.height;
        let dw: number, dh: number, dx: number, dy: number;
        if (aspect > 1) { dh = photoR * 2; dw = dh * aspect; dy = photoY - photoR; dx = photoX - dw / 2; }
        else { dw = photoR * 2; dh = dw / aspect; dx = photoX - photoR; dy = photoY - dh / 2; }
        ctx.drawImage(photoImg, dx, dy, dw, dh);
    } else {
        // Placeholder gradient
        const ph = ctx.createRadialGradient(photoX, photoY - 40, 0, photoX, photoY, photoR);
        ph.addColorStop(0, "#1e1e2e");
        ph.addColorStop(1, "#0a0a12");
        ctx.fillStyle = ph;
        ctx.fillRect(photoX - photoR, photoY - photoR, photoR * 2, photoR * 2);

        // Silhouette icon
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.beginPath(); ctx.arc(photoX, photoY - 40, 55, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(photoX, photoY + 70, 85, 60, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // ─── 4. Score Hero Block ─────────────────────────────────────────────────
    const scoreSectionY = photoY + photoR + 36; // ~596
    const scoreSectionH = 210;

    _glassCard(ctx, 60, scoreSectionY, W - 120, scoreSectionH, 44);

    // Score number
    const scoreGrad = ctx.createLinearGradient(W / 2 - 120, scoreSectionY, W / 2 + 120, scoreSectionY + scoreSectionH);
    scoreGrad.addColorStop(0, accentA);
    scoreGrad.addColorStop(1, accentB);
    ctx.font = "900 130px Inter, Arial, sans-serif";
    ctx.fillStyle = scoreGrad;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(metrics.overall.toFixed(1), W / 2, scoreSectionY + scoreSectionH / 2 - 10);

    // Label left
    ctx.font = "900 18px Inter, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "5px";
    ctx.fillText("SCORE", 88, scoreSectionY + scoreSectionH / 2 - 45);
    ctx.fillText("/ 10", 88, scoreSectionY + scoreSectionH / 2 + 35);
    ctx.letterSpacing = "0px";

    // Rank label right
    const rankStr = getRankLabel(metrics.overall).toUpperCase();
    ctx.save();
    ctx.font = "italic 900 36px Inter, Arial, sans-serif";
    ctx.fillStyle = accentA;
    ctx.textAlign = "right";
    ctx.shadowBlur = 20;
    ctx.shadowColor = accentA;
    _textFit(ctx, rankStr, W - 88, scoreSectionY + scoreSectionH / 2 - 30, 300, "italic 900 38px Inter, Arial, sans-serif", accentA, "right", "0px", "middle");
    ctx.restore();

    // Potential line
    ctx.font = "bold 22px Inter, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "1px";
    ctx.fillText(`POTENTIAL  ${metrics.potentialScore}`, W - 88, scoreSectionY + scoreSectionH / 2 + 30);
    ctx.letterSpacing = "0px";

    // ─── 5. Metrics Grid (2 × 3) ─────────────────────────────────────────────
    const gridTop = scoreSectionY + scoreSectionH + 28;  // ~834
    const tileW = (W - 120 - 20) / 2;                  // ~460
    const tileH = 155;
    const tileGap = 20;
    const mLeft = 60;

    const items: { label: string; val: number; status: string }[] = [
        { label: "JAWLINE", val: metrics.jawline, status: metrics.jawline >= 8.0 ? "SHARP" : metrics.jawline >= 6.5 ? "STRONG" : "AVERAGE" },
        { label: "SYMMETRY", val: metrics.symmetry, status: metrics.symmetry >= 8.0 ? "ELITE" : metrics.symmetry >= 6.5 ? "STEADY" : "AVERAGE" },
        { label: "EYE AREA", val: metrics.eyeArea, status: metrics.eyeArea >= 8.0 ? "HUNTER" : metrics.eyeArea >= 6.5 ? "FAVORED" : "ROUND" },
        { label: "HARMONICS", val: metrics.harmonics, status: metrics.harmonics >= 8.0 ? "GOLDEN" : "BALANCED" },
        { label: "CANTHAL TILT", val: metrics.canthalTilt ?? 6.0, status: (metrics.canthalTilt ?? 6.0) >= 7.0 ? "POSITIVE" : "NEUTRAL" },
        { label: "MIDFACE", val: metrics.midfaceRatio ?? 6.0, status: (metrics.midfaceRatio ?? 6.0) >= 7.5 ? "COMPACT" : "OPTIMAL" },
    ];

    items.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const tx = mLeft + col * (tileW + tileGap);
        const ty = gridTop + row * (tileH + tileGap);

        _glassCard(ctx, tx, ty, tileW, tileH, 28);

        // Colored score pill
        const mc = _metricColor(item.val);
        ctx.fillStyle = mc.bg;
        ctx.beginPath(); ctx.roundRect(tx + 20, ty + 18, 72, 36, 10); ctx.fill();

        ctx.font = "900 22px Inter, Arial, sans-serif";
        ctx.fillStyle = mc.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((item.val).toFixed(1), tx + 56, ty + 36);

        // Label
        ctx.font = "900 17px Inter, Arial, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.30)";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.letterSpacing = "3px";
        ctx.fillText(item.label, tx + 20, ty + 78);
        ctx.letterSpacing = "0px";

        // Status
        ctx.font = "italic 900 26px Inter, Arial, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(item.status, tx + 20, ty + 112);

        // Progress bar
        const barX = tx + 20;
        const barY = ty + tileH - 16;
        const barW = tileW - 40;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 5, 3); ctx.fill();
        ctx.fillStyle = mc.text;
        ctx.beginPath(); ctx.roundRect(barX, barY, (item.val / 10) * barW, 5, 3); ctx.fill();
    });

    // ─── 6. Achievement Belt ─────────────────────────────────────────────────
    const gridBottom = gridTop + 3 * (tileH + tileGap) - tileGap; // ~834 + 525 = 1359
    const beltY = gridBottom + 36;                           // ~1395
    const beltH = 120;

    const belt = ctx.createLinearGradient(0, beltY, W, beltY + beltH);
    belt.addColorStop(0, accentA + "33");
    belt.addColorStop(0.5, accentA + "22");
    belt.addColorStop(1, accentB + "33");
    ctx.fillStyle = belt;
    ctx.fillRect(0, beltY, W, beltH);

    // Belt top/bottom lines
    [[beltY, accentA], [beltY + beltH, accentB]].forEach(([y, color]) => {
        const ln = ctx.createLinearGradient(0, 0, W, 0);
        ln.addColorStop(0, "transparent");
        ln.addColorStop(0.5, color as string);
        ln.addColorStop(1, "transparent");
        ctx.strokeStyle = ln;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y as number); ctx.lineTo(W, y as number); ctx.stroke();
    });

    const pct = metrics.percentile ?? 50;
    const beltText = `★  TOP ${Math.max(1, 100 - pct)}% GLOBAL  ★`;
    ctx.font = "900 38px Inter, Arial, sans-serif";
    ctx.fillStyle = accentA;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "6px";
    ctx.save();
    ctx.shadowBlur = 24;
    ctx.shadowColor = accentA;
    ctx.fillText(beltText, W / 2, beltY + beltH / 2);
    ctx.restore();
    ctx.letterSpacing = "0px";

    // ─── 7. Potential / Flex Tagline ─────────────────────────────────────────
    const tagY = beltY + beltH + 36;  // ~1551

    const tagline = isGod ? "GOD-TIER GENETICS CONFIRMED"
        : isElite ? "ELITE GENETIC STRUCTURE DETECTED"
            : `OPTIMIZATION PATH: ${metrics.potentialScore}/10 REACHABLE`;

    _textFit(ctx, tagline, W / 2, tagY, W - 160, "900 34px Inter, Arial, sans-serif", "rgba(255,255,255,0.55)", "center", "4px", "alphabetic");

    // ─── 8. Bottom Branding ──────────────────────────────────────────────────
    const brandY = H - 100;

    // Divider
    const div = ctx.createLinearGradient(0, 0, W, 0);
    div.addColorStop(0, "transparent");
    div.addColorStop(0.5, "rgba(255,255,255,0.12)");
    div.addColorStop(1, "transparent");
    ctx.strokeStyle = div;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(100, brandY - 28); ctx.lineTo(W - 100, brandY - 28); ctx.stroke();

    ctx.font = "900 20px Inter, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.letterSpacing = "8px";
    ctx.fillText("LOOKSMAX CLASH  ·  GEN-1 AI ENGINE", W / 2, brandY);
    ctx.letterSpacing = "0px";

    // QR-style corner accent dots
    for (const [cx, cy] of [[100, brandY + 30], [W - 100, brandY + 30]] as [number, number][]) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        for (let s = 0; s < 3; s++) {
            ctx.beginPath(); ctx.arc(cx + (s - 1) * 12, cy, 4 - s, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `looksmax-report-${metrics.overall.toFixed(1)}.png`;
    link.href = dataUrl;
    link.click();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _glassCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
}

function _glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function _textFit(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number, y: number,
    maxW: number,
    font: string,
    color: string,
    align: CanvasTextAlign = "left",
    spacing = "0px",
    baseline: CanvasTextBaseline = "alphabetic"
) {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.letterSpacing = spacing;
    ctx.textBaseline = baseline;

    let m = ctx.measureText(text);
    let fmatch = font.match(/(\d+)px/);
    let fs = fmatch ? parseInt(fmatch[1]) : 28;

    while (m.width > maxW && fs > 14) {
        fs -= 2;
        ctx.font = font.replace(/\d+px/, `${fs}px`);
        m = ctx.measureText(text);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.letterSpacing = "0px";
}

function _metricColor(val: number): { bg: string; text: string } {
    if (val >= 8.0) return { bg: "rgba(16,185,129,0.18)", text: "#10b981" };
    if (val >= 6.5) return { bg: "rgba(34,211,238,0.15)", text: "#22d3ee" };
    if (val >= 5.0) return { bg: "rgba(250,204,21,0.15)", text: "#facc15" };
    return { bg: "rgba(239,68,68,0.15)", text: "#ef4444" };
}
