import { describe, expect, it } from 'vitest';
import { bumperGame } from '../../server/games/bumper';
import { bikeGame, boatGame, kartGame } from '../../server/games/kart';
import { potatoGame } from '../../server/games/potato';
import { reactionGame } from '../../server/games/reaction';
import { GAMES } from '../../server/games';
import { CATALOG } from '../../shared/catalog';
import { BTN } from '../../shared/protocol';
import { getTrack, pointAt, TRACK_COUNT } from '../../shared/tracks';
import { makeLevel, platX, sawY } from '../../shared/rush';
import { runGame } from './helpers';

describe('catalog', () => {
  it('every playable game has a server module and every module is in the catalog', () => {
    for (const g of CATALOG.filter((c) => c.status === 'playable')) expect(GAMES[g.id], g.id).toBeDefined();
    for (const id of Object.keys(GAMES)) expect(CATALOG.find((c) => c.id === id)?.status).toBe('playable');
  });
});

describe('bumper battle', () => {
  it('a player that drives off the edge loses all lives and the other wins', () => {
    const r = runGame(bumperGame, 2, { lives: 2 }, (id) => (id === 'p1' ? { x: 1, y: 0.3, b: 0 } : { x: 0, y: 0, b: 0 }));
    expect(r.over).toBe(true);
    const st = r.game.standings();
    expect(st[0].playerId).toBe('p2');
    expect(r.fx.filter((k) => k === 'fall').length).toBeGreaterThanOrEqual(2);
  });

  it('players collide and push each other (dash)', () => {
    const r = runGame(bumperGame, 2, { lives: 3 }, (id, snap, t) => {
      const me = snap.p.find((p: any) => p.id === id);
      const other = snap.p.find((p: any) => p.id !== id);
      const dx = other.x - me.x, dy = other.y - me.y, d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d, b: id === 'p1' && Math.floor(t * 2) % 2 ? BTN.A : 0 };
    }, 20);
    expect(r.fx).toContain('bump');
    expect(r.fx).toContain('dash');
  });

  it('times out with standings for everyone', () => {
    const r = runGame(bumperGame, 4, { lives: 3 }, () => ({ x: 0, y: 0, b: 0 }));
    expect(r.over).toBe(true);
    expect(r.game.standings()).toHaveLength(4);
  });
});

