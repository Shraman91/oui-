import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './rooms.ts';
import { loadSslCerts } from './cert.ts';
import type { ClientMessage, ServerMessage } from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const PORT = Number.parseInt(process.env.PORT || '8443', 10);

/**
 * Resolves local primary LAN IPv4 address (e.g. 192.168.1.x)
 */
export function getLocalLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name];
    if (!list) continue;
    for (const net of list) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const lanIp = getLocalLanIp();
const roomManager = new RoomManager();

// 1. Static HTTP Request Handler
function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // Route /controller to /controller/index.html
  if (pathname === '/controller' || pathname === '/controller/') {
    pathname = '/controller/index.html';
  }

  const filePath = path.join(publicDir, pathname);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Health check fallback
      if (pathname === '/health' || pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'oui-relay-server', lanIp, port: PORT }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.svg': 'image/svg+xml'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

// 2. Load SSL certificates for HTTPS (Required for phone motion sensors)
const certs = loadSslCerts();
let server: https.Server | http.Server;

if (certs) {
  server = https.createServer({ key: certs.key, cert: certs.cert }, handleHttpRequest);
} else {
  console.warn('[oui-relay] No certs/cert.pem found. Starting plain HTTP (sensors may be blocked on mobile).');
  server = http.createServer(handleHttpRequest);
}

// 3. Attach WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (data: string) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());

      switch (msg.type) {
        case 'create_room': {
          const room = roomManager.createRoom(ws);
          const reply: ServerMessage = {
            type: 'room_created',
            roomCode: room.code,
            lanIp,
            port: PORT
          };
          ws.send(JSON.stringify(reply));
          break;
        }

        case 'join_room': {
          if (!msg.roomCode) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room code required' }));
            return;
          }
          const result = roomManager.joinRoom(msg.roomCode, ws);
          if (!result) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid or full room' }));
            return;
          }

          // Reply to phone remote
          const joinedMsg: ServerMessage = {
            type: 'joined',
            remoteId: result.remoteId,
            roomCode: result.room.code
          };
          ws.send(JSON.stringify(joinedMsg));

          // Notify console
          const notifyConsole: ServerMessage = {
            type: 'remote_connected',
            remoteId: result.remoteId,
            roomCode: result.room.code
          };
          result.room.consoleSocket?.send(JSON.stringify(notifyConsole));
          break;
        }

        case 'sensor_data':
        case 'button_event':
        case 'recenter': {
          const info = roomManager.getSocketInfo(ws);
          if (!info || info.role !== 'remote') return;
          const room = roomManager.getRoom(info.roomCode);
          if (room && room.consoleSocket && room.consoleSocket.readyState === WebSocket.OPEN) {
            const forward: ServerMessage = {
              type: msg.type,
              remoteId: info.remoteId,
              payload: msg.payload
            };
            room.consoleSocket.send(JSON.stringify(forward));
          }
          break;
        }

        case 'rumble': {
          // Console requests rumble on phone
          const info = roomManager.getSocketInfo(ws);
          if (!info || info.role !== 'console') return;
          const room = roomManager.getRoom(info.roomCode);
          if (room && msg.remoteId) {
            const target = room.remotes.get(msg.remoteId);
            if (target && target.readyState === WebSocket.OPEN) {
              const forward: ServerMessage = {
                type: 'rumble',
                payload: msg.payload
              };
              target.send(JSON.stringify(forward));
            }
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }
      }
    } catch (err) {
      console.error('[oui-relay] Error processing WS message:', err);
    }
  });

  ws.on('close', () => {
    const disconnected = roomManager.handleDisconnect(ws);
    if (disconnected && disconnected.role === 'remote' && disconnected.remoteId) {
      const room = roomManager.getRoom(disconnected.roomCode);
      if (room && room.consoleSocket && room.consoleSocket.readyState === WebSocket.OPEN) {
        const notify: ServerMessage = {
          type: 'remote_disconnected',
          remoteId: disconnected.remoteId
        };
        room.consoleSocket.send(JSON.stringify(notify));
      }
    }
  });
});

// Periodic room cleanup
setInterval(() => {
  roomManager.cleanupStaleRooms();
}, 60000);

server.listen(PORT, '0.0.0.0', () => {
  const protocol = certs ? 'https' : 'http';
  console.log(`\n======================================================`);
  console.log(`  🎮 oui^^ Wii Remote Relay Server running on port ${PORT}`);
  console.log(`  Local:   ${protocol}://localhost:${PORT}/controller`);
  console.log(`  Network: ${protocol}://${lanIp}:${PORT}/controller`);
  console.log(`  WS:      ${certs ? 'wss' : 'ws'}://${lanIp}:${PORT}/ws`);
  console.log(`======================================================\n`);
});
