"use client";

import React from "react";
import { motion } from "framer-motion";

interface HistoryPoint {
    date: string;
    score: number;
}

export function HistoryGraph({ history }: { history: HistoryPoint[] }) {
    if (history.length < 2) {
        return (
            <div className="w-full h-32 flex flex-col items-center justify-center border border-white/5 bg-white/3 rounded-2xl">
                <p className="text-zinc-600 text-[10px] uppercase font-black">Not enough data to graph</p>
                <p className="text-zinc-700 text-[8px] uppercase font-bold mt-1">Complete more scans to see progress</p>
            </div>
        );
    }

    const width = 400;
    const height = 120;
    const padding = 10;
    const maxScore = 10;

    // Sort by date and take last 10
    const data = [...history]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-10);

    const getX = (index: number) => padding + (index * (width - 2 * padding)) / (data.length - 1);
    const getY = (score: number) => height - padding - (score * (height - 2 * padding)) / maxScore;

    const points = data.map((p, i) => `${getX(i)},${getY(p.score)}`).join(" ");

    return (
        <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Score Progress</span>
                <div className="flex gap-2">
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        <span className="text-[8px] text-zinc-600 font-bold uppercase">Rating</span>
                    </div>
                </div>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible">
                {/* Horizontal grid lines */}
                {[0, 2.5, 5, 7.5, 10].map(val => (
                    <line
                        key={val}
                        x1={padding} y1={getY(val)} x2={width - padding} y2={getY(val)}
                        stroke="rgba(255,255,255,0.05)" strokeWidth="1"
                    />
                ))}

                {/* The Line */}
                <motion.polyline
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                />

                {/* Points */}
                {data.map((p, i) => (
                    <motion.circle
                        key={i}
                        cx={getX(i)} cy={getY(p.score)} r="4"
                        fill="#06b6d4" stroke="#000" strokeWidth="2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1 + i * 0.1 }}
                    />
                ))}

                <defs>
                    <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#9d00ff" />
                        <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                </defs>
            </svg>

            <div className="flex justify-between mt-2">
                <span className="text-[8px] text-zinc-700 font-bold uppercase">Earlier</span>
                <span className="text-[8px] text-zinc-700 font-bold uppercase">Today</span>
            </div>
        </div>
    );
}
