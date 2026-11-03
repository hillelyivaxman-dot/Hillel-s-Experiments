import { CATALOG, defaultOptions, getMeta } from '../shared/catalog';
import {
  AVATAR_COUNT, PLAYER_COLORS,
  type AdminAction, type C2S, type ErrorCode, type PlayerInfo, type ResultRow, type RoomPhase, type RoomState, type S2C,
} from '../shared/protocol';
import { GAMES } from './games';
import type { GameContext, GameInstance, PlayerInput } from './games/types';
import { clamp, cleanName, num, rng, safeEqual, token } from './util';

/** A connected socket, abstracted so rooms can be unit-tested without WebSockets. */
export interface Client {
  send(m: S2C): void;
  close(): void;
  role: 'none' | 'host' | 'watch' | 'player';
  room: Room | null;
  playerId: string | null;
  rtt: number;
  /** Signed-in website account behind this socket (from the session cookie), if any. */
  userId?: number | null;
}

interface PlayerRec {
  info: PlayerInfo;
  token: string;
  client: Client | null;
  input: PlayerInput;
  seq: number;
  tapIds: number[];
  disconnectedAt: number;
  lastHud: string;
  reportedBy: Set<string>;
  userId: number | null;
}

export const TIMING = {
  TICK_MS: 1000 / 30,
  COUNTDOWN_MS: 3500,
  DROP_AFTER_MS: 90_000, // remove disconnected players (outside of a running game)
};
const STARS = [3, 2, 1];

let pidCounter = 0;

export class Room {
  readonly hostKey = token();
  readonly createdAt: number;
  lastActivity: number;
  password: string | null = null;
  maxPlayers = 8;
  phase: RoomPhase = 'lobby';
  selectedGame = CATALOG.find((g) => g.status === 'playable')!.id;
  options: Record<string, number> = defaultOptions(getMeta(this.selectedGame)!);
  leaderId: string | null = null;
  readonly players = new Map<string, PlayerRec>();
  readonly hosts = new Set<Client>();
  readonly watchers = new Set<Client>();
  readonly banned = new Set<string>(); // kicked tokens
  game: GameInstance | null = null;
  gameId: string | null = null;
  participants: string[] = [];
  countdownEndsAt: number | null = null;
  results: ResultRow[] | null = null;
  private fx: { k: string; [key: string]: unknown }[] = [];
  private frameNo = 0;
  private dirty = false;
  private seed = 1;

  /** Called with saved-match rows for signed-in players (set by the server when accounts are enabled). */
  onPlays: ((rows: { userId: number; game: string; place: number; players: number; stars: number }[]) => void) | null = null;

  /** The session cookie was resolved after the socket joined: attach the account to that player. */
  setUser(playerId: string, userId: number) {
    const p = this.players.get(playerId);
    if (p) p.userId = userId;
  }

  constructor(readonly code: string, private clock: () => number = Date.now) {
    this.createdAt = this.lastActivity = clock();
    this.seed = (Math.random() * 2 ** 31) | 0;
  }

  // ---------- connections ----------

  attachHost(c: Client) {
    c.role = 'host';
    c.room = this;
    this.hosts.add(c);
    this.dirty = true;
  }

  attachWatcher(c: Client) {
    c.role = 'watch';
    c.room = this;
    this.watchers.add(c);
    c.send({ t: 'room', room: this.state() });
  }

