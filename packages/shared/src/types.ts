import type { ErrorCode, PlaybackRate, ReactionEmoji, VideoType } from './constants';

/* ------------------------------------------------------------------ */
/* Modelos de dominio                                                  */
/* ------------------------------------------------------------------ */

export type ParticipantRole = 'host' | 'guest';

export interface RoomSummary {
  code: string;
  createdAt: number;
  isActive: boolean;
}

/**
 * Estado de reproducción autoritativo. Todos los timestamps son epoch ms
 * calculados en el servidor.
 */
export interface PlaybackState {
  videoUrl: string | null;
  videoType: VideoType;
  /** Segundos. */
  position: number;
  isPlaying: boolean;
  playbackRate: PlaybackRate;
  /** Momento (servidor) en el que `position` era válida. */
  updatedAt: number;
  /** Monótona creciente. El cliente descarta versiones <= a la local. */
  version: number;
  hostId: string;
}

export interface Participant {
  id: string;
  nickname: string;
  role: ParticipantRole;
  isConnected: boolean;
  /** epoch ms */
  lastSeen: number;
}

export interface ChatMessage {
  id: string;
  participantId: string;
  nickname: string;
  text: string;
  /** epoch ms */
  createdAt: number;
}

export interface Reaction {
  id: string;
  participantId: string;
  nickname: string;
  emoji: ReactionEmoji;
  createdAt: number;
}

/** Evento de sistema mostrado en el chat (entradas, salidas, cambios de host). */
export interface SystemNotice {
  id: string;
  text: string;
  createdAt: number;
}

/* ------------------------------------------------------------------ */
/* API REST                                                            */
/* ------------------------------------------------------------------ */

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface CreateRoomResponse {
  roomCode: string;
  joinUrl: string;
  participantToken: string;
  participant: Participant;
  playback: PlaybackState;
}

export interface JoinRoomResponse {
  roomCode: string;
  participantToken: string;
  participant: Participant;
  playback: PlaybackState;
  participants: Participant[];
}

export interface PublicRoomResponse {
  room: RoomSummary;
  playback: PlaybackState;
  participants: Participant[];
  serverTime: number;
}

export interface MessagesResponse {
  messages: ChatMessage[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  database: 'up' | 'down';
  version: string;
  serverTime: number;
}

/* ------------------------------------------------------------------ */
/* WebSocket                                                           */
/* ------------------------------------------------------------------ */

/** Respuesta de acknowledgements de Socket.IO. */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody['error'] };

export interface RoomStateEvent {
  room: RoomSummary;
  playback: PlaybackState;
  participants: Participant[];
  serverTime: number;
}

export interface PlayerSyncEvent {
  position: number;
  isPlaying: boolean;
  playbackRate: PlaybackRate;
  updatedAt: number;
  version: number;
  serverTime: number;
  /** participantId que originó el cambio. */
  by: string;
  /** `command` = acción explícita; `heartbeat` = re-anclaje; `host` = transferencia. */
  reason: 'command' | 'heartbeat' | 'host' | 'video';
}

export interface PlayerCommandEvent {
  type: 'play' | 'pause' | 'seek' | 'rate';
  position?: number;
  rate?: PlaybackRate;
  by: string;
  version: number;
  serverTime: number;
}

export interface PeerBufferingEvent {
  participantId: string;
  nickname: string;
  isBuffering: boolean;
}

export interface HostRequestEvent {
  participantId: string;
  nickname: string;
}

export interface ClockPong {
  /** Eco del `clientTime` enviado. */
  clientTime: number;
  /** Reloj del servidor al responder (epoch ms). */
  serverTime: number;
  /** Versión del protocolo. */
  protocol: number;
}

export interface WsError {
  code: ErrorCode;
  message: string;
  /** Identificador opcional de la petición que falló. */
  request?: string;
}

/* ------------------------------------------------------------------ */
/* Payloads cliente → servidor (validados con Zod en el server)        */
/* ------------------------------------------------------------------ */

export interface CreateRoomPayload {
  nickname: string;
  videoUrl?: string;
}

