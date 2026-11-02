import { CODE_ALPHABET, CODE_LEN, type C2S } from '../shared/protocol';
import { Room, type Client } from './room';
import { Bucket, clamp, num, safeEqual } from './util';

export const LIMITS = {
  MAX_ROOMS: 500,
  EMPTY_ROOM_TTL_MS: 10 * 60_000,
  MAX_ROOM_AGE_MS: 12 * 3600_000,
};

/** Owns all rooms and routes messages from sockets that are not yet in a room. */
export class Rooms {
  readonly rooms = new Map<string, Room>();
  private createBuckets = new Map<string, Bucket>();
  private joinBuckets = new Map<string, Bucket>();

  constructor(private clock: () => number = Date.now) {}

  private newCode(): string {
    for (let attempt = 0; attempt < 1000; attempt++) {
      let s = '';
      for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      if (!this.rooms.has(s)) return s;
    }
    throw new Error('code space exhausted');
  }

  private allow(map: Map<string, Bucket>, ip: string, rate: number, burst: number) {
    let b = map.get(ip);
    if (!b) { b = new Bucket(rate, burst); map.set(ip, b); }
    return b.take(1, this.clock());
  }

  get(code: unknown): Room | undefined {
    return typeof code === 'string' ? this.rooms.get(code.toUpperCase().trim()) : undefined;
  }

  /** Handles a message for a client; returns false if the message type is unknown. */
  route(c: Client, m: C2S, ip = 'local') {
    switch (m.t) {
      case 'host_create': {
        if (!this.allow(this.createBuckets, ip, 0.1, 5)) return c.send({ t: 'error', code: 'rate_limited' });
        if (this.rooms.size >= LIMITS.MAX_ROOMS) return c.send({ t: 'error', code: 'too_many_rooms' });
        if (c.room) c.room.detach(c);
        const room = new Room(this.newCode(), this.clock);
        room.maxPlayers = clamp(Math.floor(num(m.maxPlayers, 8)), 2, 12);
        if (typeof m.password === 'string' && m.password.trim()) room.password = m.password.trim().slice(0, 32);
        this.rooms.set(room.code, room);
        room.attachHost(c);
        c.send({ t: 'hosted', code: room.code, hostKey: room.hostKey });
        room.broadcastRoom();
        return;
      }
      case 'host_resume': {
        const room = this.get(m.code);
        if (!room || typeof m.hostKey !== 'string' || !safeEqual(m.hostKey, room.hostKey)) return c.send({ t: 'error', code: 'no_room' });
        if (c.room) c.room.detach(c);
        room.attachHost(c);
        c.send({ t: 'hosted', code: room.code, hostKey: room.hostKey });
        room.broadcastRoom();
        return;
      }
      case 'watch': {
        if (!this.allow(this.joinBuckets, ip, 1, 10)) return c.send({ t: 'error', code: 'rate_limited' });
        const room = this.get(m.code);
        if (!room) return c.send({ t: 'error', code: 'no_room' });
        if (room.password !== null && (typeof m.password !== 'string' || !safeEqual(m.password, room.password))) {
          return c.send({ t: 'error', code: 'bad_password' });
        }
        if (c.room) c.room.detach(c);
        room.attachWatcher(c);
        c.send({ t: 'watching', code: room.code });
        return;
      }
      case 'join': {
        // join attempts are rate limited per IP to stop code/password guessing
        if (!this.allow(this.joinBuckets, ip, 1, 10)) return c.send({ t: 'error', code: 'rate_limited' });
        const room = this.get(m.code);
        if (!room) return c.send({ t: 'error', code: 'no_room' });
        if (c.room && c.room !== room) c.room.detach(c);
        const err = room.join(c, m);
        if (err) return c.send({ t: 'error', code: err });
        room.broadcastRoom();
        return;
      }
      default:
        if (c.room) c.room.handle(c, m);
        else if (m.t === 'ping') c.send({ t: 'pong', c: num(m.c), s: this.clock() });
    }
  }

  disconnect(c: Client) {
    c.room?.detach(c);
  }

  tick() {
    const now = this.clock();
    for (const [code, room] of this.rooms) {
      room.tick();
      const idle = room.isEmpty() && now - room.lastActivity > LIMITS.EMPTY_ROOM_TTL_MS;
      if (idle || now - room.createdAt > LIMITS.MAX_ROOM_AGE_MS) this.rooms.delete(code);
    }
    if (this.createBuckets.size > 5000) this.createBuckets.clear();
    if (this.joinBuckets.size > 5000) this.joinBuckets.clear();
  }
}
