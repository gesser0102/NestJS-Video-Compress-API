import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

interface SocketEvents {
  'global-video-progress': (data: { videoId: string; progress: number; status: string }) => void;
  'global-video-completed': (data: { videoId: string; lowResPath: string }) => void;
  'global-video-failed': (data: { videoId: string; error: string }) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectInterval = 1000;
  private connectionListeners: ((connected: boolean) => void)[] = [];

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.baseReconnectInterval,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 20000,
      forceNew: false,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);
    });

    this.socket.on('disconnect', (reason) => {
      this.notifyConnectionChange(false);
      
      if (reason === 'transport close' || reason === 'transport error' || reason === 'ping timeout') {
        setTimeout(() => {
          if (!this.socket?.connected) {
            this.socket?.connect();
          }
        }, 2000);
      }
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
      this.notifyConnectionChange(false);
    });

    this.socket.on('reconnect', () => {
      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);
    });

    this.socket.on('reconnect_attempt', () => {
    });

    this.socket.on('reconnect_error', () => {
    });

    this.socket.on('reconnect_failed', () => {
      this.notifyConnectionChange(false);
    });
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionListeners.forEach(listener => listener(connected));
  }

  onConnectionChange(callback: (connected: boolean) => void): void {
    this.connectionListeners.push(callback);
  }

  offConnectionChange(callback: (connected: boolean) => void): void {
    const index = this.connectionListeners.indexOf(callback);
    if (index > -1) {
      this.connectionListeners.splice(index, 1);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }


  // Global event listeners for video list
  onGlobalVideoProgress(callback: SocketEvents['global-video-progress']): void {
    this.socket?.on('global-video-progress', callback);
  }

  onGlobalVideoCompleted(callback: SocketEvents['global-video-completed']): void {
    this.socket?.on('global-video-completed', callback);
  }

  onGlobalVideoFailed(callback: SocketEvents['global-video-failed']): void {
    this.socket?.on('global-video-failed', callback);
  }

  offGlobalVideoProgress(callback: SocketEvents['global-video-progress']): void {
    this.socket?.off('global-video-progress', callback);
  }

  offGlobalVideoCompleted(callback: SocketEvents['global-video-completed']): void {
    this.socket?.off('global-video-completed', callback);
  }

  offGlobalVideoFailed(callback: SocketEvents['global-video-failed']): void {
    this.socket?.off('global-video-failed', callback);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  get socketInstance(): Socket | null {
    return this.socket;
  }

  forceReconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      setTimeout(() => {
        this.socket?.connect();
      }, 1000);
    } else {
      this.connect();
    }
  }
}

export const socketService = new SocketService();