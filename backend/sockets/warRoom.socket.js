/**
 * Redstring — War Room Socket.io Handler
 * =========================================
 * Namespace: /war-room
 *
 * This is the real-time engine for multiplayer investigations.
 * Every socket event here is broadcast to all members of the same room.
 *
 * Channel naming convention:
 *   `room:{roomCode}` — all sockets in this room receive shared events
 *   `user:{userId}` — private channel for one player
 *
 * ─────────────────────────────────────────────
 *  EVENTS (client → server)
 * ─────────────────────────────────────────────
 *   room:join              Join a War Room channel
 *   room:leave             Leave a War Room channel
 *   board:pin              Add a pin to the shared corkboard
 *   board:unpin            Remove a pin from the corkboard
 *   board:string           Add a red string between two pins
 *   board:unstring         Remove a string
 *   board:update-note      Edit a pin's annotation note
 *   player:move            Update your position in a scene (for proximity chat)
 *   player:scene-enter     Player entered a scene
 *   chat:typing            Typing indicator
 *   voice:signal           WebRTC signalling message (offer/answer/ice)
 *   clue:share             Share a found clue with the team
 *   theory:post            Post a theory to the board
 *
 * ─────────────────────────────────────────────
 *  EVENTS (server → client)
 * ─────────────────────────────────────────────
 *   room:state             Full room state on join
 *   member:joined          New member joined
 *   member:left            Member left
 *   member:online          Member came back online
 *   member:offline         Member went offline
 *   board:updated          Board changed (full board sent)
 *   board:pin-added        Single pin added (optimistic update)
 *   board:pin-removed      Single pin removed
 *   board:string-added     String added
 *   board:string-removed   String removed
 *   board:note-updated     Pin note updated
 *   player:moved           Player position updated (for proximity audio)
 *   player:scene-entered   Player entered a scene
 *   chat:message           New chat message
 *   chat:typing            Typing indicator
 *   clue:discovered        A clue was found
 *   alibi:cracked          A suspect alibi layer was broken
 *   twist:fired            A narrative twist event
 *   lab:submitted          Evidence submitted to lab
 *   lab:result             Lab timer completed, result in
 *   vote:opened            Accusation vote proposed
 *   vote:updated           Someone voted
 *   vote:failed            Vote didn't pass
 *   accusation:resolved    Final accusation result
 *   weather:changed        Weather condition changed
 *   jump:scare             Jump scare event triggered
 *   investigation:started  Host started the case
 *   error                  Server-side error
 */

const Room = require('../schema/room.schema');
const { socketAuth } = require('../middleware/auth.middleware');
const { setCache, getFromCache } = require('../services/redisService');

