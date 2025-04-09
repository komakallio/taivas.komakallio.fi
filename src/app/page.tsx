'use client';

import Image from "next/image";
import { useState, useEffect } from "react";

export default function Home() {
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageTimestamp, setImageTimestamp] = useState(Date.now());
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    const maxReconnectAttempts = 5;
    let reconnectAttempts = 0;

    const connectWebSocket = () => {
      if (ws) {
        ws.close();
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'imageUpdate') {
          setLastUpdate(data.timestamp);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        
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
      if (document.visibilityState === 'visible' && !connected) {
        console.log('Page became visible, reconnecting WebSocket');
        reconnectAttempts = 0; // Reset reconnect attempts
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        connectWebSocket();
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