describe('kart chaos', () => {
  for (let track = 0; track < TRACK_COUNT; track++) {
    it(`an autopilot finishes 2 laps on track ${track}`, () => {
      const tr = getTrack(track);
      const progress = new Map<string, number>();
      const r = runGame(kartGame, 3, { laps: 2, track }, (id, snap) => {
        const me = snap.c.find((c: any) => c.id === id);
        // aim at the track point slightly ahead of the closest sample
        // follow progress along the track (a global nearest-point search jumps branches at the figure-eight crossing)
        const n = tr.pts.length;
        const from = progress.get(id) ?? 0;
        let best = from, bd = Infinity;
        for (let k = -20; k <= 60; k++) {
          const i = (((from + k) % n) + n) % n, p = tr.pts[i];
          const d = (p.x - me.x) ** 2 + (p.y - me.y) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
        progress.set(id, best);
        const ahead = pointAt(tr, (tr.cum[best] + 90) / tr.length);
        const want = Math.atan2(ahead.y - me.y, ahead.x - me.x);
        let diff = want - me.a;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const slow = id === 'p3';
        return { x: Math.max(-1, Math.min(1, diff * 2.5)), y: 0, b: slow ? BTN.B : 0 }; // cars accelerate by themselves; p3 just holds the brake
      });
      expect(r.over).toBe(true);
      const st = r.game.standings();
      const finished = st.filter((s) => s.score > 0);
      expect(finished.length).toBe(2); // p3 only brakes
      expect(st[2].playerId).toBe('p3');
      expect(r.fx).toContain('finish');
      expect(r.fx).toContain('lap');
      expect(r.t).toBeLessThan(120);
    });
  }

  it('reversing over the line does not count as a lap', () => {
    const r = runGame(kartGame, 1, { laps: 1, track: 0 }, () => ({ x: 0, y: 0, b: BTN.B }), 30);
    expect(r.over).toBe(false);
  });
});

describe.each([['boat', boatGame], ['bike', bikeGame]] as const)('%s racing', (_n, game) => {
  for (let track = 0; track < TRACK_COUNT; track++) {
    it(`an autopilot finishes 2 laps on track ${track}`, () => {
      const tr = getTrack(track);
      const progress = new Map<string, number>();
      const r = runGame(game, 3, { laps: 2, track }, (id, snap) => {
        const me = snap.c.find((c: any) => c.id === id);
        // aim at the track point slightly ahead of the closest sample
        // follow progress along the track (a global nearest-point search jumps branches at the figure-eight crossing)
        const n = tr.pts.length;
        const from = progress.get(id) ?? 0;
        let best = from, bd = Infinity;
        for (let k = -20; k <= 60; k++) {
          const i = (((from + k) % n) + n) % n, p = tr.pts[i];
          const d = (p.x - me.x) ** 2 + (p.y - me.y) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
        progress.set(id, best);
        const ahead = pointAt(tr, (tr.cum[best] + 90) / tr.length);
        const want = Math.atan2(ahead.y - me.y, ahead.x - me.x);
        let diff = want - me.a;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const slow = id === 'p3';
        return { x: Math.max(-1, Math.min(1, diff * 2.5)), y: 0, b: slow ? BTN.B : 0 }; // cars accelerate by themselves; p3 just holds the brake
      });
      expect(r.over).toBe(true);
      const st = r.game.standings();
      const finished = st.filter((s) => s.score > 0);
      expect(finished.length).toBe(2); // p3 only brakes
      expect(st[2].playerId).toBe('p3');
      expect(r.fx).toContain('finish');
      expect(r.fx).toContain('lap');
      expect(r.t).toBeLessThan(120);
    });
  }

  it('reversing over the line does not count as a lap', () => {
    const r = runGame(game, 1, { laps: 1, track: 0 }, () => ({ x: 0, y: 0, b: BTN.B }), 30);
    expect(r.over).toBe(false);
  });
});

describe('reaction duel', () => {
  it('fast tapper wins, early tapper is punished', () => {
    const r = runGame(reactionGame, 3, { rounds: 3 }, (id, snap) => {
      if (id === 'p1') return { x: 0, y: 0, b: snap.ph === 'go' ? BTN.A : 0 };
      if (id === 'p2') return { x: 0, y: 0, b: snap.ph === 'wait' ? BTN.A : 0 }; // always early
      return { x: 0, y: 0, b: 0 };
    });
    expect(r.over).toBe(true);
    const st = r.game.standings();
    expect(st[0].playerId).toBe('p1');
    expect(st[0].score).toBe(9);
    expect(st.find((s) => s.playerId === 'p2')!.score).toBeLessThan(0);
  });
});

describe('hot potato', () => {
  it('eliminates players until one survives', () => {
    const r = runGame(potatoGame, 4, {}, (id, snap) => {
      const me = snap.p.find((p: any) => p.id === id);
      if (me.o) return { x: 0, y: 0, b: 0 };
      if (snap.h === id) {
        const tgt = snap.p.filter((p: any) => !p.o && p.id !== id)
          .sort((a: any, b: any) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
        const dx = tgt.x - me.x, dy = tgt.y - me.y, d = Math.hypot(dx, dy) || 1;
        return { x: dx / d, y: dy / d, b: 0 };
      }
      return { x: Math.sin(me.y / 90), y: Math.cos(me.x / 90), b: 0 };
    });
    expect(r.over).toBe(true);
    const st = r.game.standings();
    expect(st).toHaveLength(4);
    expect(st[0].detail).toBe('👑');
    expect(r.fx.filter((k) => k === 'boom')).toHaveLength(3);
  });
});

describe('new controller actions', () => {
  it('bumper: power-ups are stored, then fired with POWER (B); DODGE (C) has a cooldown', () => {
    let fired = false, dodged = 0;
    const r = runGame(bumperGame, 2, { lives: 3 }, (id, snap, t) => {
      const me = snap.p.find((p: any) => p.id === id);
      const u = snap.u[0];
      if (id === 'p1' && me.h) { fired = true; return { x: 0, y: 0, b: BTN.B }; } // stored -> fire
      if (id === 'p1' && u) { const dx = u.x - me.x, dy = u.y - me.y, d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d, b: 0 }; }
      if (id === 'p2') { if (me.g) dodged++; return { x: 0, y: 0, b: Math.floor(t * 4) % 2 ? BTN.C : 0 }; }
      return { x: 0, y: 0, b: 0 };
    }, 40);
    expect(r.fx).toContain('pickup');
    expect(fired).toBe(true);
    expect(r.fx).toContain('power');
    // DODGE pressed twice per second for 40 s, but the 2 s cooldown allows at most ~20 dodges
    const dodges = r.fx.filter((k) => k === 'dodge').length;
    expect(dodges).toBeGreaterThan(5);
    expect(dodges).toBeLessThanOrEqual(21);
    expect(dodged).toBeGreaterThan(0);
  });

  it('kart: TURBO (D) spends the meter and boosts; it cannot be spammed', () => {
    const r = runGame(kartGame, 1, { laps: 1, track: 0 }, (_id, _snap, t) => ({ x: 0, y: 0, b: BTN.A | (Math.floor(t * 10) % 2 ? BTN.D : 0) }), 6);
    const boosts = r.fx.filter((k) => k === 'boost').length;
    expect(boosts).toBeGreaterThanOrEqual(1); // starts with 50 = one boost
    expect(boosts).toBeLessThanOrEqual(2); // regen is slow (3/s)
  });

  it('potato: THROW (B) passes the bomb to someone in range', () => {
    const r = runGame(potatoGame, 3, {}, (id, snap, t) => ({ x: 0, y: 0, b: snap.h === id && Math.floor(t * 4) % 2 ? BTN.B : 0 }), 6);
    expect(r.fx).toContain('throw');
  });
});

describe('chaos rush', () => {
  const rushMod = GAMES.rush;
  // a bot that reads the level: jumps pits/spikes, dashes occasionally
  const holding = new Map<string, boolean>();
  const lastG = new Map<string, boolean>();
  const smartBot = (id: string, snap: any, t: number) => {
    const lv = makeLevel(snap.sd, snap.ln);
    const me = snap.p.find((p: any) => p.id === id);
    const onGround = (x: number) => lv.ground.some((s) => x >= s.x0 && x <= s.x1);
    const platAhead = lv.plats.some((p) => me.x + 90 > platX(p, snap.t) - 20 && me.x + 90 < platX(p, snap.t) + p.w + 20);
    const gap = !onGround(me.x + 85) && !platAhead;
    const wide = lv.spikes.some((s) => s.w > 200 && me.x + 140 > s.x && me.x < s.x + s.w);
    const platJump = lv.plats.some((pl) => !pl.mv && pl.x - me.x > 0 && pl.x - me.x < 90 && pl.y <= me.y + 5 && (wide || me.y < 500));
    const spike = !wide && lv.spikes.some((s) => me.x + 70 > s.x - 10 && me.x < s.x + s.w - 20 && me.y >= 500);
    const saw = lv.saws.some((s) => Math.abs(s.x - me.x) < 150 && s.x > me.x);
    const wait = saw && sawY(lv.saws.find((s) => Math.abs(s.x - me.x) < 150 && s.x > me.x)!, snap.t) > 440; // saw low: wait
    const want = gap || spike || platJump;
    // like a player: press on the ground, then keep holding while in the air for a full-height jump
    if (me.g) holding.set(id, lastG.get(id) === false ? false : want); // release for a tick after landing so the next press is a fresh tap
    lastG.set(id, !!me.g);
    return { x: wait ? 0 : 1, y: 0, b: holding.get(id) ? BTN.A : 0 };
  };

  it('a scripted bot clears pits, spikes, a saw, a moving platform and the stair route (>= 50% of the course)', () => {
    const r = runGame(rushMod, 3, { len: 8 }, smartBot, 110);
    const st = r.game.standings();
    expect(st).toHaveLength(3);
    const reached = Math.max(...st.map((x) => (x.detail?.endsWith('%') ? Number.parseInt(x.detail) : 100)));
    expect(reached).toBeGreaterThanOrEqual(50);
    // (the bot is not a perfect player: finishing the whole course is not asserted)
  });

  it('a runner that never jumps is hit by the first obstacle and respawns at the checkpoint', () => {
    const r = runGame(rushMod, 1, { len: 8 }, () => ({ x: 1, y: 0, b: 0 }), 25);
    expect(r.fx).toContain('hit');
    const snap = r.game.snapshot() as any;
    expect(snap.p[0].c).toBe(0);
  });

  it('SHOVE sends a rival back and has a cooldown; DASH is limited by its cooldown', () => {
    const r = runGame(rushMod, 2, { len: 8 }, (id, _s, t) => (id === 'p1' ? { x: 0, y: 0, b: Math.floor(t * 4) % 2 ? BTN.C | BTN.B : 0 } : { x: 0, y: 0, b: 0 }), 12);
    const shoves = r.fx.filter((k) => k === 'shove').length;
    const dashes = r.fx.filter((k) => k === 'dash').length;
    expect(shoves).toBeGreaterThanOrEqual(1);
    expect(shoves).toBeLessThanOrEqual(3); // 5 s cooldown over 12 s
    expect(dashes).toBeLessThanOrEqual(5); // 2.5 s cooldown
  });

  it('level generation is deterministic and every pit is jumpable', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const a = makeLevel(seed, 12), b = makeLevel(seed, 12);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      const g = [...a.ground].sort((x, y) => x.x0 - y.x0);
      for (let i = 1; i < g.length; i++) {
        const gap = g[i].x0 - g[i - 1].x1;
        // plain pits must be jumpable; wider gaps (300) must be bridged by a moving platform
        if (gap > 215) expect(a.plats.some((p) => p.mv && p.x > g[i - 1].x1 && p.x < g[i].x0), `gap ${gap}`).toBe(true);
        expect(gap).toBeLessThanOrEqual(300);
      }
      expect(a.finishX).toBeGreaterThan(5000);
    }
  });
});