function registerWarRoomHandlers(nsp) {

    // ── Auth middleware on namespace ─────────────
    nsp.use(socketAuth);

    nsp.on('connection', (socket) => {
        const { userId, displayName, avatarKey } = socket.data.user;
        console.log(`[WarRoom] ${displayName} connected — socket ${socket.id}`);

        // ── JOIN ROOM ────────────────────────────────
        socket.on('room:join', async ({ roomCode }, ack) => {
            try {
                const room = await Room.findOne({ roomCode });
                if (!room) return ack?.({ error: 'Room not found' });

                const isMember = room.members.some(m => m.userId === userId);
                if (!isMember) return ack?.({ error: 'You are not a member of this room' });

                // Join the Socket.io channel for this room
                socket.join(`room:${roomCode}`);
                // Also join a personal channel
                socket.join(`user:${userId}`);

                // Store roomCode on socket for quick lookup on disconnect
                socket.data.roomCode = roomCode;

                // Mark member as online in DB
                await Room.updateOne(
                    { roomCode, 'members.userId': userId },
                    { $set: { 'members.$.isOnline': true, 'members.$.lastSeenAt': new Date() } }
                );

                // Notify others
                socket.to(`room:${roomCode}`).emit('member:online', { userId, displayName });

                // Send the current room state to the joining socket
                const cached = await getFromCache(`room:${roomCode}`);
                ack?.({ success: true, room: cached || room.toObject() });

            } catch (err) {
                console.error('[WarRoom] room:join error', err);
                ack?.({ error: 'Server error' });
            }
        });

        // ── LEAVE ROOM ───────────────────────────────
        socket.on('room:leave', async ({ roomCode }) => {
            await handleLeave(socket, roomCode, userId, displayName);
        });

        // ── DISCONNECT ───────────────────────────────
        socket.on('disconnect', async () => {
            const roomCode = socket.data.roomCode;
            if (roomCode) {
                await Room.updateOne(
                    { roomCode, 'members.userId': userId },
                    { $set: { 'members.$.isOnline': false, 'members.$.lastSeenAt': new Date() } }
                );
                socket.to(`room:${roomCode}`).emit('member:offline', { userId, displayName });
            }
            console.log(`[WarRoom] ${displayName} disconnected`);
        });

        // ─────────────────────────────────────────────
        //  SHARED CORKBOARD EVENTS
        // ─────────────────────────────────────────────

        /**
         * board:pin — Player pins a clue to the corkboard
         * Broadcast immediately for optimistic UI, then persist to DB
         */
        socket.on('board:pin', async ({ roomCode, pin }) => {
            try {
                // Validate pin has required fields
                if (!pin?.clueId || pin?.x == null || pin?.y == null) return;

                const pinData = {
                    pinId:     `pin_${Date.now()}_${userId.slice(-4)}`,
                    clueId:    pin.clueId,
                    pinnedBy:  userId,
                    x:         Math.max(0, Math.min(100, pin.x)),
                    y:         Math.max(0, Math.min(100, pin.y)),
                    note:      pin.note || '',
                    color:     pin.color || 'yellow',
                    pinnedAt:  new Date(),
                };

                // Broadcast to ALL room members (including sender) for consistency
                nsp.to(`room:${roomCode}`).emit('board:pin-added', {
                    pin:       pinData,
                    pinnedBy:  displayName,
                });

                // Persist to DB + update cache
                await Room.updateOne(
                    { roomCode },
                    {
                        $push: { 'evidenceBoard.pins': pinData },
                        $inc:  { 'evidenceBoard.version': 1 },
                    }
                );
                await invalidateRoomCache(roomCode);

            } catch (err) { console.error('[WarRoom] board:pin error', err); }
        });

        /**
         * board:unpin — Remove a pin and all strings connected to it
         */
        socket.on('board:unpin', async ({ roomCode, pinId }) => {
            try {
                nsp.to(`room:${roomCode}`).emit('board:pin-removed', { pinId, removedBy: displayName });

                await Room.updateOne(
                    { roomCode },
                    {
                        $pull: {
                            'evidenceBoard.pins':    { pinId },
                            // Also remove any strings connected to this pin
                            'evidenceBoard.strings': { $or: [{ fromPinId: pinId }, { toPinId: pinId }] },
                        },
                        $inc: { 'evidenceBoard.version': 1 },
                    }
                );
                await invalidateRoomCache(roomCode);
            } catch (err) { console.error('[WarRoom] board:unpin error', err); }
        });

        /**
         * board:string — Draw a red string between two pins
         */
        socket.on('board:string', async ({ roomCode, string }) => {
            try {
                if (!string?.fromPinId || !string?.toPinId) return;

                const stringData = {
                    stringId:  `str_${Date.now()}_${userId.slice(-4)}`,
                    fromPinId: string.fromPinId,
                    toPinId:   string.toPinId,
                    label:     string.label || '',
                    color:     string.color || 'red',
                    createdBy: userId,
                };

                nsp.to(`room:${roomCode}`).emit('board:string-added', {
                    string:    stringData,
                    createdBy: displayName,
                });

                await Room.updateOne(
                    { roomCode },
                    {
                        $push: { 'evidenceBoard.strings': stringData },
                        $inc:  { 'evidenceBoard.version': 1 },
                    }
                );
                await invalidateRoomCache(roomCode);
            } catch (err) { console.error('[WarRoom] board:string error', err); }
        });

        /**
         * board:unstring — Remove a string
         */
        socket.on('board:unstring', async ({ roomCode, stringId }) => {
            try {
                nsp.to(`room:${roomCode}`).emit('board:string-removed', { stringId });
                await Room.updateOne(
                    { roomCode },
                    { $pull: { 'evidenceBoard.strings': { stringId } }, $inc: { 'evidenceBoard.version': 1 } }
                );
                await invalidateRoomCache(roomCode);
            } catch (err) { console.error('[WarRoom] board:unstring error', err); }
        });

        /**
         * board:update-note — Edit annotation on a pin
         */
        socket.on('board:update-note', async ({ roomCode, pinId, note }) => {
            try {
                nsp.to(`room:${roomCode}`).emit('board:note-updated', { pinId, note, updatedBy: displayName });
                await Room.updateOne(
                    { roomCode, 'evidenceBoard.pins.pinId': pinId },
                    { $set: { 'evidenceBoard.pins.$.note': note } }
                );
                await invalidateRoomCache(roomCode);
            } catch (err) { console.error('[WarRoom] board:update-note error', err); }
        });

        // ─────────────────────────────────────────────
        //  PLAYER POSITION (for proximity chat)
        // ─────────────────────────────────────────────

        /**
         * player:move — Player moves within a scene
         * Used by the proximity audio system to calculate voice volume
         * Throttle this client-side to max 5 updates/second
         */
        socket.on('player:move', async ({ roomCode, sceneId, x, y }) => {
            try {
                // Update in room doc
                await Room.updateOne(
                    { roomCode, 'members.userId': userId },
                    {
                        $set: {
                            'members.$.currentSceneId':     sceneId,
                            'members.$.voicePosition.x':    x,
                            'members.$.voicePosition.y':    y,
                            'members.$.voicePosition.sceneId': sceneId,
                        }
                    }
                );
                // Broadcast position to teammates (excluding self)
                socket.to(`room:${roomCode}`).emit('player:moved', {
                    userId, sceneId, x, y, displayName,
                });
            } catch (err) { /* position updates are best-effort */ }
        });

        /**
         * player:scene-enter — Player entered a scene
         * Triggers atmospheric/ambient changes on all clients in that scene
         */
        socket.on('player:scene-enter', async ({ roomCode, sceneId }) => {
            try {
                socket.to(`room:${roomCode}`).emit('player:scene-entered', {
                    userId, displayName, sceneId,
                });
                // Update the member current scene
                await Room.updateOne(
                    { roomCode, 'members.userId': userId },
                    { $set: { 'members.$.currentSceneId': sceneId } }
                );
            } catch (err) { console.error('[WarRoom] scene-enter error', err); }
        });

        // ─────────────────────────────────────────────
        //  VOICE CHAT — WebRTC SIGNALLING
        // ─────────────────────────────────────────────

        /**
         * voice:signal — Pass WebRTC offer/answer/ICE candidates
         * between two specific peers (peer-to-peer, server is relay only)
         *
         * The audio processing (radio filter, proximity volume) happens
         * on the client side using the Web Audio API.
         */
        socket.on('voice:signal', ({ roomCode, targetUserId, signal }) => {
            // Forward signal only to the target user
            nsp.to(`user:${targetUserId}`).emit('voice:signal', {
                fromUserId:  userId,
                displayName,
                signal,       // { type: 'offer' | 'answer' | 'candidate', sdp/candidate }
            });
        });

        // ─────────────────────────────────────────────
        //  CHAT
        // ─────────────────────────────────────────────

        /**
         * chat:typing — Show typing indicator (expires after 3s of no activity)
         */
        socket.on('chat:typing', ({ roomCode, isTyping }) => {
            socket.to(`room:${roomCode}`).emit('chat:typing', { userId, displayName, isTyping });
        });

        // ─────────────────────────────────────────────
        //  CLUE SHARING
        // ─────────────────────────────────────────────

        /**
         * clue:share — A player highlights a clue in chat with full context
         */
        socket.on('clue:share', async ({ roomCode, clueId, comment }) => {
            try {
                const { nanoid } = require('nanoid');
                const message = {
                    messageId: nanoid(8),
                    userId,
                    type:      'clue_share',
                    clueId,
                    text:      comment || '',
                    sentAt:    new Date(),
                };

                nsp.to(`room:${roomCode}`).emit('chat:message', {
                    ...message,
                    displayName,
                    avatarKey,
                });

                // Persist to chat log
                await Room.updateOne(
                    { roomCode },
                    { $push: { chatLog: { $each: [message], $slice: -200 } } }
                );
            } catch (err) { console.error('[WarRoom] clue:share error', err); }
        });

        /**
         * theory:post — Post a theory (links to suspect)
         */
        socket.on('theory:post', async ({ roomCode, suspectId, theoryText }) => {
            try {
                const { nanoid } = require('nanoid');
                const message = {
                    messageId: nanoid(8),
                    userId,
                    type:      'theory',
                    text:      `🔍 Theory: ${theoryText}`,
                    sentAt:    new Date(),
                };

                nsp.to(`room:${roomCode}`).emit('chat:message', {
                    ...message,
                    displayName,
                    avatarKey,
                    suspectId,
                });

                await Room.updateOne(
                    { roomCode },
                    { $push: { chatLog: { $each: [message], $slice: -200 } } }
                );
            } catch (err) { console.error('[WarRoom] theory:post error', err); }
        });

    }); // end nsp.on('connection')
}

