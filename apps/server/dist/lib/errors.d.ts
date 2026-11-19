import type { ErrorCode } from '@cineduo/shared';
import type { NextFunction, Request, Response } from 'express';
export declare class AppError extends Error {
    readonly code: ErrorCode;
    readonly status: number;
    readonly details?: unknown;
    readonly request?: string;
    constructor(code: ErrorCode, message: string, status?: number, details?: unknown);
}
export declare const notFound: (message?: string) => AppError;
export declare const forbidden: (message?: string) => AppError;
export declare const unauthorized: (message?: string) => AppError;
export declare const rateLimited: (message?: string) => AppError;
export declare const validationError: (message: string, details?: unknown) => AppError;
/** Normaliza cualquier error a la forma `{ error: { code, message } }`. */
export declare function toErrorBody(error: unknown): {
    status: number;
    body: {
        error: {
            code: ErrorCode;
            message: string;
            details?: unknown;
        };
    };
};
export declare function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void;
/** Traduce un error a un payload de Socket.IO. */
export declare function toWsError(error: unknown): {
    code: ErrorCode;
    message: string;
    details?: unknown;
};
