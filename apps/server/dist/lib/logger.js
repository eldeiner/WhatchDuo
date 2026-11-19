"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const env_1 = require("../config/env");
const ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
const env = (0, env_1.getEnv)();
const threshold = ORDER[env.LOG_LEVEL];
/** Log estructurado en una línea, sin secretos ni tokens. */
function log(level, message, fields = {}) {
    if (ORDER[level] < threshold)
        return;
    const entry = {
        level,
        time: new Date().toISOString(),
        service: 'cineduo-server',
        message,
        ...fields,
    };
    const line = JSON.stringify(entry);
    if (level === 'error')
        console.error(line);
    else if (level === 'warn')
        console.warn(line);
    else
        console.info(line);
}
exports.logger = {
    debug: (message, fields) => log('debug', message, fields),
    info: (message, fields) => log('info', message, fields),
    warn: (message, fields) => log('warn', message, fields),
    error: (message, fields) => log('error', message, fields),
};
//# sourceMappingURL=logger.js.map