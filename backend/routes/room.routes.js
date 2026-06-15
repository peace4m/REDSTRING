/**
 * CrimeSolve — Room Routes
 * ==========================
 * POST   /api/rooms                    → Create a new War Room
 * GET    /api/rooms/:roomCode          → Get room state
 * POST   /api/rooms/:roomCode/join     → Join a room
 * POST   /api/rooms/:roomCode/leave    → Leave a room
 * POST   /api/rooms/:roomCode/start    → Host starts the investigation
 * POST   /api/rooms/:roomCode/vote     → Vote on a consensus accusation
 * GET    /api/rooms/:roomCode/board    → Get shared evidence board
 * PATCH  /api/rooms/:roomCode/board    → Update shared evidence board
 * POST   /api/rooms/:roomCode/chat     → Post a chat message
 * GET    /api/rooms/:roomCode/chat     → Get chat history
 */

const router = require('express').Router();
const { nanoid } = require('nanoid');
const Room          = require('../schema/room.schema');
const CaseFile      = require('../schema/caseFile.schema');
const PlayerSession = require('../schema/playerSession.schema');
const { requireAuth } = require('../middleware/auth.middleware');
const { setCache, getFromCache, deleteCache } = require('../services/redisService');

// Pin colours assigned per player slot
const PIN_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];

// ─────────────────────────────────────────────
//  CREATE ROOM
// ─────────────────────────────────────────────
/**
 * Creates a new War Room and returns the invite code.
 * The creating player becomes host.
 */
