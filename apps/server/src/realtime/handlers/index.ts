import type { CineServer, CineSocket } from '../socketTypes';
import { registerChatHandlers } from './chat';
import { registerClockHandlers, registerWebRtcHandlers } from './clock';
import { registerHostHandlers } from './host';
import { registerPlayerHandlers } from './player';
import { registerRoomHandlers } from './room';

export function registerHandlers(io: CineServer, socket: CineSocket): void {
  registerRoomHandlers(io, socket);
  registerPlayerHandlers(io, socket);
  registerChatHandlers(io, socket);
  registerHostHandlers(io, socket);
  registerClockHandlers(io, socket);
  registerWebRtcHandlers(io, socket);
}