describe('soccer', () => {
  const mod = GAMES.soccer;
  // attacker bot: run behind the ball, then push/kick it toward the opponent's goal
  const striker = (team: 0 | 1) => (id: string, snap: any, t: number) => {
    const me = snap.p.find((p: any) => p.id === id), ball = snap.b[0];
    const gx = team === 0 ? 600 : -600, gy = 0;
    const toG = Math.atan2(gy - ball.y, gx - ball.x);
    const behind = { x: ball.x - Math.cos(toG) * 45, y: ball.y - Math.sin(toG) * 45 };
    const dBall = Math.hypot(ball.x - me.x, ball.y - me.y);
    const dBehind = Math.hypot(behind.x - me.x, behind.y - me.y);
    const aim = dBehind > 25 && dBall > 50 ? Math.atan2(behind.y - me.y, behind.x - me.x) : Math.atan2(gy - me.y, gx - me.x);
    return { x: Math.cos(aim), y: Math.sin(aim), b: dBall < 60 && Math.floor(t * 6) % 2 === 0 ? BTN.A : 0 };
  };
  const idle = () => ({ x: 0, y: 0, b: 0 });

  it('assigns alternating teams and a striker scores; the scoring team wins and shares first place', () => {
    // the opponent wanders off the shot line (a standing defender would block the ball: that is realistic, but not this test)
    const r = runGame(mod, 2, { time: 40 }, (id, s, t) => (id === 'p1' ? striker(0)(id, s, t) : { x: 0, y: -1, b: 0 }), 90);
    expect(r.over).toBe(true);
    expect(r.fx).toContain('goal');
    expect(r.fx).toContain('kick');
    const st = r.game.standings();
    expect(st[0].playerId).toBe('p1');
    expect(st[0].score).toBeGreaterThanOrEqual(1);
    expect((r.game.snapshot() as any).sc[0]).toBeGreaterThanOrEqual(1);
  });

  it('a 0-0 tie plays golden-goal overtime and then ends as a shared draw', () => {
    const r = runGame(mod, 2, { time: 10 }, idle, 90);
    expect(r.fx).toContain('overtime');
    expect(r.over).toBe(true);
    const st = r.game.standings();
    expect(st[0].tie).toBe(st[1].tie); // draw: same place
  });

  it('teams of two: both players of the winning team win; players cannot leave the pitch; ball stays in play', () => {
    const r = runGame(mod, 4, { time: 30 }, (id, s, t) => (id === 'p1' || id === 'p3' ? striker(0)(id, s, t) : { x: -1, y: 1, b: BTN.B }), 90);
    const snap = r.game.snapshot() as any;
    for (const p of snap.p) { expect(Math.abs(p.x)).toBeLessThanOrEqual(600); expect(Math.abs(p.y)).toBeLessThanOrEqual(350); }
    expect(Math.abs(snap.b[0].y)).toBeLessThanOrEqual(350);
    const st = r.game.standings();
    expect(snap.p.filter((p: any) => p.tm === 0).length).toBe(2);
    if (snap.sc[0] > snap.sc[1]) expect(st.slice(0, 2).every((x) => ['p1', 'p3'].includes(x.playerId))).toBe(true);
  });

  it('sprint drains stamina and kick has a cooldown', () => {
    const r = runGame(mod, 2, { time: 10 }, (id, _s, t) => ({ x: 1, y: 0, b: BTN.B | (id === 'p1' && Math.floor(t * 30) % 2 ? BTN.A : 0) }), 6);
    expect(r.fx.filter((k) => k === 'swing' || k === 'kick').length).toBeLessThan(6 / 0.35 + 2);
  });
});

