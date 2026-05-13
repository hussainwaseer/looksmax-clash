"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { socket } from "@/lib/socket"
import { Socket } from "socket.io-client"

const SocketContext = createContext<Socket | null>(null)

export function SocketProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        socket.connect()
        return () => {
            socket.disconnect()
        }
    }, [])

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    )
}

export const useSocket = () => {
    const context = useContext(SocketContext)
    if (!context) {
        throw new Error("useSocket must be used within a SocketProvider")
    }
    return context
}
