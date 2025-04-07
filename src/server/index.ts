import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Function to get the correct image path based on environment
function getImagePath() {
  if (dev) {
    return path.join(process.cwd(), 'public', 'latest.jpg');
  }
  return '/var/www/allsky/images/latest.jpg';
}

// Function to get the correct directory path based on environment
function getImageDir() {
  if (dev) {
    return path.join(process.cwd(), 'public');
  }
  return '/var/www/allsky/images';
}

// Initialize Next.js
app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    const { pathname } = parsedUrl;

    // Handle static image serving
    if (pathname?.startsWith('/images/')) {
      const filename = pathname.split('/').pop();
      const imagePath = path.join(getImageDir(), filename || '');
      console.log(`Attempting to serve image from: ${imagePath}`);
      
      // Check if file exists
      fs.access(imagePath, fs.constants.F_OK, (err) => {
        if (err) {
          console.error(`File not found: ${imagePath}`);
          console.error(`Error details:`, err);
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        // Get file stats for content length
        fs.stat(imagePath, (err, stats) => {
          if (err) {
            console.error(`Error getting file stats: ${err}`);
            res.writeHead(500);
            res.end('Internal Server Error');
            return;
          }

          // Set appropriate headers
          res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': stats.size,
            'Cache-Control': 'no-cache'
          });

          // Stream the file
          const stream = fs.createReadStream(imagePath);
          stream.on('error', (err) => {
            console.error(`Error streaming file: ${err}`);
            res.end();
          });
          stream.pipe(res);
        });
      });
      return;
    }

    // Handle Next.js requests
    handle(req, res, parsedUrl);
  });

  // Create WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('New client connected');
    clients.add(ws);

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      clients.delete(ws);
    });
  });

  // Watch for file changes
  const imagePath = getImagePath();
  console.log(`Watching for changes in: ${imagePath}`);
  console.log(`Development mode: ${dev}`);
  console.log(`Image directory: ${getImageDir()}`);

  const watcher = chokidar.watch(imagePath, {
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  watcher.on('change', (path) => {
    console.log(`File changed: ${path}`);
    const timestamp = Date.now();
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'imageUpdate', timestamp }));
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