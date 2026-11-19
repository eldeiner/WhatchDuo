import { randomInt } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@cineduo/shared';

/**
 * Código criptográficamente aleatorio (randomInt usa CSPRNG). 32^6 ≈ 1.07e9
 * combinaciones, sin caracteres ambiguos.
 */
export function randomRoomCode(length = ROOM_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export async function generateUniqueRoomCode(
  exists: (code: string) => Promise<boolean>,
  attempts = 8,
): Promise<string> {
  for (let i = 0; i < attempts; i += 1) {
    const code = randomRoomCode();
    if (!(await exists(code))) return code;
  }
  throw new Error('No se pudo generar un código de sala único');
}
