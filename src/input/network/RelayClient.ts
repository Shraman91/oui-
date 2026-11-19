import {
  ButtonEventPayload,
  ClientMessage,
  RumblePayload,
  SensorPacket,
  ServerMessage
} from './types';

export interface RelayClientOptions {
  host?: string;
  port?: number;
  autoConnect?: boolean;
}

export type RoomCreatedCallback = (code: string, controllerUrl: string) => void;
export type RemoteConnectionCallback = (remoteId: 1 | 2) => void;
export type SensorDataCallback = (remoteId: 1 | 2, packet: SensorPacket) => void;
export type ButtonEventCallback = (remoteId: 1 | 2, event: ButtonEventPayload) => void;
export type RecenterCallback = (remoteId: 1 | 2) => void;
export type ConnectionChangeCallback = (connected: boolean) => void;
export type ErrorCallback = (error: string) => void;

export class RelayClient {
  private socket: WebSocket | null = null;
  private host: string;
  private port: number;
  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;
  private lastPingSentAt = 0;
  private latencyMs = 0;

  private roomCode: string | null = null;
  private lanIp: string | null = null;
  private connectedRemotes: Set<1 | 2> = new Set();
  private isExplicitlyClosed = false;

  // Listeners
  private roomCreatedListeners: Set<RoomCreatedCallback> = new Set();
  private remoteConnectedListeners: Set<RemoteConnectionCallback> = new Set();
  private remoteDisconnectedListeners: Set<RemoteConnectionCallback> = new Set();
  private sensorDataListeners: Set<SensorDataCallback> = new Set();
  private buttonEventListeners: Set<ButtonEventCallback> = new Set();
  private recenterListeners: Set<RecenterCallback> = new Set();
  private connectionChangeListeners: Set<ConnectionChangeCallback> = new Set();
  private errorListeners: Set<ErrorCallback> = new Set();

  constructor(options: RelayClientOptions = {}) {
    const loc = typeof window !== 'undefined' ? window.location : null;
    this.host = options.host || (loc ? loc.hostname : 'localhost') || 'localhost';
    this.port = options.port || 8443;

    if (options.autoConnect) {
      this.connect();
    }
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'http:' ? 'ws:' : 'wss:';
    const wsUrl = `${protocol}//${this.host}:${this.port}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);
    } catch (err) {
      this.emitError(err instanceof Error ? err.message : 'WebSocket initialization failed');
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.notifyConnectionChange(true);
      this.startHeartbeat();
      this.requestCreateRoom();
    };

    this.socket.onmessage = (event: MessageEvent<string>) => {
      this.handleMessage(event.data);
    };

    this.socket.onclose = () => {
      this.cleanupSocket();
      this.notifyConnectionChange(false);
      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = () => {
      this.emitError('WebSocket encountered a network error');
    };
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.cleanupSocket();
    }
    this.notifyConnectionChange(false);
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  public getRoomCode(): string | null {
    return this.roomCode;
  }

  public getLanIp(): string | null {
    return this.lanIp;
  }

  public getPort(): number {
    return this.port;
  }

  public getLatency(): number {
    return this.latencyMs;
  }

  public isRemoteConnected(remoteId: 1 | 2): boolean {
    return this.connectedRemotes.has(remoteId);
  }

  public getConnectedRemotes(): (1 | 2)[] {
    return Array.from(this.connectedRemotes);
  }

  public getControllerUrl(): string | null {
    if (!this.roomCode) return null;
    const targetHost = this.lanIp || this.host;
    // Mobile requires HTTPS to access motion sensors
    return `https://${targetHost}:${this.port}/controller/?room=${this.roomCode}`;
  }

  public sendRumble(remoteId: 1 | 2, payload: RumblePayload): void {
    const msg: ClientMessage = {
      type: 'rumble',
      remoteId,
      payload
    };
    this.sendMessage(msg);
  }

  // Event Subscription Methods
  public onRoomCreated(cb: RoomCreatedCallback): () => void {
    this.roomCreatedListeners.add(cb);
    if (this.roomCode) {
      const url = this.getControllerUrl();
      if (url) cb(this.roomCode, url);
    }
    return () => this.roomCreatedListeners.delete(cb);
  }

