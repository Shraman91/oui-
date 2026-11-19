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

const HTTP_PORT = Number.parseInt(process.env.HTTP_PORT || '8080', 10);
const HTTPS_PORT = Number.parseInt(process.env.PORT || '8443', 10);

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

// 1. Static HTTP/HTTPS Request Handler
function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  // Enable CORS & Mobile Motion Permissions Policy
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Permissions-Policy', 'accelerometer=*, gyroscope=*, magnetometer=*');
  res.setHeader('Feature-Policy', 'accelerometer *; gyroscope *; magnetometer *');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const hostHeader = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url || '/', `http://${hostHeader}`);
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
        res.end(
          JSON.stringify({
            status: 'ok',
            service: 'oui-relay-server',
            lanIp,
            httpPort: HTTP_PORT,
            httpsPort: HTTPS_PORT
          })
        );
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

// Plain HTTP Server (Port 8080) - Ideal for console WebSocket on http://localhost:5173
const httpServer = http.createServer(handleHttpRequest);
const wssHttp = new WebSocketServer({ server: httpServer, path: '/ws' });

// HTTPS Server (Port 8443) - For phone motion sensors (iOS Safari / Android Chrome)
let httpsServer: https.Server | null = null;
let wssHttps: WebSocketServer | null = null;

if (certs) {
  httpsServer = https.createServer({ key: certs.key, cert: certs.cert }, handleHttpRequest);
  wssHttps = new WebSocketServer({ server: httpsServer, path: '/ws' });
} else {
  console.warn('[oui-relay] No certs found in certs/. Running HTTP only.');
}

// 3. Shared WebSocket connection logic
function setupWebSocketHandler(wss: WebSocketServer): void {
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
              port: HTTPS_PORT,
              httpPort: HTTP_PORT,
              httpsPort: HTTPS_PORT
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
}

// Attach handlers to both WS servers
setupWebSocketHandler(wssHttp);
if (wssHttps) {
  setupWebSocketHandler(wssHttps);
}

// Periodic room cleanup
setInterval(() => {
  roomManager.cleanupStaleRooms();
}, 60000);

// Start listeners
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`  [HTTP] Relay running on http://${lanIp}:${HTTP_PORT} (WS on /ws)`);
});

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`  [HTTPS] Relay running on https://${lanIp}:${HTTPS_PORT} (WSS on /ws)`);
  });
}

console.log(`\n======================================================`);
console.log(`  🎮 oui^^ Wii Remote Dual Relay Server Ready`);
console.log(`  Console WS:   ws://localhost:${HTTP_PORT}/ws`);
console.log(`  Mobile HTTPS: https://${lanIp}:${HTTPS_PORT}/controller`);
console.log(`  Mobile HTTP:  http://${lanIp}:${HTTP_PORT}/controller`);
console.log(`======================================================\n`);
