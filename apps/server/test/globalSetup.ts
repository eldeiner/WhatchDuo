import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Prepara una base SQLite limpia para los tests antes de arrancar Vitest.
 * Se ejecuta en un proceso aparte, por eso fija DATABASE_URL explícitamente.
 */
export default function globalSetup(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const serverDir = path.resolve(here, '..');
  const prismaCli = path.resolve(serverDir, '../../node_modules/prisma/build/index.js');

  if (!fs.existsSync(prismaCli)) {
    throw new Error(`No se encontró el CLI de Prisma en ${prismaCli}. Ejecuta npm install.`);
  }

  const env = {
    ...process.env,
    DATABASE_URL: 'file:./test.db',
  };

  execFileSync(
    process.execPath,
    [prismaCli, 'db', 'push', '--skip-generate', '--force-reset', '--accept-data-loss'],
    { cwd: serverDir, env, stdio: 'pipe' },
  );
}
