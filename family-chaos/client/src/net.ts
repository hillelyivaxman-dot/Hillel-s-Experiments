import type { C2S, S2C } from '../../shared/protocol';

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

/**
 * WebSocket connection with automatic reconnect, RTT measurement and server clock sync.
 * `onOpen` runs on every (re)connect so the page can re-identify itself (resume/join).
 */
export class Conn {
  private ws: WebSocket | null = null;
  private handlers = new Set<(m: S2C) => void>();
  private statusHandlers = new Set<(s: ConnStatus) => void>();
  private retry = 0;
  private stopped = false;
  private pingTimer = 0;
  status: ConnStatus = 'connecting';
  rtt = 0;
  offset = 0; // serverNow - Date.now()
  private synced = false;

  private retryTimer = 0;
  private lastPong = 0;

  constructor(private onOpen: (c: Conn) => void) {
    this.connect();
    // Phones drop sockets when the screen locks or the browser is backgrounded:
    // reconnect immediately when the page is visible / online again instead of waiting for backoff.
    document.addEventListener('visibilitychange', this.wake);
    window.addEventListener('online', this.wake);
  }

  private wake = () => {
    if (this.stopped || document.visibilityState !== 'visible') return;
    const ws = this.ws;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      clearTimeout(this.retryTimer);
      this.retry = 0;
      this.connect();
    } else if (ws.readyState === WebSocket.OPEN) {
      this.ping();
    }
  };

  private setStatus(s: ConnStatus) {
    this.status = s;
    this.statusHandlers.forEach((h) => h(s));
  }

  private connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.lastPong = performance.now();
      this.setStatus('open');
      this.ping();
      this.onOpen(this);
    };
    ws.onmessage = (ev) => {
      let m: S2C;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'pong') {
        const now = performance.now();
        this.lastPong = now;
        const rtt = now - m.c;
        this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt;
        const off = m.s - (Date.now() - rtt / 2);
        this.offset = this.synced ? this.offset * 0.8 + off * 0.2 : off;
        this.synced = true;
        return;
      }
      this.handlers.forEach((h) => h(m));
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      if (this.stopped || ev.code === 4000) { this.setStatus('closed'); return; }
      this.setStatus('reconnecting');
      const delay = Math.min(5000, 300 * 2 ** this.retry++);
      clearTimeout(this.retryTimer);
      this.retryTimer = window.setTimeout(() => !this.stopped && this.connect(), delay);
    };
    clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => this.ping(), 2000);
  }

  private ping() {
    // Mobile networks can leave a socket "open" but dead (e.g. Wi-Fi -> 4G switch).
    // No pong for 7 s => abandon it and reconnect right away.
    const ws = this.ws;
    if (ws?.readyState === WebSocket.OPEN && this.lastPong && performance.now() - this.lastPong > 7000) {
      this.ws = null;
      ws.close();
      this.setStatus('reconnecting');
      this.connect();
      return;
    }
    this.send({ t: 'ping', c: performance.now(), rtt: Math.round(this.rtt) });
  }

  serverNow() {
    return Date.now() + this.offset;
  }

  send(m: C2S) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  on(h: (m: S2C) => void) {
    this.handlers.add(h);
    return () => { this.handlers.delete(h); };
  }

  onStatus(h: (s: ConnStatus) => void) {
    this.statusHandlers.add(h);
    return () => { this.statusHandlers.delete(h); };
  }

  close() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    document.removeEventListener('visibilitychange', this.wake);
    window.removeEventListener('online', this.wake);
    clearInterval(this.pingTimer);
    this.ws?.close();
  }
}

export const store = {
  get(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* ignore */ }
  },
  del(k: string) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  },
  sget(k: string): string | null {
    try { return sessionStorage.getItem(k); } catch { return null; }
  },
  sset(k: string, v: string) {
    try { sessionStorage.setItem(k, v); } catch { /* ignore */ }
  },
  sdel(k: string) {
    try { sessionStorage.removeItem(k); } catch { /* ignore */ }
  },
};