  public onRemoteConnected(cb: RemoteConnectionCallback): () => void {
    this.remoteConnectedListeners.add(cb);
    return () => this.remoteConnectedListeners.delete(cb);
  }

  public onRemoteDisconnected(cb: RemoteConnectionCallback): () => void {
    this.remoteDisconnectedListeners.add(cb);
    return () => this.remoteDisconnectedListeners.delete(cb);
  }

  public onSensorData(cb: SensorDataCallback): () => void {
    this.sensorDataListeners.add(cb);
    return () => this.sensorDataListeners.delete(cb);
  }

  public onButtonEvent(cb: ButtonEventCallback): () => void {
    this.buttonEventListeners.add(cb);
    return () => this.buttonEventListeners.delete(cb);
  }

  public onRecenter(cb: RecenterCallback): () => void {
    this.recenterListeners.add(cb);
    return () => this.recenterListeners.delete(cb);
  }

  public onConnectionChange(cb: ConnectionChangeCallback): () => void {
    this.connectionChangeListeners.add(cb);
    cb(this.isConnected());
    return () => this.connectionChangeListeners.delete(cb);
  }

  public onError(cb: ErrorCallback): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  // Internal Logic
  private requestCreateRoom(): void {
    const msg: ClientMessage = {
      type: 'create_room'
    };
    this.sendMessage(msg);
  }

  private sendMessage(msg: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  private handleMessage(raw: string): void {
    try {
      const msg: ServerMessage = JSON.parse(raw);

      switch (msg.type) {
        case 'room_created': {
          if (msg.roomCode) {
            this.roomCode = msg.roomCode;
            if (msg.lanIp) this.lanIp = msg.lanIp;
            if (msg.port) this.port = msg.port;
            const url = this.getControllerUrl();
            if (url) {
              for (const listener of this.roomCreatedListeners) {
                listener(this.roomCode, url);
              }
            }
          }
          break;
        }

        case 'remote_connected': {
          if (msg.remoteId) {
            this.connectedRemotes.add(msg.remoteId);
            for (const listener of this.remoteConnectedListeners) {
              listener(msg.remoteId);
            }
          }
          break;
        }

        case 'remote_disconnected': {
          if (msg.remoteId) {
            this.connectedRemotes.delete(msg.remoteId);
            for (const listener of this.remoteDisconnectedListeners) {
              listener(msg.remoteId);
            }
          }
          break;
        }

        case 'sensor_data': {
          if (msg.remoteId && msg.payload) {
            const packet = msg.payload as SensorPacket;
            for (const listener of this.sensorDataListeners) {
              listener(msg.remoteId, packet);
            }
          }
          break;
        }

        case 'button_event': {
          if (msg.remoteId && msg.payload) {
            const btnEvent = msg.payload as ButtonEventPayload;
            for (const listener of this.buttonEventListeners) {
              listener(msg.remoteId, btnEvent);
            }
          }
          break;
        }

        case 'recenter': {
          if (msg.remoteId) {
            for (const listener of this.recenterListeners) {
              listener(msg.remoteId);
            }
          }
          break;
        }

        case 'pong': {
          this.latencyMs = Math.round(performance.now() - this.lastPingSentAt);
          break;
        }

        case 'error': {
          this.emitError(msg.message || 'Unknown server error');
          break;
        }
      }
    } catch (err) {
      this.emitError(err instanceof Error ? err.message : 'Error parsing server message');
    }
  }

  private startHeartbeat(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.lastPingSentAt = performance.now();
        this.sendMessage({ type: 'ping' });
      }
    }, 4000);
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed || this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  private cleanupSocket(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.socket = null;
    this.connectedRemotes.clear();
  }

  private notifyConnectionChange(connected: boolean): void {
    for (const listener of this.connectionChangeListeners) {
      listener(connected);
    }
  }

  private emitError(err: string): void {
    for (const listener of this.errorListeners) {
      listener(err);
    }
  }
}
