// Original procedurally drawn "critter" characters. 12 variants = 4 bodies x 3 accessories.

export interface CritterOpts {
  look?: number; // eye direction (radians)
  t?: number; // time (s) for idle bounce/blink
  squash?: number; // 0..1
  hurt?: boolean;
  alpha?: number;
  outline?: string;
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, ((n >> s) & 255) + amt));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function bodyPath(g: CanvasRenderingContext2D, kind: number, r: number) {
  g.beginPath();
  switch (kind) {
    case 0: // round blob
      g.ellipse(0, 0, r, r * 0.94, 0, 0, Math.PI * 2);
      break;
    case 1: { // squircle
      const s = r * 0.92, k = r * 0.45;
      g.moveTo(-s + k, -s); g.lineTo(s - k, -s); g.quadraticCurveTo(s, -s, s, -s + k);
      g.lineTo(s, s - k); g.quadraticCurveTo(s, s, s - k, s); g.lineTo(-s + k, s);
      g.quadraticCurveTo(-s, s, -s, s - k); g.lineTo(-s, -s + k); g.quadraticCurveTo(-s, -s, -s + k, -s);
      break;
    }
    case 2: // bean / drop
      g.moveTo(0, -r * 1.1);
      g.bezierCurveTo(r * 0.9, -r * 0.7, r * 1.05, r * 0.9, 0, r * 0.95);
      g.bezierCurveTo(-r * 1.05, r * 0.9, -r * 0.9, -r * 0.7, 0, -r * 1.1);
      break;
    default: { // ghost with wavy bottom
      g.moveTo(-r, r * 0.1);
      g.arc(0, r * 0.1, r, Math.PI, 0);
      const w = (r * 2) / 4;
      g.lineTo(r, r * 0.85);
      for (let i = 0; i < 4; i++) {
        const x0 = r - i * w;
        g.quadraticCurveTo(x0 - w / 2, r * (i % 2 ? 0.95 : 0.6), x0 - w, r * 0.85);
      }
      g.closePath();
    }
  }
}

export function drawCritter(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, variant: number, o: CritterOpts = {}) {
  const t = o.t ?? 0;
  const kind = variant % 4;
  const acc = Math.floor(variant / 4) % 3;
  const bob = Math.sin(t * 6 + variant) * 0.04;
  const sq = (o.squash ?? 0) * 0.25;
  g.save();
  g.translate(x, y);
  g.globalAlpha = o.alpha ?? 1;
  g.scale(1 + sq + bob, 1 - sq - bob);

  // shadow
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(0, r * 0.98, r * 0.8, r * 0.22, 0, 0, Math.PI * 2);
  g.fill();

  // accessory behind
  g.fillStyle = shade(color, -40);
  g.strokeStyle = shade(color, -90);
  g.lineWidth = r * 0.08;
  if (acc === 1) { // horns
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * r * 0.45, -r * 0.6);
      g.quadraticCurveTo(s * r * 0.95, -r * 1.15, s * r * 0.75, -r * 1.35);
      g.quadraticCurveTo(s * r * 0.55, -r * 1.0, s * r * 0.15, -r * 0.8);
      g.fillStyle = '#fff3d6';
      g.fill();
    }
  }

  // body
  const grad = g.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.15);
  grad.addColorStop(0, shade(color, 70));
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, shade(color, -70));
  bodyPath(g, kind, r);
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = r * 0.09;
  g.strokeStyle = o.outline ?? 'rgba(10,5,30,0.85)';
  g.stroke();

  // belly shine
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.beginPath();
  g.ellipse(-r * 0.35, -r * 0.45, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  g.fill();

  // accessory front
  if (acc === 0) { // antenna
    g.strokeStyle = 'rgba(10,5,30,0.85)';
    g.lineWidth = r * 0.07;
    g.beginPath();
    g.moveTo(0, -r * 0.9);
    g.quadraticCurveTo(r * 0.25, -r * 1.3, r * 0.1, -r * 1.45);
    g.stroke();
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.arc(r * 0.1, -r * 1.45, r * 0.16, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (acc === 2) { // leaf sprout
    g.fillStyle = '#5dfc8d';
    g.strokeStyle = 'rgba(10,5,30,0.85)';
    g.lineWidth = r * 0.06;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(s * r * 0.22, -r * 1.05, r * 0.24, r * 0.11, s * -0.6, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  // eyes
  const look = o.look ?? Math.PI / 2;
  const lx = Math.cos(look) * r * 0.08, ly = Math.sin(look) * r * 0.08;
  const blink = (Math.floor(t * 10 + variant * 7) % 37) === 0;
  for (const s of [-1, 1]) {
    const ex = s * r * 0.33, ey = -r * 0.12;
    if (o.hurt) {
      g.strokeStyle = '#120a2a';
      g.lineWidth = r * 0.09;
      g.beginPath();
      g.moveTo(ex - r * 0.12, ey - r * 0.12); g.lineTo(ex + r * 0.12, ey + r * 0.12);
      g.moveTo(ex + r * 0.12, ey - r * 0.12); g.lineTo(ex - r * 0.12, ey + r * 0.12);
      g.stroke();
      continue;
    }
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(ex, ey, r * 0.22, blink ? r * 0.03 : r * 0.26, 0, 0, Math.PI * 2);
    g.fill();
    if (!blink) {
      g.fillStyle = '#120a2a';
      g.beginPath();
      g.arc(ex + lx, ey + ly, r * 0.11, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(ex + lx - r * 0.04, ey + ly - r * 0.04, r * 0.035, 0, Math.PI * 2);
      g.fill();
    }
  }
  // mouth
  g.strokeStyle = '#120a2a';
  g.lineWidth = r * 0.08;
  g.lineCap = 'round';
  g.beginPath();
  if (o.hurt) g.arc(0, r * 0.42, r * 0.16, Math.PI * 1.1, Math.PI * 1.9);
  else g.arc(0, r * 0.2, r * 0.2, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();
  // cheeks
  g.fillStyle = 'rgba(255,120,160,0.45)';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * r * 0.6, r * 0.18, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

export function nameTag(g: CanvasRenderingContext2D, x: number, y: number, name: string, color: string, size = 18) {
  g.save();
  g.font = `700 ${size}px Rubik, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const w = g.measureText(name).width + size;
  g.fillStyle = 'rgba(10,5,30,0.7)';
  g.beginPath();
  g.roundRect(x - w / 2, y - size * 0.75, w, size * 1.5, size * 0.75);
  g.fill();
  g.fillStyle = color;
  g.fillText(name, x, y + 1);
  g.restore();
}
