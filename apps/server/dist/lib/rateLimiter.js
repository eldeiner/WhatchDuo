"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlidingWindowLimiter = void 0;
/**
 * Rate limiter de ventana deslizante en memoria. Suficiente para un MVP en una
 * sola instancia. Para escalar horizontalmente, sustituir por
 * `rate-limiter-flexible` respaldado por Redis.
 */
class SlidingWindowLimiter {
    points;
    windowMs;
    hits = new Map();
    constructor(points, windowMs) {
        this.points = points;
        this.windowMs = windowMs;
    }
    consume(key, now = Date.now()) {
        const cutoff = now - this.windowMs;
        const previous = this.hits.get(key) ?? [];
        const fresh = previous.filter((timestamp) => timestamp > cutoff);
        if (fresh.length >= this.points) {
            const oldest = fresh[0] ?? now;
            this.hits.set(key, fresh);
            return {
                allowed: false,
                remaining: 0,
                retryAfterMs: Math.max(0, oldest + this.windowMs - now),
            };
        }
        fresh.push(now);
        this.hits.set(key, fresh);
        this.maybePrune(now);
        return { allowed: true, remaining: this.points - fresh.length, retryAfterMs: 0 };
    }
    reset(key) {
        if (key)
            this.hits.delete(key);
        else
            this.hits.clear();
    }
    maybePrune(now) {
        if (this.hits.size < 5000)
            return;
        const cutoff = now - this.windowMs;
        for (const [key, timestamps] of this.hits) {
            const fresh = timestamps.filter((t) => t > cutoff);
            if (fresh.length === 0)
                this.hits.delete(key);
            else
                this.hits.set(key, fresh);
        }
    }
}
exports.SlidingWindowLimiter = SlidingWindowLimiter;
//# sourceMappingURL=rateLimiter.js.map