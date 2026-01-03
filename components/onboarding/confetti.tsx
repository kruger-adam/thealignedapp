'use client';

import { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

const COLORS = [
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#f472b6', // pink
  '#facc15', // yellow
  '#34d399', // emerald
  '#60a5fa', // blue
  '#fb923c', // orange
];

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 2,
    size: 8 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));
}

interface ConfettiProps {
  isActive: boolean;
  onComplete?: () => void;
}

export function Confetti({ isActive, onComplete }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (isActive) {
      setPieces(generateConfetti(60));
      
      // Clean up after animation
      const timer = setTimeout(() => {
        setPieces([]);
        onComplete?.();
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);

  if (!isActive && pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.x}%`,
            top: '-20px',
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        >
          <div
            className="animate-confetti-spin"
            style={{
              width: piece.size,
              height: piece.size * 0.6,
              backgroundColor: piece.color,
              transform: `rotate(${piece.rotation}deg)`,
              borderRadius: '2px',
            }}
          />
        </div>
      ))}
    </div>
  );
}

