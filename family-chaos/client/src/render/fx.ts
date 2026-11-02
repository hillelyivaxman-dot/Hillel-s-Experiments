// Lightweight particle / screen-shake / floating-text system for game screens.
import { prefs } from '../prefs';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; g: number }
interface Floater { x: number; y: number; text: string; color: string; life: number; size: number }

export class FX {
  parts: Particle[] = [];
  floats: Floater[] = [];
  shake = 0;
  flash = 0;
  flashColor = '#fff';

  burst(x: number, y: number, color: string, n = 16, speed = 260, size = 6, gravity = 0) {
    const k = prefs.reducedMotion ? 0.3 : 1;
    for (let i = 0; i < Math.ceil(n * k); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const life = 0.4 + Math.random() * 0.5;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, size: size * (0.5 + Math.random()), color, g: gravity });
    }
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  }

  text(x: number, y: number, text: string, color = '#fff', size = 34) {
    this.floats.push({ x, y, text, color, life: 1.2, size });
  }

  kick(amount: number) {
    if (!prefs.reducedMotion) this.shake = Math.min(24, this.shake + amount);
  }

  blink(color: string, amount = 0.6) {
    this.flashColor = color;
    this.flash = prefs.reducedMotion ? amount * 0.3 : amount;
  }

  update(dt: number) {
    for (const p of this.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.94; p.vy = p.vy * 0.94 + p.g * dt;
      p.life -= dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floats) { f.y -= 60 * dt; f.life -= dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    this.shake *= Math.pow(0.002, dt);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }

  /** Draw in world space. */
  draw(g: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size * (p.life / p.max + 0.3), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const f of this.floats) {
      g.globalAlpha = Math.min(1, f.life * 2);
      g.font = `900 ${f.size}px Rubik, system-ui, sans-serif`;
      g.lineWidth = 6;
      g.strokeStyle = 'rgba(10,5,30,0.9)';
      g.strokeText(f.text, f.x, f.y);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;
  }
}
