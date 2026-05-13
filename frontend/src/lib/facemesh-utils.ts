/** MediaPipe Face Mesh drawing utilities */
import { NLM } from './scoring';

// Key landmark index groups
export const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
export const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
export const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
export const L_BROW = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336];
export const R_BROW = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107];
export const OUTER_LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
export const NOSE_RIDGE = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2];
export const LEFT_IRIS = [468, 469, 470, 471, 472];
export const RIGHT_IRIS = [473, 474, 475, 476, 477];

function lx(lm: NLM, w: number) { return lm.x * w; }
function ly(lm: NLM, h: number) { return lm.y * h; }

function path(
    ctx: CanvasRenderingContext2D,
    idx: number[], lm: NLM[], w: number, h: number,
    color: string, lw: number, close = false
) {
    if (!idx.length || !lm[idx[0]]) return;
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.moveTo(lx(lm[idx[0]], w), ly(lm[idx[0]], h));
    for (let i = 1; i < idx.length; i++) {
        const p = lm[idx[i]];
        if (!p) continue;
        ctx.lineTo(lx(p, w), ly(p, h));
    }
    if (close) ctx.closePath();
    ctx.stroke();
}

function iris(ctx: CanvasRenderingContext2D, idx: number[], lm: NLM[], w: number, h: number) {
    if (!lm[idx[0]] || !lm[idx[1]]) return;
    const cx = lx(lm[idx[0]], w), cy = ly(lm[idx[0]], h);
    const r = Math.abs(lx(lm[idx[1]], w) - cx) * 1.3;
    ctx.beginPath(); ctx.strokeStyle = 'rgba(0,220,255,0.95)'; ctx.lineWidth = 1.5;
    ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.fillStyle = 'rgba(0,220,255,0.95)';
    ctx.arc(cx, cy, 2.2, 0, Math.PI * 2); ctx.fill();
}

function scannerBrackets(ctx: CanvasRenderingContext2D, lm: NLM[], w: number, h: number, detected: boolean) {
    const pts = FACE_OVAL.map(i => lm[i]).filter(Boolean);
    if (!pts.length) return;
    const xs = pts.map(p => p.x * w), ys = pts.map(p => p.y * h);
    const p = 14;
    const bx = Math.min(...xs) - p, by = Math.min(...ys) - p;
    const bw = Math.max(...xs) - Math.min(...xs) + p * 2;
    const bh = Math.max(...ys) - Math.min(...ys) + p * 2;
    const cL = 18;
    const clr = detected ? 'rgba(0,255,160,0.95)' : 'rgba(255,60,60,0.7)';
    ctx.strokeStyle = clr; ctx.lineWidth = 2;
    // 4 corners
    [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]].forEach(([cx, cy, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy + sy * cL); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * cL, cy);
        ctx.stroke();
    });
    // Label
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = clr;
    ctx.fillText(detected ? 'FACE DETECTED ●' : 'NO FACE ✗', bx, by - 6);
}

export function drawFaceMesh(
    ctx: CanvasRenderingContext2D,
    landmarks: NLM[],
    w: number, h: number,
    detected: boolean
) {
    ctx.clearRect(0, 0, w, h);

    if (!detected || landmarks.length < 100) {
        // Dashed oval "searching" indicator
        ctx.strokeStyle = 'rgba(255,100,100,0.5)';
        ctx.lineWidth = 1.5; ctx.setLineDash([7, 4]);
        ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.18, h * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'bold 11px Inter, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,100,100,0.7)';
        ctx.textAlign = 'center'; ctx.fillText('POSITION YOUR FACE', w / 2, h / 2 + h * 0.35);
        ctx.textAlign = 'left';
        return;
    }

    const lm = landmarks;

    // — All micro-dots (live tracing effect)
    // OPTIMIZATION: Use fillRect for performance and draw only alternate dots to save CPU
    ctx.fillStyle = 'rgba(0, 255, 120, 0.7)';
    for (let i = 0; i < Math.min(lm.length, 468); i += 2) {
        const p = lm[i];
        if (!p) continue;
        ctx.fillRect(lx(p, w) - 1, ly(p, h) - 1, 2, 2);
    }

    // — Feature paths - highly visible neon green to emphasize real-time scanning
    path(ctx, FACE_OVAL, lm, w, h, 'rgba(0, 255, 120, 0.95)', 1.5, true);
    path(ctx, LEFT_EYE, lm, w, h, 'rgba(0, 255, 120, 0.95)', 1.5, true);
    path(ctx, RIGHT_EYE, lm, w, h, 'rgba(0, 255, 120, 0.95)', 1.5, true);
    path(ctx, OUTER_LIPS, lm, w, h, 'rgba(0, 255, 100, 0.95)', 1.5, true);
    path(ctx, NOSE_RIDGE, lm, w, h, 'rgba(255, 255, 255, 0.3)', 1, false);

    // — Iris circles (refineLandmarks)
    if (lm.length > 468) {
        iris(ctx, LEFT_IRIS, lm, w, h);
        iris(ctx, RIGHT_IRIS, lm, w, h);
    }

    // — Key landmark accent dots
    const accents = [4, 1, 152, 172, 397];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    accents.forEach(i => {
        const p = lm[i];
        if (!p) return;
        ctx.beginPath(); ctx.arc(lx(p, w), ly(p, h), 2.5, 0, Math.PI * 2); ctx.fill();
    });

    // — Scanner brackets
    scannerBrackets(ctx, lm, w, h, true);

    // — Midline
    if (lm[10] && lm[152]) {
        ctx.strokeStyle = 'rgba(0, 255, 120, 0.15)';
        ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(lx(lm[10], w), ly(lm[10], h));
        ctx.lineTo(lx(lm[152], w), ly(lm[152], h));
        ctx.stroke(); ctx.setLineDash([]);
    }
}