export interface JoinRoomPayload {
  code: string;
  nickname?: string;
  token?: string;
}

export interface PlayCommandPayload {
  position: number;
  clientSeq: number;
}

export interface SeekCommandPayload {
  position: number;
  clientSeq: number;
}

export interface RateCommandPayload {
  rate: PlaybackRate;
  clientSeq: number;
  /** Posición del host en el momento del cambio, para re-anclar. */
  position?: number;
}

export interface HeartbeatPayload {
  position: number;
  isPlaying: boolean;
  /** Reloj local del host (informativo, para diagnóstico). */
  clientTime: number;
  clientSeq: number;
}

export interface SetVideoPayload {
  videoUrl: string;
  videoType?: VideoType;
  clientSeq: number;
}

export interface ChatSendPayload {
  text: string;
}

export interface ReactionSendPayload {
  emoji: ReactionEmoji;
}

export interface TransferHostPayload {
  targetParticipantId: string;
}

export interface PingPayload {
  clientTime: number;
}

export interface BufferingPayload {
  isBuffering: boolean;
}

/** Extensión opcional para compartir pantalla por WebRTC (fuera del MVP). */
export interface WebRtcSignalPayload {
  targetId: string;
  data: unknown;
}

/* ------------------------------------------------------------------ */
/* Mapas de eventos tipados para Socket.IO                             */
/* ------------------------------------------------------------------ */

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: (res: Ack<CreateRoomResponse>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (res: Ack<RoomStateEvent>) => void) => void;
  'room:leave': (ack?: (res: Ack<{ left: true }>) => void) => void;

  'player:play': (payload: PlayCommandPayload, ack?: (res: Ack<PlaybackState>) => void) => void;
  'player:pause': (payload: PlayCommandPayload, ack?: (res: Ack<PlaybackState>) => void) => void;
  'player:seek': (payload: SeekCommandPayload, ack?: (res: Ack<PlaybackState>) => void) => void;
  'player:rate': (payload: RateCommandPayload, ack?: (res: Ack<PlaybackState>) => void) => void;
  'player:heartbeat': (payload: HeartbeatPayload) => void;
  'player:buffering': (payload: BufferingPayload) => void;
  'player:set-video': (payload: SetVideoPayload, ack?: (res: Ack<PlaybackState>) => void) => void;

  'chat:send': (payload: ChatSendPayload, ack?: (res: Ack<ChatMessage>) => void) => void;
  'chat:reaction': (payload: ReactionSendPayload) => void;

  'host:transfer': (payload: TransferHostPayload, ack?: (res: Ack<PlaybackState>) => void) => void;
  'host:request': (ack?: (res: Ack<{ requested: true }>) => void) => void;

  ping: (payload: PingPayload) => void;
  'webrtc:signal': (payload: WebRtcSignalPayload) => void;
}

export interface ServerToClientEvents {
  'room:state': (payload: RoomStateEvent) => void;
  'room:closed': (payload: { code: string; reason: string }) => void;

  'participant:joined': (payload: { participant: Participant; serverTime: number }) => void;
  'participant:left': (payload: {
    participantId: string;
    nickname: string;
    serverTime: number;
  }) => void;
  'participant:reconnected': (payload: { participant: Participant; serverTime: number }) => void;

  'player:sync': (payload: PlayerSyncEvent) => void;
  'player:command': (payload: PlayerCommandEvent) => void;

  'chat:message': (payload: { message: ChatMessage }) => void;
  'chat:reaction': (payload: { reaction: Reaction }) => void;
  'chat:system': (payload: { notice: SystemNotice }) => void;

  'host:changed': (payload: { hostId: string; by: 'transfer' | 'timeout' | 'disconnect' }) => void;
  'host:request': (payload: HostRequestEvent) => void;

  'peer:buffering': (payload: PeerBufferingEvent) => void;
  'peer:request-control': (payload: HostRequestEvent) => void;

  error: (payload: WsError) => void;
  pong: (payload: ClockPong) => void;

  'webrtc:signal': (payload: { fromId: string; data: unknown }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  participantId?: string;
  roomCode?: string;
  nickname?: string;
}
