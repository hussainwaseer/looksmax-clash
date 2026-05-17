"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

interface UserProfile {
    uid?: string;
    username: string;
    elo: number;
    battles: number;
    wins: number;
    history: { date: string; score: number }[];
    avatarUrl?: string;
    bio?: string;
    socials?: {
        instagram?: string;
        tiktok?: string;
    }
}

interface UserContextType {
    profile: UserProfile;
    user: User | null;
    loading: boolean;
    updateElo: (change: number, won: boolean) => Promise<void>;
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    saveScan: (score: number) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile>({
        username: "Guest",
        elo: 1000,
        battles: 0,
        wins: 0,
        history: [],
    });

    // 1. Listen for Auth State Changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                // User logged in — listen to Firestore
                const userDoc = doc(db, "users", u.uid);
                const unsubDoc = onSnapshot(userDoc, (snap) => {
                    if (snap.exists()) {
                        setProfile(snap.data() as UserProfile);
                    } else {
                        // Initialize new user with Guest data if available
                        const guestData = localStorage.getItem("looksmax_user_profile");
                        const proto = guestData ? JSON.parse(guestData) : profile;
                        const newProfile = { ...proto, uid: u.uid };
                        setDoc(userDoc, newProfile);
                    }
                });
                setLoading(false);
                return () => unsubDoc();
            } else {
                // Not logged in — load from localStorage
                const saved = localStorage.getItem("looksmax_user_profile");
                if (saved) {
                    try {
                        setProfile(JSON.parse(saved));
                    } catch (e) {
                        console.error("Failed to load local profile", e);
                    }
                }
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []); // eslint-disable-line

    const updateElo = async (change: number, won: boolean) => {
        const next = {
            ...profile,
            elo: Math.max(0, profile.elo + change),
            battles: profile.battles + 1,
            wins: won ? profile.wins + 1 : profile.wins,
        };

        if (user) {
            await setDoc(doc(db, "users", user.uid), next, { merge: true });
        } else {
            setProfile(next);
            localStorage.setItem("looksmax_user_profile", JSON.stringify(next));
        }
    };

    const updateProfile = async (data: Partial<UserProfile>) => {
        const next = { ...profile, ...data };
        if (user) {
            await setDoc(doc(db, "users", user.uid), next, { merge: true });
        } else {
            setProfile(next);
            localStorage.setItem("looksmax_user_profile", JSON.stringify(next));
        }
    };

    const saveScan = async (score: number) => {
        const history = [...(profile.history || []), { date: new Date().toISOString(), score }];
        const next = { ...profile, history };

        if (user) {
            await setDoc(doc(db, "users", user.uid), next, { merge: true });
        } else {
            setProfile(next);
            localStorage.setItem("looksmax_user_profile", JSON.stringify(next));
        }
    };

    return (
        <UserContext.Provider value={{ profile, user, loading, updateElo, updateProfile, saveScan }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
}
