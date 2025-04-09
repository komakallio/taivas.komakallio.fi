'use client';

import { useState, useEffect } from "react";

let ws: WebSocket | null = null;

export default function Home() {
  const [isZoomed, setIsZoomed] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    const maxReconnectAttempts = 5;
    let reconnectAttempts = 0;
    const heartbeatIntervalMs = 30000; // 30 seconds

    const connectWebSocket = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        return;
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts = 0;
        
        // Start heartbeat
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        heartbeatInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, heartbeatIntervalMs);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'imageUpdate') {
          setLastUpdate(data.timestamp);
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        
        // Clear heartbeat interval
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        
        // Only attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
          reconnectTimeout = setTimeout(connectWebSocket, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    // Initial connection
    connectWebSocket();

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Force immediate image refresh
        setLastUpdate(Date.now());
        
        // Reconnect WebSocket if disconnected
        if (!connected) {
          reconnectAttempts = 0; // Reset reconnect attempts
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
          }
          connectWebSocket();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className={`h-[calc(100vh-2rem)] ${isZoomed ? 'overflow-auto' : 'overflow-hidden'}`}>
      <div className={`flex items-center justify-center ${isZoomed ? 'min-h-full' : 'h-full'}`}>
        <div 
          className={`relative aspect-square ${isZoomed ? 'w-[200%]' : 'w-[min(100vw,calc(100vh-2rem))]'}`}
          onClick={() => setIsZoomed(!isZoomed)}
          style={{ cursor: 'pointer' }}
        >
          <img
            src={`/images/latest.jpg?t=${lastUpdate}`}
            alt="Latest image from Komakallio Observatory"
            className="object-contain w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
