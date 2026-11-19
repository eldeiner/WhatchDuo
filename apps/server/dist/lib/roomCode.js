"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomRoomCode = randomRoomCode;
exports.generateUniqueRoomCode = generateUniqueRoomCode;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@cineduo/shared");
/**
 * Código criptográficamente aleatorio (randomInt usa CSPRNG). 32^6 ≈ 1.07e9
 * combinaciones, sin caracteres ambiguos.
 */
function randomRoomCode(length = shared_1.ROOM_CODE_LENGTH) {
    let code = '';
    for (let i = 0; i < length; i += 1) {
        code += shared_1.ROOM_CODE_ALPHABET[(0, node_crypto_1.randomInt)(0, shared_1.ROOM_CODE_ALPHABET.length)];
    }
    return code;
}
async function generateUniqueRoomCode(exists, attempts = 8) {
    for (let i = 0; i < attempts; i += 1) {
        const code = randomRoomCode();
        if (!(await exists(code)))
            return code;
    }
    throw new Error('No se pudo generar un código de sala único');
}
//# sourceMappingURL=roomCode.js.map