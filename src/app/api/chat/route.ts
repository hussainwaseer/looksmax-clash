import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: "GEMINI_API_KEY is not set. Add it to your .env.local file or Render.com settings." },
            { status: 500 }
        );
    }

    try {
        const { metrics, messages } = await req.json();

        if (!metrics || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // System Instruction Persona: Brutal. Honest. Data-driven.
        const systemInstruction = `You are a brutal, no-nonsense Looksmax AI Guru. Technical, honest, no sugarcoating.
DATA: Score ${metrics.overall}/10, Sym: ${metrics.symmetry}, Jaw: ${metrics.jawline}, Eyes: ${metrics.eyeArea}, Ratio: ${metrics.harmonics}, Best: ${metrics.bestFeature}, Strengths: ${metrics.strengths?.join(", ")}, Weaknesses: ${metrics.weaknesses?.join(", ")}.
GUIDELINES:
- Direct & technical. Reference metrics.
- Actionable advice.
- Max 3-5 sentences.`;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction,
        });

        // Transform simplified frontend history to Gemini history
        const geminiHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];

        // Skip the very first AI message as it's defined in the UI
        const historyMsgs = messages.slice(1, -1);

        for (const m of historyMsgs) {
            const role = m.role === "user" ? "user" : "model";
            // Simple alternation check
            if (geminiHistory.length > 0 && geminiHistory[geminiHistory.length - 1].role === role) continue;
            geminiHistory.push({ role, parts: [{ text: m.content }] });
        }

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== "user") {
            return NextResponse.json({ error: "Last message must be from user." }, { status: 400 });
        }

        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessage(lastMessage.content);
        const text = result.response.text();

        if (!text) {
            throw new Error("AI returned an empty response.");
        }

        return NextResponse.json({ content: text });
    } catch (error: any) {
        console.error("[AI Chat Error]:", error?.message ?? error);

        // Detect rate limits explicitly
        if (error?.message?.includes("429") || error?.message?.includes("quota")) {
            return NextResponse.json({ error: "RATE_LIMIT", message: "AI is currently busy. Retrying..." }, { status: 429 });
        }

        return NextResponse.json({
            error: "SYNC_ERROR",
            message: "AI neural sync failure. Please try again."
        }, { status: 500 });
    }
}
