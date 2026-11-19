'use client';

import { getRoomSocket } from '../session';
import { useRoomStore } from '../store';

export type WebRtcSignalMessage =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'candidate'; candidate: RTCIceCandidateInit }
  | { type: 'stream-started' }
  | { type: 'stream-ended' };

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

class WebRtcSessionManager {
  private localStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private remoteStream: MediaStream | null = null;
  private onRemoteStreamCallbacks = new Set<(stream: MediaStream | null) => void>();
  private onBroadcastingChangeCallbacks = new Set<(active: boolean) => void>();
  private isBroadcaster = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const checkAndSetup = () => {
        const socket = getRoomSocket();
        if (socket) {
          socket.off('webrtc:signal', this.handleSignal);
          socket.on('webrtc:signal', this.handleSignal);
        }
      };
      setInterval(checkAndSetup, 1000);
    }
  }

  public subscribeRemoteStream(cb: (stream: MediaStream | null) => void): () => void {
    this.onRemoteStreamCallbacks.add(cb);
    cb(this.remoteStream);
    return () => {
      this.onRemoteStreamCallbacks.delete(cb);
    };
  }

  public subscribeBroadcasting(cb: (active: boolean) => void): () => void {
    this.onBroadcastingChangeCallbacks.add(cb);
    cb(this.isBroadcaster);
    return () => {
      this.onBroadcastingChangeCallbacks.delete(cb);
    };
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public isHostingStream(): boolean {
    return this.isBroadcaster;
  }

  private handleSignal = async ({ fromId, data }: { fromId: string; data: unknown }) => {
    const signal = data as WebRtcSignalMessage;
    if (!signal || !signal.type) return;

    if (signal.type === 'stream-started') {
      // Si soy invitado y el host avisa que empezó a transmitir, pido la conexión
      if (!this.isBroadcaster) {
        await this.prepareGuestConnection(fromId);
      }
      return;
    }

    if (signal.type === 'stream-ended') {
      this.closePeer(fromId);
      this.setRemoteStream(null);
      return;
    }

    let pc = this.peerConnections.get(fromId);

    if (signal.type === 'offer') {
      if (!pc) {
        pc = this.createPeer(fromId, false);
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal(fromId, { type: 'answer', sdp: answer });
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
      return;
    }

    if (signal.type === 'answer') {
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } catch (err) {
          console.error('Error handling WebRTC answer:', err);
        }
      }
      return;
    }

    if (signal.type === 'candidate') {
      if (pc && signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    }
  };

  private sendSignal(targetId: string, data: WebRtcSignalMessage) {
    const socket = getRoomSocket();
    if (socket?.connected) {
      socket.emit('webrtc:signal', { targetId, data });
    }
  }

  private setRemoteStream(stream: MediaStream | null) {
    this.remoteStream = stream;
    for (const cb of this.onRemoteStreamCallbacks) {
      cb(stream);
    }
  }

  private setBroadcasting(active: boolean) {
    this.isBroadcaster = active;
    for (const cb of this.onBroadcastingChangeCallbacks) {
      cb(active);
    }
  }

  private createPeer(peerId: string, isInitiator: boolean): RTCPeerConnection {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerId, { type: 'candidate', candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.setRemoteStream(event.streams[0]);
      } else {
        const stream = new MediaStream([event.track]);
        this.setRemoteStream(stream);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        this.closePeer(peerId);
      }
    };

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    return pc;
  }

  private closePeer(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
  }

  /**
   * Host inicia la captura de pantalla/pestaña y difunde a los participantes
   */
  public async startTabShare(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Tu navegador no soporta compartir pantalla o pestañas.');
    }

    // Capturar pantalla o pestaña con audio preferente
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
      } as MediaTrackConstraints,
      audio: true,
    });

    this.localStream = stream;
    this.setBroadcasting(true);

    // Cuando el usuario detenga de compartir desde la barra flotante del navegador
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      this.stopTabShare();
    });

    // Anunciar a los participantes que empezó la transmisión
    const participants = useRoomStore.getState().participants;
    const myId = useRoomStore.getState().myId;
    for (const p of participants) {
      if (p.id !== myId && p.isConnected) {
        this.connectToPeerAsHost(p.id);
      }
    }

    return stream;
  }

  private async connectToPeerAsHost(peerId: string) {
    const pc = this.createPeer(peerId, true);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal(peerId, { type: 'offer', sdp: offer });
    } catch (err) {
      console.error(`Error connecting to peer ${peerId}:`, err);
    }
  }

  private async prepareGuestConnection(hostId: string) {
    // Si ya existe conexión con el host, se limpia
    this.closePeer(hostId);
    // Esperar oferta del host
  }

  public notifyParticipantJoined(participantId: string) {
    if (this.isBroadcaster && this.localStream) {
      this.connectToPeerAsHost(participantId);
    }
  }

  public stopTabShare() {
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    // Notificar a todos los peers conectados
    const participants = useRoomStore.getState().participants;
    const myId = useRoomStore.getState().myId;
    for (const p of participants) {
      if (p.id !== myId) {
        this.sendSignal(p.id, { type: 'stream-ended' });
      }
    }

    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();
    this.setBroadcasting(false);
  }
}

export const webrtcSession = new WebRtcSessionManager();
