"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCineServer = createCineServer;
const node_http_1 = require("node:http");
const app_1 = require("./app");
const io_1 = require("./realtime/io");
function createCineServer() {
    const app = (0, app_1.createApp)();
    const httpServer = (0, node_http_1.createServer)(app);
    const io = (0, io_1.createRealtime)(httpServer);
    return { app, httpServer, io };
}
//# sourceMappingURL=server.js.map