import type { ChatMessage, Participant, VideoType } from '@cineduo/shared';
import type { LiveParticipant, LiveRoom } from './roomStore';
/** Carga la sala desde memoria o desde la base de datos. */
export declare function loadRoom(code: string): Promise<LiveRoom | null>;
export declare function requireRoom(code: string): Promise<LiveRoom>;
export interface CreateRoomResult {
    room: LiveRoom;
    participant: LiveParticipant;
    token: string;
}
export declare function createRoom(input: {
    nickname: string;
    videoUrl?: string | undefined;
    videoType?: VideoType | undefined;
}): Promise<CreateRoomResult>;
export interface JoinRoomResult {
    room: LiveRoom;
    participant: LiveParticipant;
    reconnected: boolean;
}
export declare function joinRoom(input: {
    code: string;
    nickname?: string | undefined;
    token?: string | undefined;
}): Promise<JoinRoomResult>;
/** Reconstruye el participante a partir de un token ya verificado (uso en socket). */
export declare function participantFromToken(room: LiveRoom, token: string): Promise<LiveParticipant>;
export declare function listParticipants(room: LiveRoom): Participant[];
export declare function getParticipant(room: LiveRoom, participantId: string): LiveParticipant | null;
export declare function setParticipantConnection(room: LiveRoom, participantId: string, socketId: string | null): Promise<LiveParticipant>;
export declare function leaveRoom(room: LiveRoom, participantId: string): Promise<LiveParticipant | null>;
export interface TransferResult {
    room: LiveRoom;
    previousHostId: string;
    newHost: LiveParticipant;
}
/**
 * Cambia el host sin comprobar el actor (uso interno: timeout de host o
 * transferencia ya autorizada). Actualiza memoria, DB, roles y versión.
 */
export declare function promoteHost(room: LiveRoom, target: LiveParticipant, reason: 'transfer' | 'timeout' | 'disconnect'): Promise<LiveParticipant>;
export declare function transferHost(room: LiveRoom, targetParticipantId: string, actorId: string): Promise<TransferResult>;
/** Elige al invitado conectado con presencia más reciente. */
export declare function pickNextHost(room: LiveRoom, excludeId: string): LiveParticipant | null;
export declare function toChatMessage(row: {
    id: string;
    participantId: string;
    nickname: string;
    text: string;
    createdAt: Date;
}): ChatMessage;
export declare function appendMessage(room: LiveRoom, participant: LiveParticipant, text: string): Promise<ChatMessage>;
export declare function listMessages(room: LiveRoom, limit?: number): Promise<ChatMessage[]>;
export declare function schedulePersist(room: LiveRoom, delayMs?: number): void;
export declare function flushPlayback(room: LiveRoom): Promise<void>;
export declare function recordEvent(room: LiveRoom, type: string, participantId: string | null, payload?: unknown): void;
export declare function closeRoom(room: LiveRoom, reason: string): Promise<void>;
/** Marca salas antiguas como inactivas y limpia las que no tienen nadie. */
export declare function sweepRooms(now?: number): Promise<number>;
/** Al arrancar, ningún socket previo sigue vivo. */
export declare function resetStalePresence(): Promise<void>;
export declare function roomAgeHours(room: LiveRoom, now?: number): number;
