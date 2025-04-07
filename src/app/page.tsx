'use client';

import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <div className={`h-[calc(100vh-2rem)] ${isZoomed ? 'overflow-auto' : 'overflow-hidden'}`}>
      <div className={`flex items-center justify-center ${isZoomed ? 'min-h-full' : 'h-full'}`}>
        <div 
          className={`relative aspect-square ${isZoomed ? 'w-[200%]' : 'w-[min(100vw,calc(100vh-2rem))]'}`}
          onClick={() => setIsZoomed(!isZoomed)}
          style={{ cursor: 'pointer' }}
        >
          <Image
            src="https://taivas.komakallio.fi/images/latest.jpg"
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
