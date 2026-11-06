import * as THREE from 'three';
import { getTrack, TRACK_WIDTH } from '../../../shared/tracks';
import { buildTrackWorld, rngFrom, type TrackWorld } from './kartTrack';

export type CamMode = 'cockpit' | 'bumper' | 'chase' | 'spectator';
export interface CarView { id: string; x: number; y: number; a: number; v: number; st: number; b: number; s: number; h: number; ar: number; fin: number; dr: number }
export interface Who { name: string; color: string; avatar: number }

interface CarObj { group: THREE.Group; body: THREE.Group; flame: THREE.Mesh; shield: THREE.Mesh; shadow: THREE.Mesh; label: THREE.Sprite; head: THREE.Mesh; wheels: THREE.Mesh[]; spin: number }
interface Spark { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; r: number; g: number; b: number }

/** The personal 3D screen of a Kart Chaos phone (and the host's spectator view). Rendering only: the server owns the race. */
export class KartScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private world: TrackWorld;
  private cars = new Map<string, CarObj>();
  private sparks: Spark[] = []; private sparkPts: THREE.Points; private sparkPos: Float32Array; private sparkCol: Float32Array;
  private lines: THREE.LineSegments; private lineSeeds: Float32Array;
  private oils: THREE.Mesh[] = [];
  private t = 0; private shake = 0; private flash = 0;
  private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3(); private camA = 0; private camInit = false;
  mode: CamMode = 'chase'; quality: 'low' | 'high';
  private pr = 1; private slow = 0;

  constructor(readonly canvas: HTMLCanvasElement, trackId: number, quality: 'low' | 'high' = 'high') {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance', alpha: false });
    this.pr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.5 : 1);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Color(0x8fd4ff);
    this.scene.background = sky; this.scene.fog = new THREE.Fog(sky, 500, 1900);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x4a7a50, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1cf, 1.1); sun.position.set(-300, 600, 200); this.scene.add(sun);
    this.world = buildTrackWorld(trackId, quality); this.scene.add(this.world.group);
    this.cam = new THREE.PerspectiveCamera(72, 16 / 9, 4, 4000);
    this.scene.add(this.cam);
    // speed lines live in camera space
    const n = 46; this.lineSeeds = new Float32Array(n * 3);
    const lp = new Float32Array(n * 6); const rg = rngFrom(11);
    for (let i = 0; i < n; i++) { this.lineSeeds[i * 3] = (rg() - 0.5) * 2; this.lineSeeds[i * 3 + 1] = (rg() - 0.5) * 1.2; this.lineSeeds[i * 3 + 2] = rg(); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending }));
    this.lines.frustumCulled = false; this.lines.renderOrder = 10; this.cam.add(this.lines);
    // sparks (collisions, boost, sand)
    this.sparkPos = new Float32Array(160 * 3); this.sparkCol = new Float32Array(160 * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3));
    this.sparkPts = new THREE.Points(sg, new THREE.PointsMaterial({ size: 7, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparkPts.frustumCulled = false; this.scene.add(this.sparkPts);
    getTrack(trackId); this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || 640, h = this.canvas.clientHeight || 360;
    this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
  }

  private makeCar(who: Who | undefined): CarObj {
    const color = new THREE.Color(who?.color ?? '#ff4d6d'), group = new THREE.Group(), body = new THREE.Group();
    const L = (c: number | THREE.Color) => new THREE.MeshLambertMaterial({ color: c });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(50, 9, 28), L(color)); chassis.position.y = 9; body.add(chassis);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(18, 6, 22), L(color.clone().multiplyScalar(0.85))); nose.position.set(30, 7, 0); body.add(nose);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(52, 1.2, 6), L(0xffffff)); stripe.position.set(0, 13.7, 0); body.add(stripe);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 18), L(0x23232f)); seat.position.set(-6, 15, 0); body.add(seat);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 32), L(0x23232f)); spoiler.position.set(-26, 25, 0); body.add(spoiler);
    for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(3, 11, 3), L(0x23232f)); st.position.set(-26, 18, s * 9); body.add(st); }
    for (const s of [-1, 1]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 6), new THREE.MeshBasicMaterial({ color: 0xfff6a8 })); hl.position.set(40, 8, s * 8); body.add(hl); }
    const wheels: THREE.Mesh[] = [];
    for (const [wx, wz] of [[-16, 15], [-16, -15], [18, 15], [18, -15]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 7, 12), L(0x15151d)); w.rotation.x = Math.PI / 2; w.position.set(wx, 7, wz); body.add(w); wheels.push(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 7.4, 8), L(0xd5d8e6)); hub.rotation.x = Math.PI / 2; hub.position.set(wx, 7, wz); body.add(hub);
    }
    // the driver: a round critter head with eyes, in the player's colour
    const head = new THREE.Mesh(new THREE.SphereGeometry(8.5, 14, 12), L(color.clone().lerp(new THREE.Color(0xffffff), 0.25))); head.position.set(-5, 27, 0); body.add(head);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 8), L(0xffffff)); e.position.set(2.5, 29, s * 3.6); body.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(1.3, 6, 6), L(0x120a2a)); p.position.set(4.6, 29, s * 3.7); body.add(p); }
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(8.9, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), L(0xffffff)); helmet.position.set(-5, 27.6, 0); body.add(helmet);
    group.add(body);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(6, 34, 8), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })); flame.rotation.z = Math.PI / 2; flame.position.set(-48, 10, 0); flame.visible = false; group.add(flame);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(38, 16, 12), new THREE.MeshBasicMaterial({ color: 0x3ec1ff, transparent: true, opacity: 0.22, depthWrite: false })); shield.position.y = 16; shield.visible = false; group.add(shield);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(30, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.9; shadow.scale.set(1.5, 1, 1); group.add(shadow);
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d')!;
    g.font = '900 38px Rubik, Arial Black, sans-serif'; g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = 'rgba(10,5,30,.9)'; g.strokeText(who?.name ?? '', 128, 44); g.fillStyle = who?.color ?? '#fff'; g.fillText(who?.name ?? '', 128, 44);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); label.scale.set(64, 16, 1); label.position.y = 58; label.renderOrder = 5; group.add(label);
    this.scene.add(group);
    return { group, body, flame, shield, shadow, label, head, wheels, spin: 0 };
  }

  burst(x: number, y: number, z: number, color: number, n: number, speed: number) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.sparks.length < 160; i++) { const a = Math.random() * 6.28, e = Math.random() * 0.8; this.sparks.push({ x, y, z, vx: Math.cos(a) * speed * (0.3 + Math.random()), vy: 60 + Math.random() * speed * e, vz: Math.sin(a) * speed * (0.3 + Math.random()), life: 0.5 + Math.random() * 0.5, r: c.r, g: c.g, b: c.b }); }
  }
  kick(n: number) { this.shake = Math.min(14, this.shake + n); }
  blink(v = 0.5) { this.flash = v; }
  get flashAmount() { return this.flash; }

  /** Draw one frame. `cars` are already interpolated/predicted; `focus` is the car the camera follows. */
  render(dt: number, cars: CarView[], who: Map<string, Who>, focus: string, oil: [number, number][], boxFlags: string) {
    this.t += dt; this.shake *= Math.pow(0.02, dt); this.flash = Math.max(0, this.flash - dt * 2.2);
    this.world.update(this.t, boxFlags);
    const seen = new Set<string>();
    for (const c of cars) {
      seen.add(c.id);
      let o = this.cars.get(c.id);
      if (!o) { o = this.makeCar(who.get(c.id)); this.cars.set(c.id, o); }
      const air = c.ar * 40;
      o.group.position.set(c.x, air, c.y); o.group.rotation.y = -c.a;
      o.spin = c.s ? o.spin + dt * 14 : 0; o.body.rotation.y = o.spin; o.body.rotation.z = -c.st * 0.06 + (c.dr ? -c.st * 0.12 : 0);
      o.flame.visible = !!c.b; if (c.b) o.flame.scale.setScalar(0.8 + Math.sin(this.t * 40) * 0.2);
      o.shield.visible = !!c.h; o.shadow.position.y = 0.9 - air; o.shadow.scale.set(1.5 - c.ar * 0.4, 1 - c.ar * 0.3, 1);
      for (const w of o.wheels) w.rotation.y += c.v * dt * 0.14;
      const mine = c.id === focus && this.mode !== 'spectator';
      o.label.visible = !mine; o.body.visible = !(mine && this.mode === 'cockpit');
      o.head.visible = o.body.visible;
      if (c.b && Math.random() < 0.7) this.burst(c.x - Math.cos(c.a) * 36, 8 + air, c.y - Math.sin(c.a) * 36, 0xffa030, 1, 120);
    }
    for (const [id, o] of this.cars) if (!seen.has(id)) { this.scene.remove(o.group); this.cars.delete(id); }
    // oil slicks
    while (this.oils.length < oil.length) { const m = new THREE.Mesh(new THREE.CircleGeometry(26, 14), new THREE.MeshBasicMaterial({ color: 0x0d0a18, transparent: true, opacity: 0.85 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.7; this.scene.add(m); this.oils.push(m); }
    this.oils.forEach((m, i) => { m.visible = i < oil.length; if (i < oil.length) m.position.set(oil[i][0], 0.7, oil[i][1]); });
    // sparks
    let k = 0;
    for (let i = this.sparks.length - 1; i >= 0; i--) { const s = this.sparks[i]; s.life -= dt; if (s.life <= 0) { this.sparks.splice(i, 1); continue; } s.vy -= 380 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; }
    for (const s of this.sparks) { this.sparkPos[k * 3] = s.x; this.sparkPos[k * 3 + 1] = Math.max(0.5, s.y); this.sparkPos[k * 3 + 2] = s.z; const f = Math.min(1, s.life * 2); this.sparkCol[k * 3] = s.r * f; this.sparkCol[k * 3 + 1] = s.g * f; this.sparkCol[k * 3 + 2] = s.b * f; k++; }
    for (let j = k; j < 160; j++) { this.sparkPos[j * 3 + 1] = -999; }
    (this.sparkPts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.sparkPts.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    this.placeCamera(dt, cars.find((c) => c.id === focus) ?? cars[0]);
    this.renderer.render(this.scene, this.cam);
    // adaptive quality: if the phone cannot keep ~40 fps, render fewer pixels
    this.slow = dt > 0.028 ? this.slow + dt : Math.max(0, this.slow - dt * 2);
    if (this.slow > 2 && this.pr > 0.7) { this.pr = Math.max(0.7, this.pr - 0.15); this.renderer.setPixelRatio(this.pr); this.resize(); this.slow = 0; }
  }

  private placeCamera(dt: number, me: CarView | undefined) {
    if (!me) return;
    const fwd = new THREE.Vector3(Math.cos(me.a), 0, Math.sin(me.a));
    // smoothed heading: the camera does not twitch with every correction
    let da = me.a - this.camA; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    const camTurn = this.mode === 'cockpit' || this.mode === 'bumper' ? 14 : 6;
    this.camA = this.camInit ? this.camA + da * Math.min(1, camTurn * dt) : me.a;
    const f2 = new THREE.Vector3(Math.cos(this.camA), 0, Math.sin(this.camA));
    const car = new THREE.Vector3(me.x, me.ar * 40, me.y);
    let pos: THREE.Vector3, look: THREE.Vector3, fov = 70;
    switch (this.mode) {
      case 'cockpit': pos = car.clone().addScaledVector(f2, 4).add(new THREE.Vector3(0, 24, 0)); look = pos.clone().addScaledVector(f2, 120).add(new THREE.Vector3(0, -3, 0)); fov = 82; break;
      case 'bumper': pos = car.clone().addScaledVector(f2, 38).add(new THREE.Vector3(0, 9, 0)); look = pos.clone().addScaledVector(f2, 120).add(new THREE.Vector3(0, 2, 0)); fov = 86; break;
      case 'spectator': { const ang = this.camA + Math.PI + Math.sin(this.t * 0.2) * 0.5; pos = car.clone().add(new THREE.Vector3(Math.cos(ang) * 230, 120, Math.sin(ang) * 230)); look = car.clone().add(new THREE.Vector3(0, 12, 0)); fov = 58; break; }
      default: pos = car.clone().addScaledVector(f2, -150).add(new THREE.Vector3(0, 74, 0)); look = car.clone().addScaledVector(f2, 95).add(new THREE.Vector3(0, 8, 0)); fov = 70;
    }
    const sp = Math.min(1, Math.abs(me.v) / 520);
    fov += sp * 14 + (me.b ? 8 : 0);
    if (!this.camInit) { this.camPos.copy(pos); this.camLook.copy(look); this.camInit = true; }
    const k = this.mode === 'chase' || this.mode === 'spectator' ? Math.min(1, 9 * dt) : 1;
    this.camPos.lerp(pos, k); this.camLook.lerp(look, Math.min(1, 14 * dt));
    this.cam.position.copy(this.camPos);
    if (this.shake > 0.05) this.cam.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake));
    this.cam.lookAt(this.camLook);
    this.cam.rotateZ(-me.st * 0.045 * (this.mode === 'spectator' ? 0 : 1));
    this.cam.fov += (fov - this.cam.fov) * Math.min(1, 6 * dt); this.cam.updateProjectionMatrix();
    void fwd;
    // speed lines
    const pos3 = (this.lines.geometry.attributes.position as THREE.BufferAttribute), n = this.lineSeeds.length / 3;
    (this.lines.material as THREE.LineBasicMaterial).opacity = Math.max(0, (sp - 0.55) * 1.6) * (me.b ? 1.3 : 1);
    for (let i = 0; i < n; i++) {
      const z = ((this.lineSeeds[i * 3 + 2] + this.t * (1.2 + sp)) % 1), depth = 40 + z * 260, len = 8 + sp * 50;
      const x = this.lineSeeds[i * 3] * depth * 0.9, y = this.lineSeeds[i * 3 + 1] * depth * 0.6;
      const edge = Math.hypot(x / (depth * 0.9), y / (depth * 0.6)) > 0.5 ? 1 : 0; // only the edges of the screen
      pos3.setXYZ(i * 2, x, y * edge + (edge ? 0 : 9999), -depth); pos3.setXYZ(i * 2 + 1, x, y * edge + (edge ? 0 : 9999), -depth - len);
    }
    pos3.needsUpdate = true;
  }

  dispose() { this.world.dispose(); this.renderer.dispose(); for (const o of this.cars.values()) this.scene.remove(o.group); this.cars.clear(); }
}
export const TRACK_W = TRACK_WIDTH;
