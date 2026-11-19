"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLiveRoom = getLiveRoom;
exports.setLiveRoom = setLiveRoom;
exports.removeLiveRoom = removeLiveRoom;
exports.allLiveRooms = allLiveRooms;
exports.clearLiveRooms = clearLiveRooms;
exports.participantToDto = participantToDto;
exports.sortParticipants = sortParticipants;
/**
 * Estado autoritativo "caliente" en memoria. La base de datos es el espejo
 * duradero: permite recuperar la sala tras un reinicio y guarda historial.
 */
const liveRooms = new Map();
function getLiveRoom(code) {
    return liveRooms.get(code.toUpperCase());
}
function setLiveRoom(room) {
    liveRooms.set(room.code, room);
}
function removeLiveRoom(code) {
    const room = liveRooms.get(code);
    if (room?.hostGraceTimer)
        clearTimeout(room.hostGraceTimer);
    if (room?.persistTimer)
        clearTimeout(room.persistTimer);
    liveRooms.delete(code);
}
function allLiveRooms() {
    return [...liveRooms.values()];
}
function clearLiveRooms() {
    for (const code of [...liveRooms.keys()])
        removeLiveRoom(code);
}
function participantToDto(participant) {
    return {
        id: participant.id,
        nickname: participant.nickname,
        role: participant.role,
        isConnected: participant.isConnected,
        lastSeen: participant.lastSeen,
    };
}
function sortParticipants(participants) {
    return [...participants].sort((a, b) => {
        if (a.role !== b.role)
            return a.role === 'host' ? -1 : 1;
        if (a.isConnected !== b.isConnected)
            return a.isConnected ? -1 : 1;
        return a.joinedAt - b.joinedAt;
    });
}
//# sourceMappingURL=roomStore.js.map