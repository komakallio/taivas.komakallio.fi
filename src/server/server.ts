import { createServer, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import logger from './logger';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

logger.info('Starting server', {
  dev,
  environment: process.env.NODE_ENV,
  currentWorkingDirectory: process.cwd(),
  imageDirectory: getImageDir(),
  imagePath: getImagePath()
});

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

// Function to serve directory index or static files
function serveDirectory(basePath: string, urlPath: string, res: ServerResponse) {
  const fullPath = path.join(basePath, urlPath);
  logger.debug(`Attempting to serve from: ${fullPath}`);

  // Check if path exists
  fs.stat(fullPath, (err, stats) => {
    if (err) {
      logger.error(`Path not found: ${fullPath}`, { error: err });
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    if (stats.isDirectory()) {
      // Serve directory index
      fs.readdir(fullPath, (err, files) => {
        if (err) {
          logger.error(`Error reading directory: ${err}`);
          res.writeHead(500);
          res.end('Internal Server Error');
          return;
        }

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Directory Index</title>
              <style>
                body { font-family: sans-serif; margin: 2em; }
                a { color: #0066cc; text-decoration: none; }
                a:hover { text-decoration: underline; }
                li { margin: 0.5em 0; }
              </style>
            </head>
            <body>
              <h1>Directory Index</h1>
              <ul>
                ${files.map(file => {
                  const isDir = fs.statSync(path.join(fullPath, file)).isDirectory();
                  return `<li><a href="${file}${isDir ? '/' : ''}">${file}</a></li>`;
                }).join('\n')}
              </ul>
            </body>
          </html>
        `;

        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Content-Length': Buffer.byteLength(html)
        });
        res.end(html);
      });
    } else {
      // Get file extension for Content-Type
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json'
      }[ext] || 'application/octet-stream';

      // Handle range requests
      const range = res.req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = (end - start) + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Last-Modified': stats.mtime.toUTCString()
        });

        const stream = fs.createReadStream(fullPath, { start, end });
        stream.on('error', (err) => {
          logger.error(`Error streaming file: ${err}`);
          res.end();
        });
        stream.pipe(res);
      } else {
        // Regular file serving
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size,
          'Last-Modified': stats.mtime.toUTCString(),
          'Accept-Ranges': 'bytes'
        });

        const stream = fs.createReadStream(fullPath);
        stream.on('error', (err) => {
          logger.error(`Error streaming file: ${err}`);
          res.end();
        });
        stream.pipe(res);
      }
    }
  });
}

function serveImage(pathname: string, res: ServerResponse) {
  const filename = pathname.split('/').pop();
  const imagePath = path.join(getImageDir(), filename || '');
  const offlinePath = path.join(process.cwd(), 'public', 'offline.jpg');
  logger.debug(`Attempting to serve image from: ${imagePath}`);
  
  // Check if file exists
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      logger.error(`File not found: ${imagePath}`, { error: err });
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    // Get file stats for content length and modification time
    fs.stat(imagePath, (err, stats) => {
      if (err) {
        logger.error(`Error getting file stats: ${err}`);
        res.writeHead(500);
        res.end('Internal Server Error');
        return;
      }

      // Check if image is too old (10 minutes)
      const now = new Date();
      const imageAge = now.getTime() - stats.mtime.getTime();
      const maxAge = 10 * 60 * 1000; // 10 minutes in milliseconds

      if (imageAge > maxAge) {
        logger.info(`Image is too old (${imageAge}ms), serving offline image`);
        // Serve offline image
        fs.stat(offlinePath, (err, offlineStats) => {
          if (err) {
            logger.error(`Offline image not found: ${offlinePath}`, { error: err });
            res.writeHead(404);
            res.end('Not Found');
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': offlineStats.size,
            'Cache-Control': 'no-cache'
          });

          const stream = fs.createReadStream(offlinePath);
          stream.on('error', (err) => {
            logger.error(`Error streaming offline image: ${err}`);
            res.end();
          });
          stream.pipe(res);
        });
        return;
      }

      // Check If-Modified-Since header
      const ifModifiedSince = res.req.headers['if-modified-since'];
      if (ifModifiedSince) {
        const lastModified = new Date(ifModifiedSince).getTime();
        const fileModified = stats.mtime.getTime();
        
        // If file hasn't been modified, return 304
        if (fileModified <= lastModified) {
          logger.debug(`File not modified since ${ifModifiedSince}`);
          res.writeHead(304);
          res.end();
          return;
        }
      }

      // Set appropriate headers
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': stats.size,
        'Last-Modified': stats.mtime.toUTCString(),
        'Cache-Control': 'no-cache'
      });

      // Stream the file
      const stream = fs.createReadStream(imagePath);
      stream.on('error', (err) => {
        logger.error(`Error streaming file: ${err}`);
        res.end();
      });
      stream.pipe(res);
    });
  });
}

// Initialize Next.js
app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    const { pathname } = parsedUrl;

    // Log all incoming requests
    logger.info(`Incoming request: ${req.method} ${pathname}`);

    // Handle static file serving
    if (pathname?.startsWith('/images/')) {
      return serveImage(pathname, res);
    }

    if (pathname?.endsWith('/videos') || pathname?.endsWith('/keograms')) {
      res.writeHead(301, {
        'Location': pathname + '/'
      });
      res.end();
      return;
    }

    // Handle videos directory
    if (pathname?.startsWith('/videos/')) {
      return serveDirectory('/var/www/allsky/videos', pathname.replace('/videos/', ''), res);
    }

    // Handle keograms directory
    if (pathname?.startsWith('/keograms/')) {
      return serveDirectory('/var/www/allsky/keograms', pathname.replace('/keograms/', ''), res);
    }

    // Handle Next.js requests
    handle(req, res, parsedUrl);
  });

  // Create WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    logger.info('New client connected');
    clients.add(ws);

    ws.on('error', (error: Error) => {
      logger.error('WebSocket error', { error });
      clients.delete(ws);
    });

    ws.on('close', () => {
      logger.info('Client disconnected');
      clients.delete(ws);
    });
  });

  // Watch for file changes
  const imagePath = getImagePath();
  logger.info('Starting file watcher', {
    imagePath,
    developmentMode: dev,
    imageDirectory: getImageDir(),
    currentWorkingDirectory: process.cwd(),
    environment: process.env.NODE_ENV
  });

  const watcher = chokidar.watch(imagePath, {
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  watcher.on('change', (path) => {
    logger.info(`File changed: ${path}`);
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
    logger.info(`Server ready on http://localhost:${port}`, {
      environment: dev ? 'development' : 'production'
    });
  });
}); 