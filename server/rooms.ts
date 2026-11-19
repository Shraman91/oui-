import { WebSocket } from 'ws';

export interface Room {
  code: string;
  consoleSocket: WebSocket | null;
  remotes: Map<1 | 2, WebSocket>;
  createdAt: number;
  lastActiveAt: number;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private socketToRoom: Map<WebSocket, { roomCode: string; role: 'console' | 'remote'; remoteId?: 1 | 2 }> = new Map();

  // Characters omitting ambiguous characters (0, O, 1, I)
  private readonly CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  public createRoom(consoleSocket: WebSocket): Room {
    // Generate a unique 4-character room code
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        const idx = Math.floor(Math.random() * this.CODE_CHARS.length);
        code += this.CODE_CHARS[idx];
      }
    } while (this.rooms.has(code));

    const room: Room = {
      code,
      consoleSocket,
      remotes: new Map(),
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(consoleSocket, { roomCode: code, role: 'console' });
    return room;
  }

  public getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  public joinRoom(code: string, remoteSocket: WebSocket): { room: Room; remoteId: 1 | 2 } | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || !room.consoleSocket) {
      return null;
    }

    // Assign remoteId: 1 if free, else 2 if free
    let assignedId: 1 | 2 | null = null;
    if (!room.remotes.has(1)) {
      assignedId = 1;
    } else if (!room.remotes.has(2)) {
      assignedId = 2;
    } else {
      // Room full
      return null;
    }

    room.remotes.set(assignedId, remoteSocket);
    room.lastActiveAt = Date.now();
    this.socketToRoom.set(remoteSocket, { roomCode: room.code, role: 'remote', remoteId: assignedId });

    return { room, remoteId: assignedId };
  }

  public getSocketInfo(socket: WebSocket) {
    return this.socketToRoom.get(socket);
  }

  public handleDisconnect(socket: WebSocket): { roomCode: string; role: 'console' | 'remote'; remoteId?: 1 | 2 } | null {
    const info = this.socketToRoom.get(socket);
    if (!info) return null;

    this.socketToRoom.delete(socket);
    const room = this.rooms.get(info.roomCode);

    if (room) {
      if (info.role === 'console') {
        // Console closed: disconnect all remotes and clean room
        for (const remote of room.remotes.values()) {
          try {
            remote.send(JSON.stringify({ type: 'error', message: 'Console disconnected' }));
            remote.close();
          } catch {
            // Ignore socket send errors
          }
        }
        this.rooms.delete(info.roomCode);
      } else if (info.role === 'remote' && info.remoteId) {
        room.remotes.delete(info.remoteId);
        room.lastActiveAt = Date.now();
      }
    }

    return info;
  }

  public cleanupStaleRooms(maxAgeMs = 3600000): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.lastActiveAt > maxAgeMs) {
        if (room.consoleSocket) {
          try {
            room.consoleSocket.close();
          } catch {}
        }
        for (const remote of room.remotes.values()) {
          try {
            remote.close();
          } catch {}
        }
        this.rooms.delete(code);
      }
    }
  }
}
