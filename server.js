const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname: 'localhost', port });
const handle = app.getRequestHandler();

// roomId -> { players: [{id, ready, peerConnected}], status, offerId }
const rooms = new Map();

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

    // Start countdown only when ALL players are face-ready AND WebRTC peer-connected
    function tryStartCountdown(roomId, room) {
        if (room.countdownStarted) return;
        if (room.players.length < 2) return;
        const allReady = room.players.every((p) => p.ready);
        const allConnected = room.players.every((p) => p.peerConnected);
        if (allReady && allConnected) {
            room.countdownStarted = true;
            room.status = 'countdown';
            console.log(`[Server] All ready+connected in ${roomId}, starting countdown`);
            io.to(roomId).emit('start-countdown');
        }
    }

    io.on('connection', (socket) => {
        console.log('[Server] User connected:', socket.id);

        // ── Create Room ──────────────────────────────────────────────────────
        socket.on('create-room', () => {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            rooms.set(roomId, {
                players: [{ id: socket.id, ready: false, peerConnected: false }],
                status: 'waiting',
            });
            socket.join(roomId);
            socket.emit('room-created', roomId);
            console.log(`[Server] Room created: ${roomId} by ${socket.id}`);
        });

        // ── Join Room ─────────────────────────────────────────────────────────
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
                    socket.emit('room-error', 'Room is full');
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

        // ── Share Final Score ─────────────────────────────────────────────────
        socket.on('share-score', ({ roomId, metrics }) => {
            socket.to(roomId).emit('opponent-score', { metrics });
        });

        // ── Disconnect ────────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            console.log('[Server] User disconnected:', socket.id);
            for (const [roomId, room] of rooms.entries()) {
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
