'use client';

import Image from "next/image";
import { useState, useEffect } from "react";

export default function Home() {
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageTimestamp, setImageTimestamp] = useState(Date.now());

  useEffect(() => {
    // Use the same host and port as the current page
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'imageUpdate') {
        setImageTimestamp(data.timestamp);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      ws.close();
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
          <Image
            src={`/images/latest.jpg?t=${imageTimestamp}`}
            alt="Latest image from Komakallio Observatory"
            fill
            sizes="(max-width: 1200px) 90vw, 1200px"
            className="object-contain"
            priority
          />
        </div>
      </div>
    </div>
  );
}
