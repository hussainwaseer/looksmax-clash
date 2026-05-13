import { FacialMetrics, getRankLabel } from "./scoring";

/**
 * Ultra-Luxury 9:16 Social Sharing Card
 * Fixes: text overflow, circular face masking, center-cropping, and premium glows.
 */
export async function downloadMoggingCard(metrics: FacialMetrics, userPhoto?: string) {
    const width = 1080;
    const height = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ─── 0. Load User Photo (if provided) ───
    let photoImg: HTMLImageElement | null = null;
    if (userPhoto) {
        photoImg = new Image();
        photoImg.src = userPhoto;
        await new Promise((resolve) => {
            photoImg!.onload = resolve;
            photoImg!.onerror = resolve;
        });
    }

    // ─── 1. Background (Premium Deep Space) ───
    ctx.fillStyle = "#010101";
    ctx.fillRect(0, 0, width, height);

    // Deep ambient glows for depth
    drawAmbientGlow(ctx, width / 2, height / 3, 1000, "rgba(34, 211, 238, 0.04)");
    drawAmbientGlow(ctx, width / 2, height, 1200, "rgba(168, 85, 247, 0.03)");

    // ─── 2. Top Section: User Photo (Circular Mask) ───
    const topMargin = 120;

    // Header Label
    ctx.font = "900 32px Inter, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.textAlign = "center";
    ctx.letterSpacing = "8px";
    ctx.fillText("FACIAL ANALYSIS COMPLETE", width / 2, topMargin + 20);

    // Photo Centerpiece
    const photoRadius = 240;
    const photoX = width / 2;
    const photoY = topMargin + 320;

    // Outer Glow Border
    const borderGrad = ctx.createLinearGradient(photoX - photoRadius, photoY - photoRadius, photoX + photoRadius, photoY + photoRadius);
    borderGrad.addColorStop(0, "#22d3ee");
    borderGrad.addColorStop(1, "#a855f7");

    ctx.shadowBlur = 40;
    ctx.shadowColor = "rgba(34, 211, 238, 0.4)";
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.arc(photoX, photoY, photoRadius + 12, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    // Circular Photo Mask
    ctx.save();
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoRadius, 0, Math.PI * 2);
    ctx.clip();
    if (photoImg) {
        // Center-crop "Cover" logic
        const aspect = photoImg.width / photoImg.height;
        let drawW, drawH, drawX, drawY;
        if (aspect > 1) { // Landscape source
            drawH = photoRadius * 2;
            drawW = drawH * aspect;
            drawY = photoY - photoRadius;
            drawX = photoX - drawW / 2;
        } else { // Portrait source
            drawW = photoRadius * 2;
            drawH = drawW / aspect;
            drawX = photoX - photoRadius;
            drawY = photoY - drawH / 2;
        }
        ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);
    } else {
        ctx.fillStyle = "#111";
        ctx.fillRect(photoX - photoRadius, photoY - photoRadius, photoRadius * 2, photoRadius * 2);
    }
    ctx.restore();

    // ─── 3. Overall Score Card (Frosted Glass) ───
    const scoreCardY = photoY + photoRadius + 100;
    const scoreCardH = 300;
    const cardMargin = 80;
    const cardW = width - cardMargin * 2;

    drawGlassCard(ctx, cardMargin, scoreCardY, cardW, scoreCardH, 48);

    // Donut Score
    const donutX = cardMargin + 160;
    const donutY = scoreCardY + scoreCardH / 2;
    const donutR = 90;

    // Donut Progress
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 20;
    ctx.beginPath(); ctx.arc(donutX, donutY, donutR, 0, Math.PI * 2); ctx.stroke();

    const isElite = metrics.overall >= 7.5;
    ctx.strokeStyle = isElite ? "#10b981" : "#22d3ee";
    ctx.beginPath();
    ctx.arc(donutX, donutY, donutR, -Math.PI / 2, (metrics.overall / 10) * Math.PI * 2 - Math.PI / 2);
    ctx.stroke();

    // Score Text
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 82px Inter, sans-serif";
    ctx.fillText(metrics.overall.toFixed(1), donutX, donutY + 20);

    // Rank & Potential Achievement
    ctx.textAlign = "left";
    const rankText = getRankLabel(metrics.overall).toUpperCase();
    drawTextFit(ctx, rankText, donutX + 160, donutY - 5, cardW - 360, "italic 900 84px Inter, sans-serif", isElite ? "#10b981" : "#ffffff");

    ctx.font = "900 32px Inter, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.letterSpacing = "2px";
    ctx.fillText(`POTENTIAL SCORE: ${metrics.potentialScore}`, donutX + 160, donutY + 55);

    // ─── 4. Metrics Grid (2x3) ───
    const gridY = scoreCardY + scoreCardH + 40;
    const itemW = (cardW - 30) / 2;
    const itemH = 210;
    const items = [
        { label: "JAWLINE", val: metrics.jawline, status: metrics.jawline >= 8.0 ? "SHARP" : metrics.jawline >= 6.5 ? "STRONG" : "NORMAL" },
        { label: "SYMMETRY", val: metrics.symmetry, status: metrics.symmetry >= 8.0 ? "ELITE" : metrics.symmetry >= 6.5 ? "STEADY" : "AVERAGE" },
        { label: "EYE AREA", val: metrics.eyeArea, status: metrics.eyeArea >= 8.0 ? "HUNTER" : metrics.eyeArea >= 6.5 ? "FAVORABLE" : "ROUND" },
        { label: "FACIAL THIRDS", val: metrics.harmonics, status: metrics.harmonics >= 8.0 ? "GOLDEN" : "BALANCED" },
        { label: "CANTHAL TILT", val: metrics.canthalTilt ?? 6.0, status: (metrics.canthalTilt ?? 6.0) >= 7.0 ? "POSITIVE" : "NEUTRAL" },
        { label: "MIDFACE RATIO", val: metrics.midfaceRatio ?? 6.0, status: (metrics.midfaceRatio ?? 6.0) >= 7.5 ? "COMPACT" : "OPTIMAL" },
    ];

    items.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = cardMargin + col * (itemW + 30);
        const y = gridY + row * (itemH + 30);

        drawGlassCard(ctx, x, y, itemW, itemH, 40);

        // Score Mini-Indicator
        ctx.fillStyle = getMetricColor(item.val, "0.15");
        ctx.beginPath(); ctx.roundRect(x + 30, y + 30, 80, 40, 10); ctx.fill();
        ctx.textAlign = "center";
        ctx.font = "900 24px Inter, sans-serif";
        ctx.fillStyle = getMetricColor(item.val, "1");
        ctx.fillText(Math.round(item.val * 10).toString(), x + 70, y + 58);

        // Label
        ctx.textAlign = "left";
        drawTextFit(ctx, item.label, x + 30, y + 105, itemW - 60, "900 32px Inter, sans-serif", "rgba(255,255,255,0.3)");

        // Status
        drawTextFit(ctx, item.status, x + 30, y + 155, itemW - 60, " italic 900 38px Inter, sans-serif", "#ffffff");

        // Progress Bar
        const barY = y + 180;
        const barW = itemW - 60;
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath(); ctx.roundRect(x + 30, barY, barW, 6, 3); ctx.fill();
        ctx.fillStyle = getMetricColor(item.val, "1");
        ctx.beginPath(); ctx.roundRect(x + 30, barY, (item.val / 10) * barW, 6, 3); ctx.fill();
    });

    // ─── 5. Achievement Badge Section ───
    const footerY = height - 340;
    const pct = metrics.percentile ?? 50;

    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = isElite ? "rgba(16, 185, 129, 0.3)" : "rgba(34, 211, 238, 0.2)";
    const beltGrad = ctx.createLinearGradient(0, footerY, width, footerY);
    beltGrad.addColorStop(0, isElite ? "#10b981" : "#22d3ee");
    beltGrad.addColorStop(1, isElite ? "#34d399" : "#a855f7");
    ctx.fillStyle = beltGrad;
    ctx.fillRect(0, footerY, width, 140);
    ctx.restore();

    ctx.textAlign = "center";
    ctx.fillStyle = "#000000";
    ctx.font = "900 48px Inter, sans-serif";
    ctx.letterSpacing = "6px";
    ctx.fillText(`TOP ${100 - pct}% GLOBAL CANDIDATE`, width / 2, footerY + 86);

    // Footer Branding
    ctx.font = "900 24px Inter, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.letterSpacing = "10px";
    ctx.fillText("LOOKSMAX CLASH • GEN-1 AI ENGINE", width / 2, height - 100);

    // ─── Export ───
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `elite-report-${metrics.overall.toFixed(1)}.png`;
    link.href = dataUrl;
    link.click();
}

// ─── Helpers ───

function drawGlassCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}

function drawAmbientGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawTextFit(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, font: string, color: string) {
    ctx.font = font;
    let metrics = ctx.measureText(text);
    let fontSize = parseInt(font.match(/\d+/)![0]);
    let currentFont = font;

    while (metrics.width > maxWidth && fontSize > 12) {
        fontSize -= 2;
        currentFont = font.replace(/\d+px/, `${fontSize}px`);
        ctx.font = currentFont;
        metrics = ctx.measureText(text);
    }

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

function getMetricColor(val: number, opacity: string) {
    if (val >= 8.0) return `rgba(16, 185, 129, ${opacity})`;
    if (val >= 6.5) return `rgba(34, 211, 238, ${opacity})`;
    if (val >= 5.0) return `rgba(250, 204, 21, ${opacity})`;
    return `rgba(239, 68, 68, ${opacity})`;
}
