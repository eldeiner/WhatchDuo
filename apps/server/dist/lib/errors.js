"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationError = exports.rateLimited = exports.unauthorized = exports.forbidden = exports.notFound = exports.AppError = void 0;
exports.toErrorBody = toErrorBody;
exports.errorHandler = errorHandler;
exports.toWsError = toWsError;
const shared_1 = require("@cineduo/shared");
const logger_1 = require("./logger");
/**
 * Comprobación estructural en lugar de `instanceof ZodError`: con doble build
 * CJS/ESM de zod, `instanceof` puede fallar entre módulos aunque el error sea
 * idéntico. `issues` es estable en Zod 3.
 */
function isZodError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        Array.isArray(error.issues));
}
class AppError extends Error {
    code;
    status;
    details;
    request;
    constructor(code, message, status = 400, details) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
exports.AppError = AppError;
const notFound = (message = 'Recurso no encontrado') => new AppError(shared_1.ERROR_CODES.NOT_FOUND, message, 404);
exports.notFound = notFound;
const forbidden = (message = 'No tienes permiso para esta acción') => new AppError(shared_1.ERROR_CODES.FORBIDDEN, message, 403);
exports.forbidden = forbidden;
const unauthorized = (message = 'Token de participante inválido') => new AppError(shared_1.ERROR_CODES.UNAUTHORIZED, message, 401);
exports.unauthorized = unauthorized;
const rateLimited = (message = 'Demasiadas peticiones. Inténtalo en unos segundos.') => new AppError(shared_1.ERROR_CODES.RATE_LIMITED, message, 429);
exports.rateLimited = rateLimited;
const validationError = (message, details) => new AppError(shared_1.ERROR_CODES.VALIDATION, message, 422, details);
exports.validationError = validationError;
/** Normaliza cualquier error a la forma `{ error: { code, message } }`. */
function toErrorBody(error) {
    if (isZodError(error)) {
        return {
            status: 422,
            body: {
                error: {
                    code: shared_1.ERROR_CODES.VALIDATION,
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
    logger_1.logger.error('unhandled_error', { error: error?.message });
    return {
        status: 500,
        body: {
            error: { code: shared_1.ERROR_CODES.INTERNAL, message: 'Error interno del servidor' },
        },
    };
}
function errorHandler(error, _req, res, _next) {
    const { status, body } = toErrorBody(error);
    res.status(status).json(body);
}
/** Traduce un error a un payload de Socket.IO. */
function toWsError(error) {
    const { body } = toErrorBody(error);
    return body.error;
}
//# sourceMappingURL=errors.js.map