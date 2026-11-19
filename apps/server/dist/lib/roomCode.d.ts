/**
 * Código criptográficamente aleatorio (randomInt usa CSPRNG). 32^6 ≈ 1.07e9
 * combinaciones, sin caracteres ambiguos.
 */
export declare function randomRoomCode(length?: number): string;
export declare function generateUniqueRoomCode(exists: (code: string) => Promise<boolean>, attempts?: number): Promise<string>;