  join(c: Client, m: Extract<C2S, { t: 'join' }>): ErrorCode | null {
    const now = this.clock();
    // reconnect with session token (no duplicate players)
    if (typeof m.token === 'string' && m.token) {
      if (this.banned.has(m.token)) return 'not_allowed';
      for (const p of this.players.values()) {
        if (safeEqual(p.token, m.token)) {
          if (p.client && p.client !== c) { p.client.room = null; p.client.close(); }
          this.bind(c, p);
          return null;
        }
      }
    }
    if (this.password !== null && (typeof m.password !== 'string' || !safeEqual(m.password, this.password))) return 'bad_password';
    if (this.players.size >= this.maxPlayers) return 'room_full';
    let name = cleanName(m.name);
    if (!name) return 'bad_name';
    const taken = new Set([...this.players.values()].map((p) => p.info.name.toLowerCase()));
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${name.slice(0, 11)} ${i}`;
    const used = new Set([...this.players.values()].map((p) => p.info.color));
    const color = PLAYER_COLORS.find((col) => !used.has(col)) ?? PLAYER_COLORS[this.players.size % PLAYER_COLORS.length];
    const id = `p${++pidCounter}`;
    const rec: PlayerRec = {
      info: { id, name, avatar: clamp(Math.floor(num(m.avatar)), 0, AVATAR_COUNT - 1), color, connected: true, ready: false, stars: 0 },
      token: token(), client: null, input: { x: 0, y: 0, b: 0 }, seq: -1, tapIds: [], disconnectedAt: 0, lastHud: '',
      reportedBy: new Set(),
      userId: c.userId ?? null,
    };
    this.players.set(id, rec);
    if (!this.leaderId) this.leaderId = id;
    this.bind(c, rec);
    this.lastActivity = now;
    this.fxPush('join', { id });
    return null;
  }

  private bind(c: Client, p: PlayerRec) {
    c.role = 'player';
    c.room = this;
    c.playerId = p.info.id;
    p.client = c;
    if (c.userId) p.userId = c.userId;
    p.info.connected = true;
    p.seq = -1;
    c.send({ t: 'joined', code: this.code, playerId: p.info.id, token: p.token });
    p.lastHud = '';
    this.dirty = true;
  }

  detach(c: Client) {
    if (c.role === 'host') this.hosts.delete(c);
    if (c.role === 'watch') this.watchers.delete(c);
    if (c.role === 'player' && c.playerId) {
      const p = this.players.get(c.playerId);
      if (p && p.client === c) {
        p.client = null;
        p.info.connected = false;
        p.info.ready = false;
        p.input = { x: 0, y: 0, b: 0 };
        p.disconnectedAt = this.clock();
      }
    }
    c.room = null;
    this.dirty = true;
  }

  get connectedCount() {
    return [...this.players.values()].filter((p) => p.info.connected).length;
  }

  isEmpty() {
    return this.hosts.size === 0 && this.watchers.size === 0 && this.connectedCount === 0;
  }

  // ---------- messages ----------

  handle(c: Client, m: C2S) {
    this.lastActivity = this.clock();
    const p = c.role === 'player' && c.playerId ? this.players.get(c.playerId) : undefined;
    switch (m.t) {
      case 'input': {
        if (!p) return;
        const s = num(m.s, -1);
        if (s <= p.seq) return; // duplicate / out of order
        p.seq = s;
        const prevB = p.input.b;
        const b = Math.floor(num(m.b)) & 0xf;
        p.input = { x: clamp(num(m.x), -1, 1), y: clamp(num(m.y), -1, 1), b };
        const rising = b & ~prevB;
        if (rising && this.game && this.phase === 'playing' && this.participants.includes(p.info.id) && this.game.onPress) {
          const at = this.clock();
          for (let bit = 1; bit <= 8; bit <<= 1) if (rising & bit) this.game.onPress(p.info.id, bit, at);
        }
        return;
      }
      case 'tap': {
        if (!p || !this.game || this.phase !== 'playing' || !this.participants.includes(p.info.id)) return;
        const id = num(m.id, -1);
        if (p.tapIds.includes(id)) return;
        p.tapIds.push(id);
        if (p.tapIds.length > 32) p.tapIds.shift();
        this.game.onTap?.(p.info.id, Math.floor(num(m.v)), this.clock());
        return;
      }
      case 'ready':
        if (p) { p.info.ready = !!m.v; this.dirty = true; }
        return;
      case 'profile': {
        if (!p) return;
        if (m.name !== undefined) {
          const n = cleanName(m.name);
          if (!n) return c.send({ t: 'error', code: 'bad_name' });
          p.info.name = n;
        }
        if (m.avatar !== undefined) p.info.avatar = clamp(Math.floor(num(m.avatar)), 0, AVATAR_COUNT - 1);
        this.dirty = true;
        return;
      }
      case 'report': {
        const target = this.players.get(String(m.playerId));
        if (!p || !target || target === p) return;
        target.reportedBy.add(p.info.id);
        const others = this.players.size - 1;
        if (target.reportedBy.size >= Math.max(2, Math.ceil(others / 2))) {
          target.info.name = `Player ${target.info.id.slice(1)}`;
          target.reportedBy.clear();
          this.dirty = true;
        }
        console.log(`[report] room=${this.code} target=${target.info.id} by=${p.info.id}`);
        return;
      }
      case 'leave':
        if (p) {
          this.removePlayer(p.info.id);
          c.room = null;
        }
        return;
      case 'ping':
        if (typeof m.rtt === 'number') c.rtt = clamp(m.rtt, 0, 2000);
        c.send({ t: 'pong', c: num(m.c), s: this.clock() });
        return;
      case 'admin': {
        const isHost = c.role === 'host';
        const isLeader = !!p && p.info.id === this.leaderId;
        if (!isHost && !isLeader) return c.send({ t: 'error', code: 'not_allowed' });
        const err = this.admin(m.act);
        if (err) c.send({ t: 'error', code: err });
        return;
      }
    }
  }

  admin(act: AdminAction): ErrorCode | null {
    if (!act || typeof act !== 'object') return 'bad_message';
    switch (act.a) {
      case 'select': {
        const meta = getMeta(String(act.game));
        if (!meta || meta.status !== 'playable' || !GAMES[meta.id]) return 'not_allowed';
        if (this.phase !== 'lobby' && this.phase !== 'results') return 'in_game';
        this.selectedGame = meta.id;
        this.options = defaultOptions(meta);
        break;
      }
      case 'option': {
        const meta = getMeta(this.selectedGame)!;
        const opt = meta.options.find((o) => o.key === act.key);
        if (!opt || !opt.values.includes(act.value)) return 'bad_message';
        if (this.phase !== 'lobby' && this.phase !== 'results') return 'in_game';
        this.options[opt.key] = act.value;
        break;
      }
      case 'again':
      case 'start': {
        if (this.phase !== 'lobby' && this.phase !== 'results') return 'in_game';
        return this.startGame();
      }
      case 'pause':
        if (this.phase !== 'playing') return 'not_allowed';
        this.phase = 'paused';
        break;
      case 'resume':
        if (this.phase !== 'paused') return 'not_allowed';
        this.phase = 'playing';
        break;
      case 'end':
        if (!this.game) return 'not_allowed';
        this.finishGame();
        return null;
      case 'lobby':
        this.game = null;
        this.gameId = null;
        this.phase = 'lobby';
        this.results = null;
        this.countdownEndsAt = null;
        for (const p of this.players.values()) p.info.ready = false;
        break;
      case 'kick': {
        const p = this.players.get(String(act.playerId));
        if (!p) return 'bad_message';
        this.banned.add(p.token);
        p.client?.send({ t: 'kicked' });
        const cl = p.client;
        this.removePlayer(p.info.id);
        if (cl) { cl.room = null; cl.close(); }
        break;
      }
      case 'leader':
        if (!this.players.has(String(act.playerId))) return 'bad_message';
        this.leaderId = String(act.playerId);
        break;
      case 'room':
        if (act.maxPlayers !== undefined) this.maxPlayers = clamp(Math.floor(num(act.maxPlayers, 8)), 2, 12);
        if (act.password !== undefined) {
          const pw = typeof act.password === 'string' ? act.password.trim().slice(0, 32) : '';
          this.password = pw ? pw : null;
        }
        break;
      default:
        return 'bad_message';
    }
    this.dirty = true;
    return null;
  }

  private removePlayer(id: string) {
    this.players.delete(id);
    this.participants = this.participants.filter((x) => x !== id);
    if (this.leaderId === id) {
      const next = [...this.players.values()].find((p) => p.info.connected) ?? [...this.players.values()][0];
      this.leaderId = next ? next.info.id : null;
    }
    this.dirty = true;
  }

  // ---------- game lifecycle ----------

  startGame(): ErrorCode | null {
    const meta = getMeta(this.selectedGame);
    const mod = meta && GAMES[meta.id];
    if (!meta || !mod || meta.status !== 'playable') return 'not_allowed';
    const ready = [...this.players.values()].filter((p) => p.info.connected).slice(0, meta.maxPlayers);
    if (ready.length < meta.minPlayers) return 'not_allowed';
    this.participants = ready.map((p) => p.info.id);
    for (const p of ready) { p.seq = -1; p.input = { x: 0, y: 0, b: 0 }; }
    const rand = rng(this.seed++);
    const room = this;
    const ctx: GameContext = {
      players: ready.map((p) => ({ id: p.info.id, name: p.info.name, color: p.info.color, avatar: p.info.avatar })),
      options: { ...this.options },
      rand,
      input: (id) => {
        const p = room.players.get(id);
        return p && p.info.connected ? p.input : { x: 0, y: 0, b: 0 };
      },
      connected: (id) => !!room.players.get(id)?.info.connected,
      rtt: (id) => room.players.get(id)?.client?.rtt ?? 0,
      hostRtt: () => Math.min(...[...room.hosts].map((h) => h.rtt), 400),
      now: () => room.clock(),
      hud: (id, h) => {
        const p = room.players.get(id);
        if (!p?.client) return;
        const s = JSON.stringify(h);
        if (s === p.lastHud) return;
        p.lastHud = s;
        p.client.send({ t: 'hud', h });
      },
      buzz: (id, ms) => room.players.get(id)?.client?.send({ t: 'buzz', ms: clamp(ms, 10, 1000) }),
      fx: (k, data) => room.fxPush(k, data),
    };
    this.game = mod.create(ctx);
    this.gameId = meta.id;
    this.results = null;
    this.phase = 'countdown';
    this.countdownEndsAt = this.clock() + TIMING.COUNTDOWN_MS;
    this.fx = [];
    this.dirty = true;
    return null;
  }

  private finishGame() {
    if (!this.game) return;
    const rows = this.game.standings().filter((r) => this.players.has(r.playerId));
    const results: ResultRow[] = [];
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      const tie = r.tie ?? i;
      const prevTie = prev ? prev.tie ?? i - 1 : undefined;
      const place = prev && tie === prevTie ? results[i - 1].place : i + 1;
      const stars = rows.length > 1 ? STARS[place - 1] ?? 0 : 0;
      results.push({ playerId: r.playerId, place, score: r.score, stars, detail: r.detail });
      const p = this.players.get(r.playerId);
      if (p) {
        p.info.stars += stars;
        if (place === 1) p.client?.send({ t: 'buzz', ms: 500 });
      }
    });
    this.sendFrame(); // final frame
    this.results = results;
    if (this.onPlays && this.gameId) {
      const game = this.gameId;
      const saved = results.flatMap((r) => {
        const uid = this.players.get(r.playerId)?.userId;
        return uid ? [{ userId: uid, game, place: r.place, players: results.length, stars: r.stars }] : [];
      });
      if (saved.length) this.onPlays(saved);
    }
    this.phase = 'results';
    this.game = null;
    this.countdownEndsAt = null;
    this.dirty = true;
  }

  private fxPush(k: string, data?: Record<string, unknown>) {
    if (this.fx.length < 64) this.fx.push({ k, ...data });
  }

  private sendFrame() {
    if (!this.game || !this.gameId) return;
    const f = { ...(this.game.snapshot() as object), ev: this.fx };
    this.fx = [];
    const msg: S2C = { t: 'frame', g: this.gameId, n: ++this.frameNo, f };
    for (const h of this.hosts) h.send(msg);
    for (const w of this.watchers) w.send(msg);
  }

  /** Called by the server loop ~30 times per second. */
  tick(dt = TIMING.TICK_MS / 1000) {
    const now = this.clock();
    if (this.phase === 'countdown' && this.countdownEndsAt !== null && now >= this.countdownEndsAt) {
      this.phase = 'playing';
      this.countdownEndsAt = null;
      this.dirty = true;
    }
    if (this.game && this.phase === 'playing') {
      this.game.tick(dt);
      if (this.game.isOver()) this.finishGame();
    }
    if (this.game) this.sendFrame();
    // drop long-gone players while not in a match
    if (this.phase === 'lobby' || this.phase === 'results') {
      for (const p of [...this.players.values()]) {
        if (!p.info.connected && now - p.disconnectedAt > TIMING.DROP_AFTER_MS) this.removePlayer(p.info.id);
      }
    }
    if (this.dirty) this.broadcastRoom();
  }

  state(): RoomState {
    return {
      code: this.code,
      phase: this.phase,
      players: [...this.players.values()].map((p) => ({ ...p.info })),
      leaderId: this.leaderId,
      selectedGame: this.selectedGame,
      gameId: this.gameId,
      inGame: [...this.participants],
      options: { ...this.options },
      maxPlayers: this.maxPlayers,
      hasPassword: this.password !== null,
      countdownEndsAt: this.countdownEndsAt,
      results: this.results,
      hostConnected: this.hosts.size > 0,
    };
  }

  broadcastRoom() {
    this.dirty = false;
    const msg: S2C = { t: 'room', room: this.state() };
    for (const h of this.hosts) h.send(msg);
    for (const w of this.watchers) w.send(msg);
    for (const p of this.players.values()) p.client?.send(msg);
  }
}
