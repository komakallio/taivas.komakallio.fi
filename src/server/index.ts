import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket as WSWebSocket } from 'ws';
import chokidar from 'chokidar';
import path from 'path';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Get the image path based on environment
const getImagePath = () => {
  if (dev) {
    return path.join(process.cwd(), 'public', 'latest.jpg');
  } else {
    return '/var/www/allsky/images/latest.jpg';
  }
};

// Initialize Next.js
app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
  });

  // Watch the latest.jpg file for changes
  const imagePath = getImagePath();
  console.log(`Watching image file: ${imagePath}`);
  
  const watcher = chokidar.watch(imagePath, {
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

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
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

  // Start the server
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Environment: ${dev ? 'development' : 'production'}`);
  });
}); 