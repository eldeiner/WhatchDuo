'use client';

import { create } from 'zustand';
import type {
  ChatMessage,
  HostRequestEvent,
  Participant,
  PlaybackState,
  PlayerSyncEvent,
  Reaction,
  RoomStateEvent,
  SystemNotice,
} from '@cineduo/shared';
import { clock } from './clock';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
export type SyncStatus = 'synced' | 'correcting' | 'reconnecting' | 'paused' | 'buffering';

interface RoomStore {
  code: string | null;
  token: string | null;
  myId: string | null;
  playback: PlaybackState | null;
  participants: Participant[];
  messages: ChatMessage[];
  notices: SystemNotice[];
  reactions: Reaction[];
  peerBuffering: Record<string, string>;
  connection: ConnectionStatus;
  syncStatus: SyncStatus;
  error: string | null;
  hostRequest: HostRequestEvent | null;
  controlRequestSent: boolean;
  needsGesture: boolean;

  setIdentity: (input: { code: string; token: string; myId: string | null }) => void;
  applyRoomState: (state: RoomStateEvent) => void;
  applySync: (sync: PlayerSyncEvent) => boolean;
  setConnection: (status: ConnectionStatus) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setError: (message: string | null) => void;
  setNeedsGesture: (value: boolean) => void;
  upsertParticipant: (participant: Participant) => void;
  markParticipantLeft: (participantId: string) => void;
  setHost: (hostId: string) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addNotice: (notice: SystemNotice) => void;
  addReaction: (reaction: Reaction) => void;
  removeReaction: (id: string) => void;
  setHostRequest: (request: HostRequestEvent | null) => void;
  setControlRequestSent: (value: boolean) => void;
  setPeerBuffering: (participantId: string, nickname: string, isBuffering: boolean) => void;
  resetSession: () => void;
}

const MAX_MESSAGES = 300;
const MAX_NOTICES = 80;

export const useRoomStore = create<RoomStore>((set, get) => ({
  code: null,
  token: null,
  myId: null,
  playback: null,
  participants: [],
  messages: [],
  notices: [],
  reactions: [],
  peerBuffering: {},
  connection: 'idle',
  syncStatus: 'paused',
  error: null,
  hostRequest: null,
  controlRequestSent: false,
  needsGesture: false,

  setIdentity: ({ code, token, myId }) => set({ code, token, myId }),

  applyRoomState: (state) => {
    clock.setHint(state.serverTime);
    set((current) => ({
      playback: state.playback,
      participants: state.participants,
      code: state.room.code,
      syncStatus: state.playback.isPlaying ? current.syncStatus : 'paused',
    }));
  },

  applySync: (sync) => {
    const current = get().playback;
    // El servidor es autoritativo y la versión es monótona: descartamos ecos viejos.
    if (current && sync.version <= current.version) return false;

    const next: PlaybackState = {
      videoUrl: current?.videoUrl ?? null,
      videoType: current?.videoType ?? 'mp4',
      hostId: current?.hostId ?? '',
      position: sync.position,
      isPlaying: sync.isPlaying,
      playbackRate: sync.playbackRate,
      updatedAt: sync.updatedAt,
      version: sync.version,
    };

    set({
      playback: next,
      syncStatus: sync.isPlaying ? 'correcting' : 'paused',
    });
    return true;
  },

  setConnection: (connection) => {
    const syncStatus: SyncStatus | undefined =
      connection === 'reconnecting' || connection === 'connecting'
        ? 'reconnecting'
        : connection === 'connected'
          ? get().syncStatus === 'reconnecting'
            ? 'synced'
            : undefined
          : undefined;
    set({ connection, ...(syncStatus ? { syncStatus } : {}) });
  },

  setSyncStatus: (syncStatus) => {
    if (get().syncStatus === syncStatus) return;
    set({ syncStatus });
  },

  setError: (error) => set({ error }),
  setNeedsGesture: (needsGesture) => set({ needsGesture }),

  upsertParticipant: (participant) =>
    set((state) => {
      const exists = state.participants.some((p) => p.id === participant.id);
      const participants = exists
        ? state.participants.map((p) => (p.id === participant.id ? participant : p))
        : [...state.participants, participant];
      return { participants };
    }),

  markParticipantLeft: (participantId) =>
    set((state) => {
      const peerBuffering = { ...state.peerBuffering };
      delete peerBuffering[participantId];
      return {
        participants: state.participants.map((p) =>
          p.id === participantId ? { ...p, isConnected: false } : p,
        ),
        peerBuffering,
      };
    }),

  setHost: (hostId) =>
    set((state) => ({
      playback: state.playback ? { ...state.playback, hostId } : state.playback,
      participants: state.participants.map((p) => ({
        ...p,
        role: p.id === hostId ? 'host' : 'guest',
      })),
    })),

  addMessage: (message) =>
    set((state) => {
      if (state.messages.some((m) => m.id === message.id)) return state;
      return { messages: [...state.messages, message].slice(-MAX_MESSAGES) };
    }),

  // El historial puede llegar después de un mensaje en vivo: fusionamos por id.
  setMessages: (messages) =>
    set((state) => {
      const byId = new Map<string, ChatMessage>();
      for (const message of [...messages, ...state.messages]) byId.set(message.id, message);
      return {
        messages: [...byId.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-MAX_MESSAGES),
      };
    }),

  addNotice: (notice) =>
    set((state) => ({
      notices: [...state.notices, notice].slice(-MAX_NOTICES),
    })),

  addReaction: (reaction) => {
    set((state) => ({ reactions: [...state.reactions, reaction].slice(-30) }));
    window.setTimeout(() => get().removeReaction(reaction.id), 3600);
  },

  removeReaction: (id) =>
    set((state) => ({ reactions: state.reactions.filter((r) => r.id !== id) })),

  setHostRequest: (hostRequest) => set({ hostRequest }),
  setControlRequestSent: (controlRequestSent) => set({ controlRequestSent }),

  setPeerBuffering: (participantId, nickname, isBuffering) =>
    set((state) => {
      const peerBuffering = { ...state.peerBuffering };
      if (isBuffering) peerBuffering[participantId] = nickname;
      else delete peerBuffering[participantId];
      return { peerBuffering };
    }),

  resetSession: () =>
    set({
      playback: null,
      participants: [],
      messages: [],
      notices: [],
      reactions: [],
      peerBuffering: {},
      connection: 'idle',
      syncStatus: 'paused',
      error: null,
      hostRequest: null,
      controlRequestSent: false,
      needsGesture: false,
    }),
}));

/** Selector booleano: ¿soy el host actualmente? */
export function selectIsHost(state: RoomStore): boolean {
  return Boolean(state.myId && state.playback?.hostId === state.myId);
}
