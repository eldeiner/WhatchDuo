import type { NextFunction, Request, RequestHandler, Response } from 'express';
export declare function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler;
export declare function getBearerToken(req: Request): string | null;
export declare function clientIp(req: Request): string;
