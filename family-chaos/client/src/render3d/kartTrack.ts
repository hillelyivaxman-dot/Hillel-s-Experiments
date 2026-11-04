// 3D Kart Chaos world built from the same centre-line the server drives on (shared/tracks.ts): road, curbs, sand, tyre walls,
// tunnels, overpasses, start gantry, grandstand, trees, item boxes and boost pads. Pure Three.js, no external assets.
import * as THREE from 'three';
import { getTrack, pointAt, TRACK_WIDTH, trackBoxes, trackPads, type Track } from '../../../shared/tracks';

const HW = TRACK_WIDTH / 2; // asphalt half width
const WALL = HW + 48; // distance of the tyre barrier from the centre line (matches the server's K.WALL)

export function rngFrom(seed: number) { let s = seed * 9301 + 49297; return () => { s = (s * 16807) % 2147483647; return (s & 0xfffffff) / 0xfffffff; }; }

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

/** Ribbon along the centre line between lateral offsets [o0, o1] at height y. u = across (0..1), v = distance / vScale. */
function ribbon(tr: Track, o0: number, o1: number, y: number, vScale: number, step = 1): THREE.BufferGeometry {
  const n = tr.pts.length, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const count = Math.ceil(n / step);
  for (let k = 0; k <= count; k++) {
    const i = (k * step) % n, a = tr.pts[(i - 1 + n) % n], b = tr.pts[(i + 1) % n], p = tr.pts[i];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
    const v = (k === count ? tr.length : tr.cum[i]) / vScale;
    pos.push(p.x + nx * o0, y, p.y + ny * o0, p.x + nx * o1, y, p.y + ny * o1);
    uv.push(0, v, 1, v);
    if (k < count) { const q = k * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** Vertical wall ribbon (for tyre barriers and tunnel sides) between heights y0..y1 at lateral offset o. */
function wallRibbon(tr: Track, o: number, y0: number, y1: number, vScale: number, from = 0, to = 1): THREE.BufferGeometry {
  const n = tr.pts.length, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const i0 = Math.floor(from * n), i1 = Math.floor(to * n);
  let k = 0;
  for (let i = i0; i <= i1; i++, k++) {
    const m = i % n, a = tr.pts[(m - 1 + n) % n], b = tr.pts[(m + 1) % n], p = tr.pts[m];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
    const v = tr.cum[m] / vScale;
    pos.push(p.x + nx * o, y0, p.y + ny * o, p.x + nx * o, y1, p.y + ny * o); uv.push(0, v, 1, v);
    if (i < i1) { const q = k * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export const TUNNELS: [number, number][][] = [[[0.40, 0.49]], [[0.30, 0.38], [0.72, 0.79]], [[0.34, 0.42], [0.86, 0.94]]];
export const BRIDGES: number[][] = [[0.20, 0.72], [0.55], [0.10, 0.60]];

export interface TrackWorld {
  group: THREE.Group; boxMeshes: THREE.Mesh[]; padGlow: THREE.Mesh[]; update(t: number, boxFlags: string): void; dispose(): void;
}

export function buildTrackWorld(trackId: number, quality: 'low' | 'high'): TrackWorld {
  const tr = getTrack(trackId), group = new THREE.Group(), rand = rngFrom(trackId + 5);
  const disposables: { dispose(): void }[] = [];
  const mat = <T extends THREE.Material>(m: T) => { disposables.push(m); return m; };
  const geo = <T extends THREE.BufferGeometry>(g: T) => { disposables.push(g); return g; };

  // ground (grass) + sand run-off + asphalt + curbs
  const grassTex = canvasTex(256, 256, (g) => { g.fillStyle = '#3f9d4f'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${20 + rand() * 40},${120 + rand() * 60},${40 + rand() * 40},.35)`; g.fillRect(rand() * 256, rand() * 256, 2 + rand() * 4, 6 + rand() * 8); } }, [60, 40]);
  const ground = new THREE.Mesh(geo(new THREE.PlaneGeometry(9000, 6000)), mat(new THREE.MeshLambertMaterial({ map: grassTex })));
  ground.rotation.x = -Math.PI / 2; ground.position.set(800, -1, 450); group.add(ground);
  const sandTex = canvasTex(128, 128, (g) => { g.fillStyle = '#dcbf85'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(150,110,50,${rand() * 0.25})`; g.fillRect(rand() * 128, rand() * 128, 2, 2); } }, [1, 1]);
  sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  const sand = new THREE.Mesh(ribbon(tr, -WALL, WALL, -0.2, 120, 2), mat(new THREE.MeshLambertMaterial({ map: sandTex, side: THREE.DoubleSide }))); disposables.push(sand.geometry); group.add(sand);
  const roadTex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#3b3d4d'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},.05)`; g.fillRect(rand() * 256, rand() * 256, 2, 2); }
    g.fillStyle = '#f4f4f4'; g.fillRect(8, 0, 8, 256); g.fillRect(240, 0, 8, 256); // edge lines
    g.fillStyle = '#ffd23f'; for (let y = 0; y < 256; y += 64) g.fillRect(124, y, 8, 36); // dashed centre
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(70, 0, 22, 256); g.fillRect(164, 0, 22, 256); // worn lanes
  });
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const road = new THREE.Mesh(ribbon(tr, -HW, HW, 0.3, 190, 1), mat(new THREE.MeshLambertMaterial({ map: roadTex, side: THREE.DoubleSide }))); disposables.push(road.geometry); group.add(road);
  const curbTex = canvasTex(32, 64, (g) => { g.fillStyle = '#ff4d6d'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#ffffff'; g.fillRect(0, 32, 32, 32); });
  curbTex.wrapS = curbTex.wrapT = THREE.RepeatWrapping;
  for (const [a, b] of [[HW, HW + 14], [-HW - 14, -HW]]) { const c = new THREE.Mesh(ribbon(tr, a, b, 0.5, 28, 1), mat(new THREE.MeshLambertMaterial({ map: curbTex, side: THREE.DoubleSide }))); disposables.push(c.geometry); group.add(c); }

  // tyre barriers
  const tyreTex = canvasTex(64, 64, (g) => { g.fillStyle = '#23232f'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#ff4d6d'; g.fillRect(0, 0, 64, 12); g.fillStyle = '#fff'; g.fillRect(0, 28, 64, 8); g.fillStyle = '#4a4a5a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(8 + i * 16, 50, 7, 0, 7); g.fill(); } });
  tyreTex.wrapS = tyreTex.wrapT = THREE.RepeatWrapping;
  for (const side of [1, -1]) { const w = new THREE.Mesh(wallRibbon(tr, side * WALL, 0, 20, 64), mat(new THREE.MeshLambertMaterial({ map: tyreTex, side: THREE.DoubleSide }))); disposables.push(w.geometry); group.add(w); }

  // tunnels: dark shell with a ceiling light strip
  const tunnelMat = mat(new THREE.MeshLambertMaterial({ color: 0x4a4d63, side: THREE.DoubleSide }));
  const lightMat = mat(new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  for (const [f0, f1] of TUNNELS[trackId % TUNNELS.length] ?? []) {
    for (const side of [1, -1]) { const w = new THREE.Mesh(wallRibbon(tr, side * (HW + 26), 0, 70, 90, f0, f1), tunnelMat); disposables.push(w.geometry); group.add(w); }
    const sub: Track = tr; // ceiling = ribbon at height 70 limited to the section
    const n = tr.pts.length, i0 = Math.floor(f0 * n), i1 = Math.floor(f1 * n), pos: number[] = [], idx: number[] = [];
    let k = 0;
    for (let i = i0; i <= i1; i++, k++) { const m = i % n, a = sub.pts[(m - 1 + n) % n], b = sub.pts[(m + 1) % n], p = sub.pts[m]; const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l; pos.push(p.x + nx * (HW + 26), 70, p.y + ny * (HW + 26), p.x - nx * (HW + 26), 70, p.y - ny * (HW + 26)); if (i < i1) { const q = k * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setIndex(idx); cg.computeVertexNormals(); disposables.push(cg);
    group.add(new THREE.Mesh(cg, tunnelMat));
    for (let i = i0; i <= i1; i += 5) { const m = i % n, p = sub.pts[m], b = sub.pts[(m + 1) % n]; const l = new THREE.Mesh(geo(new THREE.BoxGeometry(5, 2, 40)), lightMat); l.position.set(p.x, 68, p.y); l.rotation.y = -Math.atan2(b.y - p.y, b.x - p.x) + Math.PI / 2; group.add(l); }
    // portal arch at the entrance
    const p0 = pointAt(tr, f0), arch = new THREE.Mesh(geo(new THREE.BoxGeometry(10, 12, (HW + 30) * 2)), mat(new THREE.MeshLambertMaterial({ color: 0xff8c42 })));
    arch.position.set(p0.x, 74, p0.y); arch.rotation.y = -Math.atan2(p0.ty, p0.tx); group.add(arch);
  }
  // overpasses: a bridge deck over the road with pillars (cars drive under it)
  for (const f of BRIDGES[trackId % BRIDGES.length] ?? []) {
    const p = pointAt(tr, f), ang = -Math.atan2(p.ty, p.tx);
    const deck = new THREE.Mesh(geo(new THREE.BoxGeometry(34, 8, (HW + 40) * 2)), mat(new THREE.MeshLambertMaterial({ color: 0x9aa3b8 }))); deck.position.set(p.x, 62, p.y); deck.rotation.y = ang; group.add(deck);
    const rail = new THREE.Mesh(geo(new THREE.BoxGeometry(34, 8, (HW + 40) * 2)), mat(new THREE.MeshLambertMaterial({ color: 0xff4d6d }))); rail.position.set(p.x, 70, p.y); rail.scale.set(1, 0.4, 1.0); rail.rotation.y = ang; group.add(rail);
    for (const s of [1, -1]) { const pil = new THREE.Mesh(geo(new THREE.BoxGeometry(24, 62, 16)), mat(new THREE.MeshLambertMaterial({ color: 0x7c8296 }))); pil.position.set(p.x - p.ty * s * (HW + 30), 31, p.y + p.tx * s * (HW + 30)); pil.rotation.y = ang; group.add(pil); }
  }
  // start / finish: checkered line + gantry with a banner
  const p0 = pointAt(tr, 0), a0 = Math.atan2(p0.ty, p0.tx);
  const chk = canvasTex(128, 64, (g) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#111'; g.fillRect(i * 8, j * 8, 8, 8); } });
  const line = new THREE.Mesh(geo(new THREE.PlaneGeometry(26, HW * 2)), mat(new THREE.MeshBasicMaterial({ map: chk }))); line.rotation.set(-Math.PI / 2, 0, 0); line.rotation.z = a0 - Math.PI / 2 * 0; line.position.set(p0.x, 0.8, p0.y);
  line.rotation.order = 'YXZ'; line.rotation.set(-Math.PI / 2, 0, 0); line.rotation.y = -a0; line.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), 0); group.add(line);
  const banner = canvasTex(512, 96, (g) => { g.fillStyle = '#1b0f45'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#ffd23f'; g.font = '900 64px Rubik, Arial Black, sans-serif'; g.textAlign = 'center'; g.fillText('START / FINISH', 256, 70); });
  const gantry = new THREE.Group(); gantry.position.set(p0.x, 0, p0.y); gantry.rotation.y = -a0;
  for (const s of [1, -1]) { const pil = new THREE.Mesh(geo(new THREE.BoxGeometry(8, 90, 8)), mat(new THREE.MeshLambertMaterial({ color: 0x8f96ad }))); pil.position.set(0, 45, s * (WALL - 6)); gantry.add(pil); }
  const beam = new THREE.Mesh(geo(new THREE.BoxGeometry(10, 26, (WALL - 6) * 2)), mat(new THREE.MeshBasicMaterial({ map: banner }))); beam.position.set(0, 86, 0); gantry.add(beam); group.add(gantry);
  // grandstand beside the start straight
  const stand = new THREE.Group(); stand.position.set(p0.x - p0.ty * (WALL + 70), 0, p0.y + p0.tx * (WALL + 70)); stand.rotation.y = -a0;
  const crowd = canvasTex(256, 64, (g) => { g.fillStyle = '#2b2f4a'; g.fillRect(0, 0, 256, 64); for (let i = 0; i < 90; i++) { g.fillStyle = ['#ff4d6d', '#3ec1ff', '#ffd23f', '#5dfc8d', '#b26bff'][i % 5]; g.beginPath(); g.arc(6 + (i * 11) % 250, 10 + Math.floor(i / 22) * 14 + (i % 3), 4, 0, 7); g.fill(); } });
  for (let r = 0; r < 4; r++) { const step = new THREE.Mesh(geo(new THREE.BoxGeometry(160, 14, 16)), mat(new THREE.MeshLambertMaterial({ map: crowd }))); step.position.set(0, 7 + r * 14, r * 16); stand.add(step); }
  group.add(stand);
  // trees (instanced) and cheering banners
  const nTrees = quality === 'high' ? 110 : 40;
  const trunk = new THREE.InstancedMesh(geo(new THREE.CylinderGeometry(3, 4, 22, 5)), mat(new THREE.MeshLambertMaterial({ color: 0x7a4b24 })), nTrees);
  const leaves = new THREE.InstancedMesh(geo(new THREE.ConeGeometry(17, 46, 6)), mat(new THREE.MeshLambertMaterial({ color: 0x2f8f46 })), nTrees);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (let i = 0; i < nTrees; i++) {
    const f = rand(), p = pointAt(tr, f), side = rand() > 0.5 ? 1 : -1, off = side * (WALL + 40 + rand() * 260), s = 0.8 + rand() * 0.8;
    const x = p.x - p.ty * off, z = p.y + p.tx * off;
    sc.set(s, s, s); m4.compose(new THREE.Vector3(x, 11 * s, z), q, sc); trunk.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 38 * s, z), q, sc); leaves.setMatrixAt(i, m4);
  }
  group.add(trunk, leaves);

  // item boxes and boost pads
  const qTex = canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#7c3aed'; g.font = '900 54px Rubik, Arial Black, sans-serif'; g.textAlign = 'center'; g.fillText('?', 32, 52); });
  const boxMeshes: THREE.Mesh[] = trackBoxes(tr).map((b) => {
    const m = new THREE.Mesh(geo(new THREE.BoxGeometry(18, 18, 18)), mat(new THREE.MeshBasicMaterial({ map: qTex, color: new THREE.Color().setHSL((b.id * 0.13) % 1, 0.8, 0.65) })));
    m.position.set(b.x, 16, b.y); group.add(m); return m;
  });
  const padTex = canvasTex(128, 128, (g) => { g.fillStyle = 'rgba(255,210,63,.18)'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#ffd23f'; g.lineWidth = 12; g.lineCap = 'round'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(24, 20 + k * 36); g.lineTo(64, 4 + k * 36 + 28); g.lineTo(104, 20 + k * 36); g.stroke(); } });
  const padGlow: THREE.Mesh[] = trackPads(tr).map((p) => {
    const m = new THREE.Mesh(geo(new THREE.PlaneGeometry(80, 80)), mat(new THREE.MeshBasicMaterial({ map: padTex, transparent: true, depthWrite: false })));
    m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2; m.rotation.y = -p.a + Math.PI; m.position.set(p.x, 0.9, p.y); group.add(m); return m;
  });
  return {
    group, boxMeshes, padGlow,
    update(t, flags) { boxMeshes.forEach((m, i) => { m.visible = flags[i] !== '0'; m.rotation.y = t * 1.8 + i; m.position.y = 16 + Math.sin(t * 3 + i) * 2.5; }); padGlow.forEach((m, i) => { (m.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(t * 6 + i) * 0.3; }); },
    dispose() { for (const d of disposables) d.dispose(); },
  };
}
