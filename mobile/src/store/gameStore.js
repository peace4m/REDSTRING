/**
 * Redstring — Game Store (Zustand)
 * ===================================
 * Tracks the active investigation session.
 * Updated by: API responses, Socket.io events, cron results.
 */

import { create } from 'zustand';

export const useGameStore = create((set, get) => ({
    // ── Active session ─────────────────────────────
    session:     null,
    caseFile:    null,   // sanitised case data (no spoilers)
    isLoading:   false,
    error:       null,

    // ── Weather ────────────────────────────────────
    weather: {
        condition:     'clear',
        temperature:   15,
        activeEffects: [],
    },

    // ── Active room (multiplayer) ──────────────────
    room:      null,
    roomMembers: [],

    // ── Pending notifications ──────────────────────
    pendingLabResults:  [],  // timers that completed while in the background
    pendingTwists:      [],  // twists not yet shown to player
    pendingJumpScares:  [],  // queued scare events

    // ── Actions ────────────────────────────────────
    setSession:  (session)  => set({ session }),
    setCaseFile: (caseFile) => set({ caseFile }),
    setRoom:     (room)     => set({ room, roomMembers: room?.members || [] }),
    setWeather:  (weather)  => set({ weather }),
    setLoading:  (v)        => set({ isLoading: v }),
    setError:    (e)        => set({ error: e }),

    // ── Clue state update ──────────────────────────
    updateClueState: (clueId, status) => set(s => {
        if (!s.session) return {};
        const clueStates = s.session.clueStates.map(c =>
            c.clueId === clueId ? { ...c, status } : c
        );
        // Add a new clue if not present
        if (!clueStates.find(c => c.clueId === clueId)) {
            clueStates.push({ clueId, status, foundAt: new Date() });
        }
        return { session: { ...s.session, clueStates } };
    }),

    // ── Unlock scene ───────────────────────────────
    unlockScene: (sceneId) => set(s => {
        if (!s.session) return {};
        const already = s.session.unlockedSceneIds.includes(sceneId);
        if (already) return {};
        return {
            session: {
                ...s.session,
                unlockedSceneIds: [...s.session.unlockedSceneIds, sceneId],
            },
        };
    }),

    // ── Lab timer completed ────────────────────────
    addLabResult: (result) => set(s => ({
        pendingLabResults: [...s.pendingLabResults, result],
    })),
    dismissLabResult: (timerId) => set(s => ({
        pendingLabResults: s.pendingLabResults.filter(r => r.timerId !== timerId),
    })),

    // ── Twist ──────────────────────────────────────
    addPendingTwist: (twist) => set(s => ({
        pendingTwists: [...s.pendingTwists, twist],
    })),
    dismissTwist: (twistId) => set(s => ({
        pendingTwists: s.pendingTwists.filter(t => t.twistId !== twistId),
    })),

    // ── Jump scare ─────────────────────────────────
    addJumpScare: (scare) => set(s => ({
        pendingJumpScares: [...s.pendingJumpScares, scare],
    })),
    dismissJumpScare: () => set(s => ({
        pendingJumpScares: s.pendingJumpScares.slice(1),
    })),

    // ── Room: real-time board update ───────────────
    updateBoard: (board) => set(s => ({
        room: s.room ? { ...s.room, evidenceBoard: board } : s.room,
    })),

    updateRoomMember: (userId, updates) => set(s => ({
        roomMembers: s.roomMembers.map(m =>
            m.userId === userId ? { ...m, ...updates } : m
        ),
    })),

    addRoomMember: (member) => set(s => ({
        roomMembers: [...s.roomMembers, member],
    })),

    removeRoomMember: (userId) => set(s => ({
        roomMembers: s.roomMembers.filter(m => m.userId !== userId),
    })),

    // ── Clear on logout / case end ─────────────────
    clearGame: () => set({
        session: null, caseFile: null, room: null, roomMembers: [],
        pendingLabResults: [], pendingTwists: [], pendingJumpScares: [],
        weather: { condition: 'clear', temperature: 15, activeEffects: [] },
    }),
}));