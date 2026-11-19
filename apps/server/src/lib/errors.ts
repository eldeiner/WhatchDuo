import type { ErrorCode } from '@cineduo/shared';
import { ERROR_CODES } from '@cineduo/shared';
import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger';

interface ZodIssueLike {
  path: Array<string | number>;
  message: string;
}

/**
 * Comprobación estructural en lugar de `instanceof ZodError`: con doble build
 * CJS/ESM de zod, `instanceof` puede fallar entre módulos aunque el error sea
 * idéntico. `issues` es estable en Zod 3.
 */
function isZodError(error: unknown): error is { issues: ZodIssueLike[] } {
  return (
    typeof error === 'object' &&
    error !== null &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly request?: string;

  constructor(code: ErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const notFound = (message = 'Recurso no encontrado') =>
  new AppError(ERROR_CODES.NOT_FOUND, message, 404);

export const forbidden = (message = 'No tienes permiso para esta acción') =>
  new AppError(ERROR_CODES.FORBIDDEN, message, 403);

export const unauthorized = (message = 'Token de participante inválido') =>
  new AppError(ERROR_CODES.UNAUTHORIZED, message, 401);

export const rateLimited = (message = 'Demasiadas peticiones. Inténtalo en unos segundos.') =>
  new AppError(ERROR_CODES.RATE_LIMITED, message, 429);

export const validationError = (message: string, details?: unknown) =>
  new AppError(ERROR_CODES.VALIDATION, message, 422, details);

/** Normaliza cualquier error a la forma `{ error: { code, message } }`. */
export function toErrorBody(error: unknown): {
  status: number;
  body: { error: { code: ErrorCode; message: string; details?: unknown } };
} {
  if (isZodError(error)) {
    return {
      status: 422,
      body: {
        error: {
          code: ERROR_CODES.VALIDATION,
          message: error.issues[0]?.message ?? 'Datos inválidos',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    };
  }

  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: { code: error.code, message: error.message, details: error.details },
      },
    };
  }

  logger.error('unhandled_error', { error: (error as Error)?.message });
  return {
    status: 500,
    body: {
      error: { code: ERROR_CODES.INTERNAL, message: 'Error interno del servidor' },
    },
  };
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const { status, body } = toErrorBody(error);
  res.status(status).json(body);
}

/** Traduce un error a un payload de Socket.IO. */
export function toWsError(error: unknown): {
  code: ErrorCode;
  message: string;
  details?: unknown;
} {
  const { body } = toErrorBody(error);
  return body.error;
}
