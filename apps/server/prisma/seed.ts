/**
 * Seed de desarrollo: crea una sala de demostración con dos participantes y
 * algunos mensajes. Idempotente: si la sala existe, la reinicia.
 *
 *   npm run db:seed
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_CODE = 'DEMO24';

async function main(): Promise<void> {
  const existing = await prisma.room.findUnique({ where: { code: DEMO_CODE } });

  if (existing) {
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { roomId: existing.id } }),
      prisma.roomEvent.deleteMany({ where: { roomId: existing.id } }),
      prisma.participant.deleteMany({ where: { roomId: existing.id } }),
      prisma.room.delete({ where: { id: existing.id } }),
    ]);
  }

  const room = await prisma.room.create({
    data: {
      code: DEMO_CODE,
      videoUrl: '/videos/demo.mp4',
      videoType: 'mp4',
      position: 0,
      isPlaying: false,
      playbackRate: 1,
      version: 1,
      isActive: true,
    },
  });

  const host = await prisma.participant.create({
    data: { roomId: room.id, nickname: 'Ana', role: 'host', isConnected: false },
  });
  const guest = await prisma.participant.create({
    data: { roomId: room.id, nickname: 'Leo', role: 'guest', isConnected: false },
  });

  await prisma.room.update({ where: { id: room.id }, data: { hostId: host.id } });

  await prisma.message.createMany({
    data: [
      {
        roomId: room.id,
        participantId: host.id,
        nickname: host.nickname,
        text: '¡Hola! Pulsa play cuando quieras empezar 🍿',
      },
      {
        roomId: room.id,
        participantId: guest.id,
        nickname: guest.nickname,
        text: 'Listo, entro desde el móvil. ¿Se ve bien?',
      },
    ],
  });

  console.log('Sala de demostración lista:');
  console.log(`  Código: ${DEMO_CODE}`);
  console.log(`  URL:    ${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/room/${DEMO_CODE}`);
  console.log(`  Host:   ${host.nickname} — Invitado: ${guest.nickname}`);
}

main()
  .catch((error) => {
    console.error('Seed falló:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
