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
export declare function getLiveRoom(code: string): LiveRoom | undefined;
export declare function setLiveRoom(room: LiveRoom): void;
export declare function removeLiveRoom(code: string): void;
export declare function allLiveRooms(): LiveRoom[];
export declare function clearLiveRooms(): void;
export declare function participantToDto(participant: LiveParticipant): Participant;
export declare function sortParticipants(participants: LiveParticipant[]): LiveParticipant[];