// ─────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────

async function handleLeave(socket, roomCode, userId, displayName) {
    socket.leave(`room:${roomCode}`);
    socket.data.roomCode = null;

    await Room.updateOne(
        { roomCode, 'members.userId': userId },
        { $set: { 'members.$.isOnline': false } }
    );

    socket.to(`room:${roomCode}`).emit('member:offline', { userId, displayName });
}

async function invalidateRoomCache(roomCode) {
    const room = await Room.findOne({ roomCode });
    if (room) await setCache(`room:${roomCode}`, room.toObject(), 60 * 60 * 24);
}

// ─────────────────────────────────────────────
//  BROADCAST HELPERS (called by cronService)
// ─────────────────────────────────────────────

/**
 * Called by cron when a lab timer completes.
 * Broadcasts the result to all members of the affected room.
 */
function broadcastLabResult(nsp, roomId, payload) {
    nsp.to(`room:${roomId}`).emit('lab:result', payload);
}

/**
 * Called when a twist fires (from caseEngine).
 */
function broadcastTwist(nsp, roomCode, twist) {
    nsp.to(`room:${roomCode}`).emit('twist:fired', twist);
}

/**
 * Called when weather shifts.
 */
function broadcastWeatherChange(nsp, roomCode, weather) {
    nsp.to(`room:${roomCode}`).emit('weather:changed', weather);
}

/**
 * Trigger a jump scare for a specific player or whole room.
 */
function broadcastJumpScare(nsp, target, scareEvent) {
    nsp.to(target).emit('jump:scare', scareEvent);
}

module.exports = {
    registerWarRoomHandlers,
    broadcastLabResult,
    broadcastTwist,
    broadcastWeatherChange,
    broadcastJumpScare,
};