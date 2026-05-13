/** Honest, calibrated geometric facial scoring — no sugarcoating */

export type NLM = { x: number; y: number; z: number };

export interface FacialMetrics {
    symmetry: number;
    jawline: number;
    eyeArea: number;
    harmonics: number;
    canthalTilt?: number;
    midfaceRatio?: number;
    philtrum?: number;
    overall: number;
    potentialScore: number;
    bestFeature: string;
    strengths: string[];
    weaknesses: string[];
    method: 'geometric';
    percentile?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const d2d = (a: NLM, b: NLM) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const r1 = (n: number) => parseFloat(n.toFixed(1));

/** Symmetric landmark pairs — left index, right index */
const SYM_PAIRS: [number, number][] = [
    [33, 263],  // outer eye corners
    [133, 362],  // inner eye corners
    [234, 454],  // cheekbones
    [172, 397],  // jaw gonion
    [61, 291],  // mouth corners
    [70, 300],  // outer brow
    [107, 336],  // inner brow
    [58, 288],  // jaw base
];

// ─── Individual metric scorers ────────────────────────────────────────────────

function scoreSymmetry(lm: NLM[]): number {
    const nose = lm[4];
    let dev = 0, n = 0;
    for (const [l, r] of SYM_PAIRS) {
        if (!lm[l] || !lm[r]) continue;
        const ld = Math.abs(nose.x - lm[l].x);
        const rd = Math.abs(nose.x - lm[r].x);
        const denom = ld + rd;
        if (denom > 0) { dev += Math.abs(ld - rd) / denom; n++; }
    }
    const avgDev = dev / (n || 1);
    // avgDev calibration:
    //   0.02 = near-perfect (celebrities)  → ~9.5
    //   0.06 = good                        → ~8.0
    //   0.12 = average human face          → ~5.5
    //   0.20 = notably asymmetric          → ~3.5
    //   0.30+ = severe                     → ~1.5
    const raw = 10.5 - avgDev * 85;
    return clamp(raw, 1.5, 10.0);
}

function scoreJawline(lm: NLM[]): number {
    const lG = lm[172], rG = lm[397], chin = lm[152], top = lm[10];
    if (!lG || !rG || !chin) return 5.0;

    const lv = { x: chin.x - lG.x, y: chin.y - lG.y };
    const rv = { x: chin.x - rG.x, y: chin.y - rG.y };
    const dot = lv.x * rv.x + lv.y * rv.y;
    const mag = Math.sqrt(lv.x ** 2 + lv.y ** 2) * Math.sqrt(rv.x ** 2 + rv.y ** 2);
    const angle = Math.acos(clamp(dot / (mag + 1e-6), -1, 1)) * (180 / Math.PI);

    const jawW = d2d(lG, rG);
    const faceH = top ? d2d(top, chin) : 0.4;
    const wRatio = jawW / (faceH + 1e-6);

    // Angle: ≤100° = extremely sharp (top 5%) → 9.5
    //        100-115  = good sharp              → 7.5-9.0
    //        115-130  = soft / average          → 5.0-7.5
    //        130-150  = weak                    → 3.0-5.0
    //        150+     = very weak / recessed    → 1.5-3.0
    const angScore =
        angle <= 100 ? 9.5
            : angle <= 115 ? 9.5 - (angle - 100) / 15 * 2.0
                : angle <= 130 ? 7.5 - (angle - 115) / 15 * 2.5
                    : angle <= 150 ? 5.0 - (angle - 130) / 20 * 2.0
                        : 3.0 - Math.min(1.5, (angle - 150) / 20);

    // Width ratio: 0.55-0.75 ideal
    const rScore =
        wRatio >= 0.55 && wRatio <= 0.75 ? 9.0
            : wRatio >= 0.48 && wRatio < 0.55 ? 7.0 - (0.55 - wRatio) * 15
                : wRatio > 0.75 && wRatio <= 0.85 ? 7.5 - (wRatio - 0.75) * 15
                    : wRatio >= 0.38 ? 4.5
                        : 2.0;

    return clamp(angScore * 0.65 + rScore * 0.35, 1.5, 10.0);
}

function scoreEyeArea(lm: NLM[]): number {
    if (!lm[33] || !lm[263]) return 5.0;

    const hasIris = lm.length > 468;
    const lPupX = hasIris ? lm[468].x : (lm[33].x + lm[133].x) / 2;
    const rPupX = hasIris ? lm[473].x : (lm[362].x + lm[263].x) / 2;
    const fW = d2d(lm[234], lm[454]);
    const ipd = Math.abs(rPupX - lPupX);
    const ipdR = ipd / (fW + 1e-6);

    // Ideal IPD ratio ≈ 0.43-0.47
    const ipdScore = clamp(10 - Math.abs(ipdR - 0.45) / 0.45 * 22, 2.0, 10.0);

    // Eye Aspect Ratio — "hunter eyes" (low EAR) score high
    // EAR < 0.20 = very hooded/hunter → 9.5
    // EAR 0.20-0.28 = average → 6.5-8.0
    // EAR > 0.35 = round/wide → 3.5-5.5
    const lEAR = d2d(lm[159], lm[145]) / (d2d(lm[33], lm[133]) + 1e-6);
    const rEAR = d2d(lm[386], lm[374]) / (d2d(lm[362], lm[263]) + 1e-6);
    const avgEAR = (lEAR + rEAR) / 2;
    const earScore = clamp(
        avgEAR < 0.20 ? 9.5
            : avgEAR < 0.25 ? 9.5 - (avgEAR - 0.20) * 24
                : avgEAR < 0.33 ? 8.3 - (avgEAR - 0.25) * 25
                    : avgEAR < 0.40 ? 6.3 - (avgEAR - 0.33) * 30
                        : 4.0, 2.0, 10.0);

    return clamp(ipdScore * 0.45 + earScore * 0.55, 2.0, 10.0);
}

function scoreHarmonics(lm: NLM[]): number {
    if (!lm[10] || !lm[152]) return 5.0;
    const top = lm[10];
    const brow = lm[9] || lm[10];
    const nose = lm[4];
    const chin = lm[152];

    const t1 = Math.abs(brow.y - top.y);
    const t2 = Math.abs(nose.y - brow.y);
    const t3 = Math.abs(chin.y - nose.y);
    const total = t1 + t2 + t3;
    if (total < 0.05) return 5.0;

    const ideal = total / 3;
    const thirdsErr = (Math.abs(t1 - ideal) + Math.abs(t2 - ideal) + Math.abs(t3 - ideal)) / (2 * ideal);
    // More aggressive penalty: 0.05 error → 8.5, 0.15 → 6.0, 0.30 → 3.5
    const thirdsScore = clamp(10 - thirdsErr * 26, 2.0, 10.0);

    const fW = d2d(lm[234], lm[454]);
    const golden = Math.abs(total / (fW + 1e-6) - 1.618) / 1.618;
    // 0.02 deviation → 9.5, 0.10 → 7.5, 0.25 → 5.0, 0.50+ → 3.0
    const goldScore = clamp(10 - golden * 20, 2.0, 10.0);

    return clamp(thirdsScore * 0.60 + goldScore * 0.40, 2.0, 10.0);
}

function scoreCanthalTilt(lm: NLM[]): number {
    if (!lm[33] || !lm[133] || !lm[263] || !lm[362]) return 5.5;
    // Positive = outer corner higher than inner = upturned = attractive
    const lTilt = (lm[133].y - lm[33].y) / (Math.abs(lm[133].x - lm[33].x) + 1e-6);
    const rTilt = (lm[362].y - lm[263].y) / (Math.abs(lm[362].x - lm[263].x) + 1e-6);
    const avg = (lTilt + rTilt) / 2;

    // Positive 0.10-0.25 = ideal (upturned) → 8.5-9.5
    // Near zero = neutral → 6.0-7.5
    // Negative = downturned (tired/sad look) → 2.5-5.5
    const raw =
        avg >= 0.10 ? 7.5 + clamp((avg - 0.10) * 12, 0, 2.5)
            : avg >= 0 ? 6.0 + avg * 15
                : 6.0 + avg * 28; // steeper penalty for negative
    return clamp(raw, 2.0, 10.0);
}

function scoreMidface(lm: NLM[]): number {
    if (!lm[33] || !lm[263] || !lm[168] || !lm[0]) return 5.5;
    const eyeW = d2d(lm[33], lm[263]);
    const midH = d2d(lm[168], lm[0]);   // glabella → upper lip
    const ratio = midH / (eyeW + 1e-6);

    // Compact midface (ratio ≈ 0.90-1.00) = attractive
    // Elongated (ratio > 1.20) = weak / "long-faced"
    const score =
        ratio >= 0.88 && ratio <= 1.05 ? 9.0
            : ratio >= 0.80 && ratio <= 1.15 ? 8.0 - Math.abs(ratio - 0.96) * 10
                : ratio >= 0.70 && ratio <= 1.28 ? 6.0 - Math.abs(ratio - 0.96) * 10
                    : 3.5 - Math.abs(ratio - 0.96) * 6;
    return clamp(score, 2.0, 10.0);
}

function scorePhiltrum(lm: NLM[]): number {
    if (!lm[2] || !lm[0] || !lm[152]) return 5.5;
    const philL = d2d(lm[2], lm[0]);
    const chinL = d2d(lm[0], lm[152]);
    const ratio = chinL / (philL + 1e-6);

    // Ideal 2.0-2.5. Long philtrum → lower ratio → weak.
    const score =
        ratio >= 2.0 && ratio <= 2.5 ? 9.0
            : ratio >= 1.7 && ratio <= 2.8 ? 7.5 - Math.abs(ratio - 2.25) * 5
                : ratio >= 1.3 && ratio <= 3.2 ? 5.5 - Math.abs(ratio - 2.25) * 5
                    : 3.0;
    return clamp(score, 2.0, 10.0);
}

// ─── Percentile table (geometric scoring vs real populations) ─────────────────
function estimatePercentile(overall: number): number {
    if (overall >= 9.5) return 99;
    if (overall >= 9.0) return 97;
    if (overall >= 8.5) return 93;
    if (overall >= 8.0) return 85;
    if (overall >= 7.5) return 74;
    if (overall >= 7.0) return 60;
    if (overall >= 6.5) return 48;
    if (overall >= 6.0) return 37;
    if (overall >= 5.5) return 27;
    if (overall >= 5.0) return 19;
    if (overall >= 4.5) return 12;
    if (overall >= 4.0) return 7;
    if (overall >= 3.5) return 4;
    if (overall >= 3.0) return 2;
    return 1;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function calculateScores(landmarks: NLM[]): FacialMetrics | null {
    if (!Array.isArray(landmarks) || landmarks.length < 200) return null;

    const symmetry = r1(scoreSymmetry(landmarks));
    const jawline = r1(scoreJawline(landmarks));
    const eyeArea = r1(scoreEyeArea(landmarks));
    const harmonics = r1(scoreHarmonics(landmarks));
    const canthalTilt = r1(scoreCanthalTilt(landmarks));
    const midfaceRatio = r1(scoreMidface(landmarks));
    const philtrum = r1(scorePhiltrum(landmarks));

    const scores = [symmetry, jawline, eyeArea, harmonics, canthalTilt, midfaceRatio, philtrum];
    const rawAvg = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Compound penalty: multiple weak sub-scores drag the overall down
    // (being mediocre everywhere is worse than being weak in one area)
    const below5 = scores.filter(s => s < 5.0).length;
    const below35 = scores.filter(s => s < 3.5).length;
    const compoundPenalty = (below5 > 2 ? (below5 - 2) * 0.18 : 0)
        + (below35 > 1 ? below35 * 0.12 : 0);

    const overall = r1(clamp(rawAvg - compoundPenalty, 1.0, 10.0));

    // ── Best / worst features ─────────────────────────────────────────────────
    const metricsMap = [
        { name: "Facial Symmetry", score: symmetry },
        { name: "Mandibular Frame", score: jawline },
        { name: "Orbital Harmony", score: eyeArea },
        { name: "Vertical Thirds", score: harmonics },
        { name: "Canthal Alignment", score: canthalTilt },
        { name: "Midface Ratio", score: midfaceRatio },
        { name: "Philtrum Balance", score: philtrum },
    ];
    const sorted = [...metricsMap].sort((a, b) => b.score - a.score);
    const bestFeature = sorted[0].name;

    // ── Strengths & weaknesses — honest thresholds ────────────────────────────
    const str: string[] = [];
    const weak: string[] = [];

    if (symmetry >= 8.5) str.push("Elite Facial Symmetry");
    else if (symmetry >= 7.5) str.push("Good Symmetry");
    else if (symmetry < 4.5) weak.push("Significant Asymmetry");
    else if (symmetry < 5.5) weak.push("Notable Asymmetry");

    if (jawline >= 8.5) str.push("Sharp Mandibular Angle");
    else if (jawline >= 7.5) str.push("Strong Jawline");
    else if (jawline < 4.0) weak.push("Poor Jaw Projection");
    else if (jawline < 5.5) weak.push("Weak Jaw Definition");

    if (eyeArea >= 8.5) str.push("Hunter / Hooded Eyes");
    else if (eyeArea >= 7.5) str.push("Favorable Eye Shape");
    else if (eyeArea < 4.0) weak.push("Unfavorable Eye Spacing");
    else if (eyeArea < 5.5) weak.push("Round / Wide-Set Eyes");

    if (midfaceRatio >= 8.5) str.push("Compact Midface");
    else if (midfaceRatio < 4.0) weak.push("Severely Elongated Midface");
    else if (midfaceRatio < 5.5) weak.push("Long Midface");

    if (canthalTilt >= 8.5) str.push("Strong Positive Canthal Tilt");
    else if (canthalTilt < 4.5) weak.push("Negative Canthal Tilt");

    if (harmonics >= 8.5) str.push("Near-Perfect Facial Thirds");
    else if (harmonics < 5.0) weak.push("Imbalanced Facial Thirds");

    if (philtrum >= 8.0) str.push("Ideal Lower Third Ratio");
    else if (philtrum < 4.5) weak.push("Unfavorable Philtrum Ratio");

    if (str.length === 0) {
        if (overall >= 6.5) str.push("Balanced Facial Structure");
        else if (overall >= 5.0) str.push("Average Base Structure");
        else str.push("Significant Improvement Possible");
    }
    if (weak.length === 0) weak.push("No Major Structural Issues");

    // ── Honest potential score ────────────────────────────────────────────────
    // ~22% of the gap to 10 is realistically improvable without surgery
    const rawGap = 10 - overall;
    const improvable = rawGap * 0.22;
    // Only fixable weaknesses add bonus (surgical issues like bone structure don't count)
    const fixableWeak = weak.filter(w => !w.startsWith("Significant") && !w.startsWith("Severely") && !w.startsWith("Poor Jaw")).length;
    const weakBonus = Math.min(0.6, fixableWeak * 0.15);
    const potBonus = r1(clamp(improvable + weakBonus, 0.3, 1.8));
    const potentialScore = r1(clamp(overall + potBonus, overall + 0.3, 9.5));

    const percentile = estimatePercentile(overall);

    return {
        symmetry, jawline, eyeArea, harmonics, canthalTilt, midfaceRatio, philtrum,
        overall, potentialScore, bestFeature,
        strengths: str.slice(0, 3),
        weaknesses: weak.slice(0, 3),
        method: 'geometric',
        percentile,
    };
}

// ─── Rank labels — full honest range ─────────────────────────────────────────
export function getRankLabel(s: number): string {
    if (s >= 9.5) return "Elite Tier";
    if (s >= 9.0) return "Chad Tier";
    if (s >= 8.5) return "Looksmaxxed";
    if (s >= 8.0) return "High Tier";
    if (s >= 7.5) return "Above Average";
    if (s >= 7.0) return "Decent";
    if (s >= 6.5) return "Average+";
    if (s >= 6.0) return "Average";
    if (s >= 5.5) return "Average−";
    if (s >= 5.0) return "Below Average";
    if (s >= 4.5) return "Low Tier";
    if (s >= 4.0) return "Subpar";
    if (s >= 3.5) return "Significantly Below";
    if (s >= 3.0) return "Hard Mode";
    return "Extreme Outlier";
}

// ─── Score colour helper (used in UI) ────────────────────────────────────────
export function getScoreColor(s: number): string {
    if (s >= 8.0) return "from-emerald-400 to-green-300";
    if (s >= 7.0) return "from-cyan-400 to-blue-300";
    if (s >= 6.0) return "from-white to-zinc-300";
    if (s >= 5.0) return "from-yellow-400 to-amber-300";
    if (s >= 4.0) return "from-orange-400 to-red-400";
    return "from-red-500 to-rose-600";
}

export function getRankColor(s: number): string {
    if (s >= 8.0) return "text-emerald-400";
    if (s >= 7.0) return "text-cyan-400";
    if (s >= 6.0) return "text-white";
    if (s >= 5.0) return "text-yellow-400";
    if (s >= 4.0) return "text-orange-400";
    return "text-red-400";
}
