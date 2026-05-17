const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname: 'localhost', port });
const handle = app.getRequestHandler();

// roomId -> { players: [{id, ready, peerConnected}], spectators: [id], status, offerId, createdAt }
const rooms = new Map();
// Matchmaking queue: array of socket IDs waiting for a random opponent
const matchQueue = [];

app.prepare().then(() => {
    const httpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            const { pathname } = parsedUrl;

            if (pathname === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
                return;
            }

            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error handling', req.url, err);
            res.statusCode = 500;
            res.end('Internal server error');
        }
    });

    const io = new Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        transports: ['websocket', 'polling'],
    });

    // Start countdown when ALL players are face-ready (WebRTC is not a hard gate)
    function tryStartCountdown(roomId, room) {
        if (room.countdownStarted) return;
        if (room.players.length < 2) return;
        const allReady = room.players.every((p) => p.ready);
        if (allReady) {
            room.countdownStarted = true;
            room.status = 'countdown';
            console.log(`[Server] All ready in ${roomId}, starting countdown`);
            io.to(roomId).emit('start-countdown');
        }
    }

    // Force-start countdown after 6s timeout if players are ready but WebRTC is stalling
    function scheduleCountdownTimeout(roomId) {
        setTimeout(() => {
            const room = rooms.get(roomId);
            if (!room || room.countdownStarted) return;
            if (room.players.length >= 2 && room.players.every(p => p.ready)) {
                console.log(`[Server] Countdown timeout triggered for ${roomId}`);
                room.countdownStarted = true;
                room.status = 'countdown';
                io.to(roomId).emit('start-countdown');
            }
        }, 6000);
    }

    // ── Room timeout cleanup — runs every 5 minutes ──────────────────────────
    setInterval(() => {
        const now = Date.now();
        for (const [roomId, room] of rooms.entries()) {
            // Cleanup conditions:
            // 1. Room is empty (no players AND no spectators)
            // 2. Room is older than 15 mins and never started
            // 3. Room is older than 30 mins (absolute safety)
            const isStale = (now - room.createdAt > 15 * 60 * 1000 && room.status === 'waiting');
            const isDead = (room.players.length === 0 && room.spectators.length === 0);
            const isAncient = (now - room.createdAt > 30 * 60 * 1000);

            if (isStale || isDead || isAncient) {
                rooms.delete(roomId);
                console.log(`[Server] Cleaned up room: ${roomId} (Reason: ${isStale ? 'Stale' : isDead ? 'Empty' : 'Ancient'})`);
            }
        }
    }, 5 * 60 * 1000);

    io.on('connection', (socket) => {
        console.log('[Server] User connected:', socket.id);

        // ── Create Room ──────────────────────────────────────────────────────
        socket.on('create-room', () => {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            rooms.set(roomId, {
                players: [{ id: socket.id, ready: false, peerConnected: false }],
                spectators: [],
                status: 'waiting',
                createdAt: Date.now(),
            });
            socket.join(roomId);
            socket.emit('room-created', roomId);
            console.log(`[Server] Room created: ${roomId} by ${socket.id}`);
        });

        // ── Random Matchmaking ────────────────────────────────────────────────
        socket.on('find-match', () => {
            // Remove if already queued
            const qi = matchQueue.indexOf(socket.id);
            if (qi !== -1) matchQueue.splice(qi, 1);

            if (matchQueue.length > 0) {
                // Pair with the first waiting player
                const peerId = matchQueue.shift();
                const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
                rooms.set(roomId, {
                    players: [
                        { id: peerId, ready: false, peerConnected: false },
                        { id: socket.id, ready: false, peerConnected: false },
                    ],
                    spectators: [],
                    status: 'waiting',
                    createdAt: Date.now(),
                });
                // Join both sockets to the room
                const peerSocket = io.sockets.sockets.get(peerId);
                if (peerSocket) peerSocket.join(roomId);
                socket.join(roomId);

                io.to(roomId).emit('match-found', { roomId, playerCount: 2 });
                io.to(roomId).emit('room-ready');
                io.to(peerId).emit('should-create-offer', { roomId });
                console.log(`[Matchmaking] Paired ${peerId} and ${socket.id} in ${roomId}`);
            } else {
                matchQueue.push(socket.id);
                socket.emit('match-queued', { position: matchQueue.length });
                console.log(`[Matchmaking] ${socket.id} queued (queue size: ${matchQueue.length})`);
            }
        });

        socket.on('cancel-match', () => {
            const qi = matchQueue.indexOf(socket.id);
            if (qi !== -1) { matchQueue.splice(qi, 1); socket.emit('match-cancelled'); }
        });

        socket.on('join-room', (roomId) => {
            roomId = String(roomId).toUpperCase().trim();

            if (!rooms.has(roomId)) {
                socket.emit('room-error', 'Room not found');
                return;
            }

            const room = rooms.get(roomId);

            // Check if player is already in this room
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex === -1) {
                if (room.players.length >= 2) {
                    // 3rd+ player joins as spectator
                    if (!room.spectators.includes(socket.id)) {
                        room.spectators.push(socket.id);
                    }
                    socket.join(roomId);
                    socket.emit('joined-as-spectator', {
                        roomId,
                        playerCount: room.players.length,
                        status: room.status,
                    });
                    console.log(`[Server] ${socket.id} joined ${roomId} as spectator`);
                    return;
                }
                room.players.push({ id: socket.id, ready: false, peerConnected: false });
            }

            socket.join(roomId);

            // Send info to the joiner immediately
            // Offerer is always the first player in the room
            const offerId = room.players[0].id;
            socket.emit('joined-room-info', {
                roomId,
                playerCount: room.players.length,
                status: room.status,
                isOfferer: offerId === socket.id,
            });

            // Broadcast update to the whole room
            io.to(roomId).emit('player-joined', {
                roomId,
                playerCount: room.players.length,
            });

            process.stdout.write(`[Server] ${socket.id} joined room ${roomId} (${room.players.length}/2)\n`);

            if (room.players.length === 2) {
                // IMPORTANT: Re-emitting these ensures sync even if events were missed during navigation
                io.to(roomId).emit('room-ready');
                // The first player is always the offerer
                io.to(offerId).emit('should-create-offer', { roomId });
            }
        });

        // ── Player Ready (face detected) ──────────────────────────────────────
        socket.on('player-ready', (roomId) => {
            roomId = String(roomId).toUpperCase().trim();
            if (!rooms.has(roomId)) return;
            const room = rooms.get(roomId);
            if (room.countdownStarted) return;

            const player = room.players.find((p) => p.id === socket.id);
            if (player) player.ready = true;
            console.log(`[Server] player-ready in ${roomId} from ${socket.id}`);

            tryStartCountdown(roomId, room);
            scheduleCountdownTimeout(roomId);
        });

        // ── Peer Connected (WebRTC handshake complete) ─────────────────────────
        socket.on('peer-connected', (roomId) => {
            roomId = String(roomId).toUpperCase().trim();
            if (!rooms.has(roomId)) return;
            const room = rooms.get(roomId);
            if (room.countdownStarted) return;

            const player = room.players.find((p) => p.id === socket.id);
            if (player) player.peerConnected = true;
            console.log(`[Server] peer-connected in ${roomId} from ${socket.id}`);

            tryStartCountdown(roomId, room);
        });

        // ── WebRTC Signaling ──────────────────────────────────────────────────
        socket.on('send-signal', ({ roomId, signal }) => {
            console.log(`[Signal] Relay ${signal.type} in ${roomId} from ${socket.id}`);
            socket.to(roomId).emit('receive-signal', { signal, from: socket.id });
        });

        // ── Share Final Score & ELO Update ───────────────────────────────────
        socket.on('share-score', ({ roomId, metrics, elo }) => {
            socket.to(roomId).emit('opponent-score', { metrics, elo });
            console.log(`[Server] ${socket.id} shared score in ${roomId}: ${metrics.overall}`);
        });

        // ── Disconnect ────────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            console.log('[Server] User disconnected:', socket.id);
            for (const [roomId, room] of rooms.entries()) {
                // Remove from spectators
                const sIdx = room.spectators?.indexOf(socket.id) ?? -1;
                if (sIdx !== -1) { room.spectators.splice(sIdx, 1); break; }

                const idx = room.players.findIndex((p) => p.id === socket.id);
                if (idx !== -1) {
                    room.players.splice(idx, 1);
                    io.to(roomId).emit('player-left', socket.id);
                    if (room.players.length === 0) {
                        rooms.delete(roomId);
                        console.log(`[Server] Room ${roomId} deleted (empty)`);
                    }
                    break;
                }
            }
        });
    });

    httpServer.listen(port, hostname, () => {
        const localIP = require('os').networkInterfaces();
        console.log(`\n> Face-Off server ready on http://localhost:${port}`);
        Object.values(localIP).flat().forEach((iface) => {
            if (iface && iface.family === 'IPv4' && !iface.internal) {
                console.log(`> LAN access: http://${iface.address}:${port}`);
            }
        });
        console.log('');
    });
});
