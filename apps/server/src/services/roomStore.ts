import type { Participant, PlaybackState } from '@cineduo/shared';

export interface LiveParticipant extends Participant {
  socketId: string | null;
  joinedAt: number;
}

export interface LiveRoom {
  id: string;
  code: string;
  createdAt: number;
  isActive: boolean;
  playback: PlaybackState;
  participants: Map<string, LiveParticipant>;
  hostGraceTimer: ReturnType<typeof setTimeout> | null;
  persistTimer: ReturnType<typeof setTimeout> | null;
  lastActivityAt: number;
}

/**
 * Estado autoritativo "caliente" en memoria. La base de datos es el espejo
 * duradero: permite recuperar la sala tras un reinicio y guarda historial.
 */
const liveRooms = new Map<string, LiveRoom>();

export function getLiveRoom(code: string): LiveRoom | undefined {
  return liveRooms.get(code.toUpperCase());
}

export function setLiveRoom(room: LiveRoom): void {
  liveRooms.set(room.code, room);
}

export function removeLiveRoom(code: string): void {
  const room = liveRooms.get(code);
  if (room?.hostGraceTimer) clearTimeout(room.hostGraceTimer);
  if (room?.persistTimer) clearTimeout(room.persistTimer);
  liveRooms.delete(code);
}

export function allLiveRooms(): LiveRoom[] {
  return [...liveRooms.values()];
}

export function clearLiveRooms(): void {
  for (const code of [...liveRooms.keys()]) removeLiveRoom(code);
}

export function participantToDto(participant: LiveParticipant): Participant {
  return {
    id: participant.id,
    nickname: participant.nickname,
    role: participant.role,
    isConnected: participant.isConnected,
    lastSeen: participant.lastSeen,
  };
}

export function sortParticipants(participants: LiveParticipant[]): LiveParticipant[] {
  return [...participants].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'host' ? -1 : 1;
    if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1;
    return a.joinedAt - b.joinedAt;
  });
}
