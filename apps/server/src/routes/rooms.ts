import { Router } from 'express';
import type {
  CreateRoomResponse,
  JoinRoomResponse,
  MessagesResponse,
  PublicRoomResponse,
} from '@cineduo/shared';
import { createRoomSchema, joinRoomSchema, roomCodeSchema, detectVideoType } from '@cineduo/shared';
import { getEnv } from '../config/env';
import { AppError } from '../lib/errors';
import { asyncHandler, clientIp, getBearerToken } from '../lib/http';
import { limiters } from '../lib/rateLimits';
import { signParticipantToken, verifyParticipantToken } from '../lib/tokens';
import { extractMediaSource } from '../services/mediaExtractor';
import {
  createRoom,
  joinRoom,
  listMessages,
  listParticipants,
  requireRoom,
} from '../services/roomService';
import { participantToDto } from '../services/roomStore';

export function roomsRouter(): Router {
  const router = Router();

  router.post(
    '/rooms',
    asyncHandler(async (req, res) => {
      const limit = limiters.createRoom.consume(clientIp(req));
      if (!limit.allowed) {
        throw new AppError('RATE_LIMITED', 'Demasiadas salas creadas. Prueba más tarde.', 429, {
          retryAfterMs: limit.retryAfterMs,
        });
      }
      const data = createRoomSchema.parse(req.body);

      let finalVideoUrl = data.videoUrl;
      let finalVideoType = data.videoUrl ? detectVideoType(data.videoUrl) : undefined;
      if (data.videoUrl) {
        const extracted = await extractMediaSource(data.videoUrl);
        if (extracted) {
          finalVideoUrl = extracted.streamUrl;
          finalVideoType = extracted.type;
        }
      }

      const { room, participant, token } = await createRoom({
        nickname: data.nickname,
        videoUrl: finalVideoUrl,
        videoType: finalVideoType,
      });

      const body: CreateRoomResponse = {
        roomCode: room.code,
        joinUrl: `${getEnv().WEB_ORIGIN}/room/${room.code}`,
        participantToken: token,
        participant: participantToDto(participant),
        playback: { ...room.playback },
      };
      res.status(201).json(body);
    }),
  );

  router.get(
    '/rooms/:code',
    asyncHandler(async (req, res) => {
      const code = roomCodeSchema.parse(req.params.code);
      const limit = limiters.joinRoom.consume(clientIp(req));
      if (!limit.allowed) {
        throw new AppError('RATE_LIMITED', 'Demasiadas consultas. Espera un momento.', 429);
      }
      const room = await requireRoom(code);
      const body: PublicRoomResponse = {
        room: { code: room.code, createdAt: room.createdAt, isActive: room.isActive },
        playback: { ...room.playback },
        participants: listParticipants(room),
        serverTime: Date.now(),
      };
      res.json(body);
    }),
  );

  router.post(
    '/rooms/:code/join',
    asyncHandler(async (req, res) => {
      const limit = limiters.joinRoom.consume(clientIp(req));
      if (!limit.allowed) {
        throw new AppError(
          'RATE_LIMITED',
          'Demasiados intentos para unirse. Espera un momento.',
          429,
          {
            retryAfterMs: limit.retryAfterMs,
          },
        );
      }
      const code = roomCodeSchema.parse(req.params.code);
      const data = joinRoomSchema.parse(req.body);
      const joined = await joinRoom({ code, nickname: data.nickname });
      const token = signParticipantToken(
        { pid: joined.participant.id, rid: joined.room.id },
        getEnv().TOKEN_SECRET,
      );

      const body: JoinRoomResponse = {
        roomCode: joined.room.code,
        participantToken: token,
        participant: participantToDto(joined.participant),
        playback: { ...joined.room.playback },
        participants: listParticipants(joined.room),
      };
      res.json(body);
    }),
  );

  router.get(
    '/rooms/:code/messages',
    asyncHandler(async (req, res) => {
      const code = roomCodeSchema.parse(req.params.code);
      const room = await requireRoom(code);
      const token = getBearerToken(req);
      if (!token) throw new AppError('UNAUTHORIZED', 'Falta el token de participante', 401);
      const payload = verifyParticipantToken(token, getEnv().TOKEN_SECRET);
      if (!payload || payload.rid !== room.id || !room.participants.has(payload.pid)) {
        throw new AppError('UNAUTHORIZED', 'Token inválido para esta sala', 401);
      }
      const rawLimit = Number.parseInt(String(req.query.limit ?? '100'), 10);
      const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
      const body: MessagesResponse = { messages: await listMessages(room, limit) };
      res.json(body);
    }),
  );

  return router;
}
