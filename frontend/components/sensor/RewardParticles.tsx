/**
 * Reward particles component for SENSOR token animations
 * Creates subtle sparkles/confetti effects
 */

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  opacity: number;
}

interface RewardParticlesProps {
  /** Trigger animation when this increments */
  trigger: number;
  /** Container element to animate within */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Duration of animation in ms */
  duration?: number;
  /** Maximum number of particles */
  maxParticles?: number;
}

export function RewardParticles({ 
  trigger, 
  containerRef, 
  duration = 900,
  maxParticles = 12 
}: RewardParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const particlesRef = useRef<Particle[]>([]);
  const lastTriggerRef = useRef(trigger);

  const colors = [
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500  
    '#8b5cf6', // violet-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
  ];

  const createParticle = (centerX: number, centerY: number): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 3 + 1;
    
    return {
      x: centerX + (Math.random() - 0.5) * 20,
      y: centerY + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - Math.random() * 2,
      life: duration,
      maxLife: duration,
      size: Math.random() * 3 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 1
    };
  };

  const updateParticle = (particle: Particle, deltaTime: number): boolean => {
    particle.x += particle.vx * deltaTime;
    particle.y += particle.vy * deltaTime;
    particle.vy += 0.01 * deltaTime; // gravity
    particle.life -= deltaTime;
    particle.opacity = Math.max(0, particle.life / particle.maxLife);
    
    return particle.life > 0;
  };

  const drawParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    ctx.save();
    ctx.globalAlpha = particle.opacity;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = particle.size * 2;
    
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Add sparkle effect
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = particle.opacity * 0.8;
    
    const sparkleSize = particle.size * 1.5;
    ctx.beginPath();
    ctx.moveTo(particle.x - sparkleSize, particle.y);
    ctx.lineTo(particle.x + sparkleSize, particle.y);
    ctx.moveTo(particle.x, particle.y - sparkleSize);
    ctx.lineTo(particle.x, particle.y + sparkleSize);
    ctx.stroke();
    
    ctx.restore();
  };

  const animate = (currentTime: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const deltaTime = 16; // ~60fps
    particlesRef.current = particlesRef.current.filter(particle => {
      const alive = updateParticle(particle, deltaTime);
      if (alive) {
        drawParticle(ctx, particle);
      }
      return alive;
    });

    if (particlesRef.current.length > 0) {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  const startAnimation = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate center point relative to canvas
    const centerX = (rect.left + rect.width / 2) - canvasRect.left;
    const centerY = (rect.top + rect.height / 2) - canvasRect.top;

    // Create particles
    const newParticles = Array.from({ length: maxParticles }, () => 
      createParticle(centerX, centerY)
    );
    
    particlesRef.current = [...particlesRef.current, ...newParticles];

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (trigger > lastTriggerRef.current) {
      lastTriggerRef.current = trigger;
      startAnimation();
    }
  }, [trigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      style={{ 
        mixBlendMode: 'screen',
        filter: 'blur(0.5px)'
      }}
    />
  );
}
