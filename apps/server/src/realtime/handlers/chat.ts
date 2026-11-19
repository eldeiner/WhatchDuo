import type { Ack, ChatMessage, Reaction } from '@cineduo/shared';
import { chatSendSchema, reactionSendSchema } from '@cineduo/shared';
import { AppError } from '../../lib/errors';
import { limiters, sanitizeChatText } from '../../lib/rateLimits';
import { appendMessage } from '../../services/roomService';
import { enforceLimit, parsePayload, socketContext } from '../context';
import { broadcastChat, replyError } from '../emit';
import type { CineServer, CineSocket } from '../socketTypes';
import { randomUUID } from 'node:crypto';

export function registerChatHandlers(io: CineServer, socket: CineSocket): void {
  socket.on('chat:send', async (payload, ack) => {
    try {
      const { room, participant } = socketContext(socket);
      enforceLimit(limiters.chat, participant.id);
      const data = parsePayload(chatSendSchema, payload);
      const text = sanitizeChatText(data.text);
      if (!text) throw new AppError('VALIDATION_ERROR', 'El mensaje está vacío', 422);

      const message = await appendMessage(room, participant, text);
      broadcastChat(io, room, message);
      if (typeof ack === 'function') ack({ ok: true, data: message });
    } catch (error) {
      replyError(socket, error, ack as ((res: Ack<never>) => void) | undefined, 'chat:send');
    }
  });

  socket.on('chat:reaction', (payload) => {
    try {
      const { room, participant } = socketContext(socket);
      enforceLimit(limiters.reaction, participant.id);
      const data = parsePayload(reactionSendSchema, payload);

      const reaction: Reaction = {
        id: randomUUID(),
        participantId: participant.id,
        nickname: participant.nickname,
        emoji: data.emoji,
        createdAt: Date.now(),
      };
      io.to(`room:${room.code}`).emit('chat:reaction', { reaction });
    } catch (error) {
      replyError(socket, error);
    }
  });
}

export type { ChatMessage };
