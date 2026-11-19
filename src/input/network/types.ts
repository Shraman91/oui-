export type ButtonId =
  | 'A'
  | 'B'
  | 'DPAD_UP'
  | 'DPAD_DOWN'
  | 'DPAD_LEFT'
  | 'DPAD_RIGHT'
  | 'PLUS'
  | 'MINUS'
  | 'HOME'
  | 'ONE'
  | 'TWO'
  | 'RECENTER';

export interface SensorPacket {
  t: number;
  orientation: { alpha: number; beta: number; gamma: number };
  rotationRate?: { alpha: number; beta: number; gamma: number };
  accel?: { x: number; y: number; z: number };
  accelG?: { x: number; y: number; z: number };
  buttons: number;
}

export interface ButtonEventPayload {
  button: ButtonId;
  state: 'down' | 'up';
}

export interface RumblePayload {
  duration?: number;
  pattern?: number[];
  strength?: number;
}

export interface ClientMessage {
  type:
    | 'create_room'
    | 'join_room'
    | 'sensor_data'
    | 'button_event'
    | 'recenter'
    | 'rumble'
    | 'ping'
    | 'pong';
  roomCode?: string;
  remoteId?: 1 | 2;
  payload?: SensorPacket | ButtonEventPayload | RumblePayload | unknown;
}

export interface ServerMessage {
  type:
    | 'room_created'
    | 'joined'
    | 'remote_connected'
    | 'remote_disconnected'
    | 'sensor_data'
    | 'button_event'
    | 'recenter'
    | 'rumble'
    | 'error'
    | 'pong';
  roomCode?: string;
  remoteId?: 1 | 2;
  lanIp?: string;
  port?: number;
  httpPort?: number;
  httpsPort?: number;
  message?: string;
  payload?: SensorPacket | ButtonEventPayload | RumblePayload | unknown;
}
