import { WebSocketServer, WebSocket as WSWebSocket } from 'ws';
import chokidar from 'chokidar';
import path from 'path';

const wss = new WebSocketServer({ port: 3001 });

// Watch the latest.jpg file for changes
const watcher = chokidar.watch(path.join(process.cwd(), 'public', 'latest.jpg'), {
  persistent: true,
  interval: 5000, // Check every 5 seconds
});

// Store connected clients
const clients = new Set<WSWebSocket>();

wss.on('connection', (ws: WSWebSocket) => {
  console.log('New client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
});

// When the file changes, notify all connected clients
watcher.on('change', (path) => {
  console.log('File changed:', path);
  const timestamp = new Date().getTime();
  const message = JSON.stringify({ type: 'imageUpdate', timestamp });
  
  clients.forEach((client) => {
    if (client.readyState === WSWebSocket.OPEN) {
      client.send(message);
    }
  });
});

console.log('WebSocket server running on port 3001'); 