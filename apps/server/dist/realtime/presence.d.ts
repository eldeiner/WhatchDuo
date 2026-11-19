import type { LiveParticipant, LiveRoom } from '../services/roomStore';
import type { CineServer, CineSocket } from './socketTypes';
export declare function attachParticipant(io: CineServer, socket: CineSocket, room: LiveRoom, participant: LiveParticipant, reconnected: boolean): Promise<void>;
export declare function detachParticipant(io: CineServer, socket: CineSocket, mode: 'disconnect' | 'leave'): Promise<void>;
/** Al cerrar el proceso: avisa y persiste. */
export declare function clearHostGrace(room: LiveRoom): void;
