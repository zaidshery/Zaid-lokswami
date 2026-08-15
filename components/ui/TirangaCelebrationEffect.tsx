'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

/**
 * 🇮🇳 TirangaCelebrationEffect
 * Renders an elegant, non-blocking festive particle animation celebrating Independence Day.
 */
export default function TirangaCelebrationEffect({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const colors = [
      '#FF9933', // Saffron
      '#FFA726', // Light Saffron
      '#FFFFFF', // White
      '#F0FDF4', // Pearl
      '#138808', // India Green
      '#16A34A', // Emerald Green
      '#000080', // Ashoka Navy
    ];

    const particles: Particle[] = [];
    const particleCount = Math.min(width < 768 ? 45 : 90, 100);

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * -height * 0.5,
        vx: (Math.random() - 0.5) * 2.5,
        vy: Math.random() * 2.5 + 1.8,
        size: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 4,
        opacity: Math.random() * 0.35 + 0.65,
      });
    }

    let startTime = Date.now();
    const duration = 4200; // 4.2 seconds animation

    const render = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity * (1 - progress * 0.8));
        ctx.fillStyle = p.color;

        // Draw festive petal / ribbon snippet
        ctx.beginPath();
        ctx.roundRect(-p.size / 2, -p.size / 4, p.size, p.size / 2, 2);
        ctx.fill();

        ctx.restore();
      });

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] h-full w-full"
    />
  );
}
