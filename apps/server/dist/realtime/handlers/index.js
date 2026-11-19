"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandlers = registerHandlers;
const chat_1 = require("./chat");
const clock_1 = require("./clock");
const host_1 = require("./host");
const player_1 = require("./player");
const room_1 = require("./room");
function registerHandlers(io, socket) {
    (0, room_1.registerRoomHandlers)(io, socket);
    (0, player_1.registerPlayerHandlers)(io, socket);
    (0, chat_1.registerChatHandlers)(io, socket);
    (0, host_1.registerHostHandlers)(io, socket);
    (0, clock_1.registerClockHandlers)(io, socket);
    (0, clock_1.registerWebRtcHandlers)(io, socket);
}
//# sourceMappingURL=index.js.map