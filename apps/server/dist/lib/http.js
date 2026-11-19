"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
exports.getBearerToken = getBearerToken;
exports.clientIp = clientIp;
function asyncHandler(handler) {
    return (req, res, next) => {
        handler(req, res, next).catch(next);
    };
}
function getBearerToken(req) {
    const header = req.header('authorization');
    if (header?.toLowerCase().startsWith('bearer '))
        return header.slice(7).trim();
    const query = req.query.token;
    if (typeof query === 'string' && query.length > 0)
        return query;
    return null;
}
function clientIp(req) {
    return req.ip || req.socket.remoteAddress || 'unknown';
}
//# sourceMappingURL=http.js.map