router.post('/', requireAuth, async (req, res, next) => {
    try {
        const { caseId, isPrivate = true, maxMembers = 4 } = req.body;
        if (!caseId) return res.status(400).json({ error: 'caseId is required' });

        const caseFile = await CaseFile.findOne({ caseId, isPublished: true });
        if (!caseFile) return res.status(404).json({ error: 'Case not found' });

        if (caseFile.contentRating === 'R' && req.user.contentRating !== 'R') {
            return res.status(403).json({ error: 'Adult content rating required.' });
        }

        // Generate a memorable room code: "WOLF-7492"
        const words = ['WOLF','RAVEN','STORM','MIST','IRON','COAL','VEIL','CROW','DUSK','NOIR'];
        const roomCode = `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;
        const inviteCode = nanoid(12);

        const room = await Room.create({
            roomCode,
            caseId,
            hostUserId: req.user._id.toString(),
            status:     'waiting',
            maxMembers: Math.min(maxMembers, caseFile.maxPlayers),
            isPrivate,
            inviteCode,
            members: [{
                userId:       req.user._id.toString(),
                displayName:  req.user.displayName,
                avatarKey:    req.user.avatarKey,
                isHost:       true,
                isOnline:     true,
                pinColor:     PIN_COLORS[0],
                lastSeenAt:   new Date(),
            }],
        });

        // Cache room state in Redis for fast Socket.io reads
        await setCache(`room:${roomCode}`, sanitiseRoom(room), 60 * 60 * 24); // 24hr TTL

        res.status(201).json({
            roomCode,
            inviteCode,
            inviteLink: `${process.env.FRONTEND_URL}/join/${inviteCode}`,
            room: sanitiseRoom(room),
        });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  GET ROOM STATE
// ─────────────────────────────────────────────
router.get('/:roomCode', requireAuth, async (req, res, next) => {
    try {
        // Try cache first
        const cached = await getFromCache(`room:${req.params.roomCode}`);
        if (cached) return res.json({ room: cached });

        const room = await Room.findOne({ roomCode: req.params.roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });

        res.json({ room: sanitiseRoom(room) });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  JOIN ROOM
// ─────────────────────────────────────────────
router.post('/:roomCode/join', requireAuth, async (req, res, next) => {
    try {
        const { inviteCode } = req.body;
        const room = await Room.findOne({ roomCode: req.params.roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });

        // Validate invite code for private rooms
        if (room.isPrivate && room.inviteCode !== inviteCode) {
            return res.status(403).json({ error: 'Invalid invite code' });
        }

        if (room.status === 'solved' || room.status === 'abandoned') {
            return res.status(400).json({ error: 'This investigation is already closed.' });
        }

        // Already check a member
        const alreadyMember = room.members.find(m => m.userId === req.user._id.toString());
        if (alreadyMember) {
            // Re-joining (reconnect)
            alreadyMember.isOnline  = true;
            alreadyMember.lastSeenAt = new Date();
            await room.save();
            return res.json({ message: 'Rejoined', room: sanitiseRoom(room) });
        }

        if (room.members.length >= room.maxMembers) {
            return res.status(400).json({ error: 'Room is full.' });
        }

        // Assign next available pin color and role
        const usedColors = room.members.map(m => m.pinColor);
        const pinColor = PIN_COLORS.find(c => !usedColors.includes(c)) || 'white';

        const caseFile = await CaseFile.findOne({ caseId: room.caseId });
        const usedRoles = room.roleAssignments.map(r => r.roleId);
        const availableRole = caseFile.roles.find(r => !usedRoles.includes(r.roleId));

        room.members.push({
            userId:      req.user._id.toString(),
            displayName: req.user.displayName,
            avatarKey:   req.user.avatarKey,
            isHost:      false,
            isOnline:    true,
            pinColor,
            lastSeenAt:  new Date(),
        });

        if (availableRole) {
            room.roleAssignments.push({
                roleId: availableRole.roleId,
                userId: req.user._id.toString(),
            });
        }

        await room.save();

        // Invalidate cache
        await setCache(`room:${room.roomCode}`, sanitiseRoom(room), 60 * 60 * 24);

        // Notify existing room members via Socket.io
        req.io.of('/war-room')
            .to(`room:${room.roomCode}`)
            .emit('member:joined', {
                userId:      req.user._id.toString(),
                displayName: req.user.displayName,
                avatarKey:   req.user.avatarKey,
                pinColor,
                role:        availableRole?.roleId || null,
            });

        res.json({ room: sanitiseRoom(room), assignedRole: availableRole || null });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  LEAVE ROOM
// ─────────────────────────────────────────────
router.post('/:roomCode/leave', requireAuth, async (req, res, next) => {
    try {
        const room = await Room.findOne({ roomCode: req.params.roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });

        const userId = req.user._id.toString();
        room.members = room.members.filter(m => m.userId !== userId);
        room.roleAssignments = room.roleAssignments.filter(r => r.userId !== userId);

        // If host left, assign host to the first remaining member
        if (room.hostUserId === userId && room.members.length > 0) {
            room.hostUserId = room.members[0].userId;
            room.members[0].isHost = true;
        }

        // If the room is empty, abandon it
        if (room.members.length === 0) room.status = 'abandoned';

        await room.save();
        await setCache(`room:${room.roomCode}`, sanitiseRoom(room), 60 * 60 * 24);

        req.io.of('/war-room')
            .to(`room:${room.roomCode}`)
            .emit('member:left', {
                userId,
                displayName: req.user.displayName,
                newHostId:   room.hostUserId,
            });

        res.json({ message: 'Left room' });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  START INVESTIGATION (host only)
// ─────────────────────────────────────────────
router.post('/:roomCode/start', requireAuth, async (req, res, next) => {
    try {
        const room = await Room.findOne({ roomCode: req.params.roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        if (room.hostUserId !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the host can start the investigation.' });
        }
        if (room.status !== 'waiting') {
            return res.status(400).json({ error: `Room is already ${room.status}.` });
        }
        if (room.members.length < 1) {
            return res.status(400).json({ error: 'Need at least 1 player to start.' });
        }

        // Unlock root scenes for the room
        const caseFile = await CaseFile.findOne({ caseId: room.caseId });
        room.unlockedSceneIds = caseFile.scenes.filter(s => !s.unlocksAt).map(s => s.sceneId);
        room.discoveredClueIds = caseFile.clues.filter(c => !c.parentClueId).map(c => c.clueId);
        room.status    = 'active';
        room.startedAt = new Date();

        await room.save();
        await setCache(`room:${room.roomCode}`, sanitiseRoom(room), 60 * 60 * 24);

        // Create a PlayerSession for each member
        for (const member of room.members) {
            const existing = await PlayerSession.findOne({
                userId: member.userId, caseId: room.caseId, status: 'active',
            });
            if (!existing) {
                await PlayerSession.create({
                    userId:           member.userId,
                    caseId:           room.caseId,
                    roomId:           room._id,
                    startedAt:        new Date(),
                    unlockedSceneIds: room.unlockedSceneIds,
                    clueStates:       room.discoveredClueIds.map(id => ({ clueId: id, status: 'found', foundAt: new Date() })),
                });
            }
        }

        // Broadcast game start
        req.io.of('/war-room')
            .to(`room:${room.roomCode}`)
            .emit('investigation:started', {
                startedAt:       room.startedAt,
                unlockedScenes:  room.unlockedSceneIds,
                initialClues:    room.discoveredClueIds,
            });

        res.json({ message: 'Investigation started!', room: sanitiseRoom(room) });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  CONSENSUS ACCUSATION VOTING
// ─────────────────────────────────────────────
/**
 * Any member can propose a suspect.
 * All members must vote yes/no within 5 minutes.
 * The Majority vote carries the accusation.
 */
router.post('/:roomCode/vote', requireAuth, async (req, res, next) => {
    try {
        const { action, suspectId, vote } = req.body;
        // action: 'propose' | 'cast'

        const room = await Room.findOne({ roomCode: req.params.roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        if (room.status !== 'active') return res.status(400).json({ error: 'Room not active.' });

        const userId = req.user._id.toString();

        if (action === 'propose') {
            if (!suspectId) return res.status(400).json({ error: 'suspectId required' });

            room.accusationVote = {
                isOpen:     true,
                suspectId,
                proposedBy: userId,
                votes:      [{ userId, vote: 'yes' }],
                expiresAt:  new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
            };
            await room.save();

            req.io.of('/war-room').to(`room:${room.roomCode}`).emit('vote:opened', {
                suspectId,
                proposedBy:  req.user.displayName,
                expiresAt:   room.accusationVote.expiresAt,
            });

            return res.json({ message: 'Vote opened', vote: room.accusationVote });
        }

        if (action === 'cast') {
            if (!room.accusationVote?.isOpen) return res.status(400).json({ error: 'No open vote.' });
            if (new Date() > room.accusationVote.expiresAt) {
                room.accusationVote.isOpen = false;
                await room.save();
                return res.status(400).json({ error: 'Vote expired.' });
            }
            if (!['yes', 'no', 'abstain'].includes(vote)) {
                return res.status(400).json({ error: 'vote must be yes, no, or abstain' });
            }

            const existing = room.accusationVote.votes.find(v => v.userId === userId);
            if (existing) { existing.vote = vote; }
            else          { room.accusationVote.votes.push({ userId, vote }); }

            // Check if all members voted
            const totalMembers = room.members.length;
            const totalVotes   = room.accusationVote.votes.length;
            const yesVotes     = room.accusationVote.votes.filter(v => v.vote === 'yes').length;

            if (totalVotes >= totalMembers) {
                // Majority carries
                const passed = yesVotes > totalMembers / 2;
                room.accusationVote.isOpen = false;

                if (passed) {
                    // Execute the accusation via caseEngine for each member session
                    const { makeAccusation } = require('../game-engine/caseEngine');
                    const sessions = await PlayerSession.find({ roomId: room._id, status: 'active' });
                    let result;
                    for (const s of sessions) {
                        result = await makeAccusation(s._id, room.accusationVote.suspectId);
                    }
                    room.status = result?.isCorrect ? 'solved' : room.status;
                    room.finalAccusation = {
                        suspectId:  room.accusationVote.suspectId,
                        accusedBy:  userId,
                        wasCorrect: result?.isCorrect || false,
                    };

                    req.io.of('/war-room').to(`room:${room.roomCode}`).emit('accusation:resolved', {
                        passed:    true,
                        isCorrect: result?.isCorrect,
                        result,
                    });
                } else {
                    req.io.of('/war-room').to(`room:${room.roomCode}`).emit('vote:failed', {
                        suspectId: room.accusationVote.suspectId,
                        yesVotes,
                        noVotes: totalVotes - yesVotes,
                    });
                }
            } else {
                req.io.of('/war-room').to(`room:${room.roomCode}`).emit('vote:updated', {
                    votes: room.accusationVote.votes,
                });
            }

            await room.save();
            await setCache(`room:${room.roomCode}`, sanitiseRoom(room), 60 * 60 * 24);

            return res.json({ voteState: room.accusationVote });
        }

        res.status(400).json({ error: 'action must be propose or cast' });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  SHARED EVIDENCE BOARD
// ─────────────────────────────────────────────
router.get('/:roomCode/board', requireAuth, async (req, res, next) => {
    try {
        const room = await Room.findOne({ roomCode: req.params.roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.json({ board: room.evidenceBoard });
    } catch (err) { next(err); }
});

router.patch('/:roomCode/board', requireAuth, async (req, res, next) => {
    try {
        const { pins, strings } = req.body;
        const room = await Room.findOne({ roomCode: req.params.roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });

        const member = room.members.find(m => m.userId === req.user._id.toString());
        if (!member) return res.status(403).json({ error: 'Not a member of this room.' });

        if (pins)    room.evidenceBoard.pins    = pins;
        if (strings) room.evidenceBoard.strings = strings;
        room.evidenceBoard.version += 1;
        await room.save();

        // Broadcast board update
        req.io.of('/war-room').to(`room:${room.roomCode}`).emit('board:updated', {
            board:     room.evidenceBoard,
            updatedBy: req.user.displayName,
        });

        res.json({ board: room.evidenceBoard });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  CHAT
// ─────────────────────────────────────────────
router.post('/:roomCode/chat', requireAuth, async (req, res, next) => {
    try {
        const { text, type = 'text', clueId } = req.body;
        if (!text && type === 'text') return res.status(400).json({ error: 'text is required' });

        const room = await Room.findOne({ roomCode: req.params.roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });

        const member = room.members.find(m => m.userId === req.user._id.toString());
        if (!member) return res.status(403).json({ error: 'Not a member of this room.' });

        const message = {
            messageId: nanoid(8),
            userId:    req.user._id.toString(),
            type,
            text,
            clueId:    clueId || null,
            sentAt:    new Date(),
        };

        // Keep only last 200 messages in DB
        room.chatLog.push(message);
        if (room.chatLog.length > 200) room.chatLog = room.chatLog.slice(-200);
        await room.save();

        // Broadcast immediately via Socket.io (REST is the persistence path)
        req.io.of('/war-room').to(`room:${room.roomCode}`).emit('chat:message', {
            ...message,
            displayName: req.user.displayName,
            avatarKey:   req.user.avatarKey,
            pinColor:    member.pinColor,
        });

        res.status(201).json({ message });
    } catch (err) { next(err); }
});

router.get('/:roomCode/chat', requireAuth, async (req, res, next) => {
    try {
        const { limit = 50, before } = req.query;
        const room = await Room.findOne({ roomCode: req.params.roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });

        let messages = room.chatLog;
        if (before) messages = messages.filter(m => m.sentAt < new Date(before));
        messages = messages.slice(-parseInt(limit));

        res.json({ messages });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  HELPER
// ─────────────────────────────────────────────
function sanitiseRoom(room) {
    return {
        roomCode:          room.roomCode,
        caseId:            room.caseId,
        hostUserId:        room.hostUserId,
        status:            room.status,
        startedAt:         room.startedAt,
        maxMembers:        room.maxMembers,
        isPrivate:         room.isPrivate,
        members:           room.members,
        roleAssignments:   room.roleAssignments,
        discoveredClueIds: room.discoveredClueIds,
        unlockedSceneIds:  room.unlockedSceneIds,
        triggeredTwistIds: room.triggeredTwistIds,
        activeTimers:      room.activeTimers,
        evidenceBoard:     room.evidenceBoard,
        accusationVote:    room.accusationVote,
        currentWeather:    room.currentWeather,
        finalAccusation:   room.finalAccusation,
    };
}

module.exports = router;