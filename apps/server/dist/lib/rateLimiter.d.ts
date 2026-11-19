/**
 * Rate limiter de ventana deslizante en memoria. Suficiente para un MVP en una
 * sola instancia. Para escalar horizontalmente, sustituir por
 * `rate-limiter-flexible` respaldado por Redis.
 */
export declare class SlidingWindowLimiter {
    private readonly points;
    private readonly windowMs;
    private readonly hits;
    constructor(points: number, windowMs: number);
    consume(key: string, now?: number): {
        allowed: boolean;
        remaining: number;
        retryAfterMs: number;
    };
    reset(key?: string): void;
    private maybePrune;
}
