/**
 * Redstring — Socket Service
 * ============================
 * Manages two Socket.io connections:
 *  - /war-room    (multiplayer — only connected when in a room)
 *  - /case-events (solo push   — always connected when a session is active)
 *
 * Hooks into Zustand stores directly to update game state in real time.
 */

import { io } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';

const BASE_WS = process.env.EXPO_PUBLIC_WS_URL || 'http://localhost:4000';

let warRoomSocket  = null;
let caseEventsSocket = null;

// ─────────────────────────────────────────────
//  CASE EVENTS SOCKET (solo — always on)
// ─────────────────────────────────────────────

export function connectCaseEvents(token) {
    if (caseEventsSocket?.connected) return;

    caseEventsSocket = io(`${BASE_WS}/case-events`, {
        auth:       { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
    });

    caseEventsSocket.on('connect', () => {
        console.log('[Socket] /case-events connected');
    });

    // ── Lab result arrived ────────────────────
    caseEventsSocket.on('lab:result', (payload) => {
        useGameStore.getState().addLabResult(payload);
        // Also update clue state if a result clue is now available
        if (payload.resultClueId) {
            useGameStore.getState().updateClueState(payload.resultClueId, 'found');
        }
    });

    // ── Twist fired ───────────────────────────
    caseEventsSocket.on('twist:fired', (twist) => {
        useGameStore.getState().addPendingTwist(twist);
        if (twist.effects?.newSceneUnlocked) {
            useGameStore.getState().unlockScene(twist.effects.newSceneUnlocked);
        }
    });

    // ── Weather changed ───────────────────────
    caseEventsSocket.on('weather:changed', (weather) => {
        useGameStore.getState().setWeather(weather);
    });

    // ── Jump scare ────────────────────────────
    caseEventsSocket.on('jump:scare', (scare) => {
        useGameStore.getState().addJumpScare(scare);
    });

    caseEventsSocket.on('disconnect', (reason) => {
        console.log('[Socket] /case-events disconnected:', reason);
    });
}

export function disconnectCaseEvents() {
    caseEventsSocket?.disconnect();
    caseEventsSocket = null;
}

export function notifySceneEnter(sceneId) {
    caseEventsSocket?.emit('scene:enter', { sceneId });
}

// ─────────────────────────────────────────────
//  WAR ROOM SOCKET (multiplayer)
// ─────────────────────────────────────────────

export function connectWarRoom(token, roomCode, onRoomState) {
    if (warRoomSocket?.connected) {
        warRoomSocket.emit('room:join', { roomCode }, onRoomState);
        return;
    }

    warRoomSocket = io(`${BASE_WS}/war-room`, {
        auth:       { token },
        transports: ['websocket'],
        reconnection: true,
    });

    const store = useGameStore.getState;

    warRoomSocket.on('connect', () => {
        console.log('[Socket] /war-room connected');
        warRoomSocket.emit('room:join', { roomCode }, onRoomState);
    });

    // ── Room membership ───────────────────────
    warRoomSocket.on('member:joined',  (m)  => store().addRoomMember(m));
    warRoomSocket.on('member:left',    ({userId}) => store().removeRoomMember(userId));
    warRoomSocket.on('member:online',  ({userId}) => store().updateRoomMember(userId, { isOnline: true }));
    warRoomSocket.on('member:offline', ({userId}) => store().updateRoomMember(userId, { isOnline: false }));

    // ── Corkboard ─────────────────────────────
    warRoomSocket.on('board:pin-added',    ({pin}) => {
        const room = store().room;
        if (!room) return;
        store().updateBoard({
            ...room.evidenceBoard,
            pins: [...room.evidenceBoard.pins, pin],
        });
    });

    warRoomSocket.on('board:pin-removed',  ({pinId}) => {
        const room = store().room;
        if (!room) return;
        store().updateBoard({
            ...room.evidenceBoard,
            pins: room.evidenceBoard.pins.filter(p => p.pinId !== pinId),
        });
    });

    warRoomSocket.on('board:string-added', ({string}) => {
        const room = store().room;
        if (!room) return;
        store().updateBoard({
            ...room.evidenceBoard,
            strings: [...room.evidenceBoard.strings, string],
        });
    });

    warRoomSocket.on('board:string-removed', ({stringId}) => {
        const room = store().room;
        if (!room) return;
        store().updateBoard({
            ...room.evidenceBoard,
            strings: room.evidenceBoard.strings.filter(s => s.stringId !== stringId),
        });
    });

    warRoomSocket.on('board:note-updated', ({pinId, note}) => {
        const room = store().room;
        if (!room) return;
        store().updateBoard({
            ...room.evidenceBoard,
            pins: room.evidenceBoard.pins.map(p => p.pinId === pinId ? { ...p, note } : p),
        });
    });

    warRoomSocket.on('board:updated', ({board}) => store().updateBoard(board));

    // ── Game events ───────────────────────────
    warRoomSocket.on('clue:discovered', ({clueId, unlockedChildren}) => {
        store().updateClueState(clueId, 'found');
        unlockedChildren?.forEach(id => store().updateClueState(id, 'found'));
    });

    warRoomSocket.on('twist:fired',   (twist)   => store().addPendingTwist(twist));
    warRoomSocket.on('lab:result',    (result)  => store().addLabResult(result));
    warRoomSocket.on('jump:scare',    (scare)   => store().addJumpScare(scare));
    warRoomSocket.on('weather:changed',(weather)=> store().setWeather(weather));

    warRoomSocket.on('investigation:started', ({unlockedScenes, initialClues}) => {
        unlockedScenes?.forEach(id => store().unlockScene(id));
    });

    warRoomSocket.on('disconnect', (reason) => {
        console.log('[Socket] /war-room disconnected:', reason);
    });
}

export function disconnectWarRoom() {
    warRoomSocket?.disconnect();
    warRoomSocket = null;
}

// ── War Room emitters ─────────────────────────
export const warRoom = {
    pinAdd:       (roomCode, pin)                   => warRoomSocket?.emit('board:pin',          { roomCode, pin }),
    pinRemove:    (roomCode, pinId)                  => warRoomSocket?.emit('board:unpin',        { roomCode, pinId }),
    stringAdd:    (roomCode, string)                 => warRoomSocket?.emit('board:string',       { roomCode, string }),
    stringRemove: (roomCode, stringId)               => warRoomSocket?.emit('board:unstring',     { roomCode, stringId }),
    updateNote:   (roomCode, pinId, note)            => warRoomSocket?.emit('board:update-note',  { roomCode, pinId, note }),
    playerMove:   (roomCode, sceneId, x, y)          => warRoomSocket?.emit('player:move',        { roomCode, sceneId, x, y }),
    sceneEnter:   (roomCode, sceneId)                => warRoomSocket?.emit('player:scene-enter', { roomCode, sceneId }),
    shareClue:    (roomCode, clueId, comment)        => warRoomSocket?.emit('clue:share',         { roomCode, clueId, comment }),
    postTheory:   (roomCode, suspectId, theoryText)  => warRoomSocket?.emit('theory:post',        { roomCode, suspectId, theoryText }),
    voiceSignal:  (roomCode, targetUserId, signal)   => warRoomSocket?.emit('voice:signal',       { roomCode, targetUserId, signal }),
    typing:       (roomCode, isTyping)               => warRoomSocket?.emit('chat:typing',        { roomCode, isTyping }),
};