describe('air hockey', () => {
  const mod = GAMES.hockey;
  // attacker: line up behind the puck (staying back), then charge through it so it flies into the goal
  const attacker = (team: 0 | 1) => (id: string, snap: any) => {
    const me = snap.p.find((p: any) => p.id === id), puck = snap.b[0];
    const dir = team === 0 ? 1 : -1;
    const behind = (puck.x - me.x) * dir; // > 0: the puck is in front of me
    const aligned = Math.abs(me.y - puck.y) < 22;
    const target = behind > 30 && aligned ? { x: puck.x + dir * 200, y: puck.y } : { x: puck.x - dir * 140, y: puck.y };
    const dx = target.x - me.x, dy = target.y - me.y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d, b: 0 };
  };
  const idle = () => ({ x: 0, y: 0, b: 0 });

  it('mallets stay in their own half and inside the table, the puck stays in play, goals end the match', () => {
    let maxXTeam0 = -1e9, minXTeam1 = 1e9, maxY = 0;
    const r = runGame(mod, 2, { goals: 3 }, (id, s) => {
      for (const p of s.p) { maxY = Math.max(maxY, Math.abs(p.y)); if (p.tm === 0) maxXTeam0 = Math.max(maxXTeam0, p.x); else minXTeam1 = Math.min(minXTeam1, p.x); }
      return id === 'p1' ? attacker(0)(id, s) : { x: -1, y: Math.sin(s.t * 3), b: 0 }; // p2 pushes towards the centre line (right side: team 1 sits at x > 0)
    }, 150);
    expect(maxXTeam0).toBeLessThan(0);
    expect(minXTeam1).toBeGreaterThan(0);
    expect(maxY).toBeLessThanOrEqual(290);
    expect(r.over).toBe(true);
    expect(r.fx).toContain('hit');
  });

  it('an attacker scores, the scoring team wins and the final score is reported per player', () => {
    const r = runGame(mod, 2, { goals: 3 }, (id, s) => (id === 'p1' ? attacker(0)(id, s) : { x: 0, y: 1, b: 0 }), 150); // the defender steps aside
    const st = r.game.standings();
    expect(r.fx).toContain('goal');
    expect(st[0].playerId).toBe('p1');
    expect(st[0].score).toBeGreaterThanOrEqual(1);
    expect((r.game.snapshot() as any).sc[0]).toBeGreaterThanOrEqual(1);
  });

  it('SMASH boosts speed briefly and has a cooldown; 2v2 works', () => {
    const r = runGame(mod, 4, { goals: 10 }, (id, _s, t) => ({ x: 1, y: 0, b: id === 'p1' && Math.floor(t * 8) % 2 ? BTN.A : 0 }), 10);
    const smashes = r.fx.filter((k) => k === 'smash').length;
    expect(smashes).toBeGreaterThanOrEqual(2);
    expect(smashes).toBeLessThanOrEqual(4); // 3 s cooldown over 10 s
    expect((r.game.snapshot() as any).p).toHaveLength(4);
  });

  it('a 0-0 game goes to sudden death and the next goal (or the clock) ends it', () => {
    const r = runGame(mod, 2, { goals: 7, time: 1 }, idle, 100); // 0-0 after 1 s, before the stall breaker can nudge the puck
    expect(r.fx).toContain('overtime');
    expect(r.over).toBe(true);
    const st = r.game.standings();
    expect(st).toHaveLength(2);
    // either someone scored in sudden death (team result differs) or it ran out (draw: same place)
    const sc = (r.game.snapshot() as any).sc;
    if (sc[0] === sc[1]) expect(st[0].tie).toBe(st[1].tie); else expect(st[0].tie).not.toBe(st[1].tie);
  });
});
