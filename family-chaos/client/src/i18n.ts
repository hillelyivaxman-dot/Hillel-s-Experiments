import { createContext, useContext } from 'react';
import type { L10n } from '../../shared/catalog';
import type { Lang } from '../../shared/protocol';

const S = {
  tagline: { he: 'המסך הגדול הוא הזירה. הטלפונים הם השלטים.', en: 'The big screen is the arena. Phones are the controllers.' },
  sub: { he: 'משחקי מסיבה חינמיים למשפחה ולחברים — בלי התקנה, בלי הרשמה.', en: 'Free party games for family & friends — no install, no sign-up.' },
  host: { he: 'פתח חדר על המסך הזה', en: 'Host on this screen' },
  joinPhone: { he: 'הצטרף מהטלפון', en: 'Join from phone' },
  library: { he: 'ספריית המשחקים', en: 'Game library' },
  all: { he: 'הכל', en: 'All' },
  playable: { he: 'מוכן לשחק', en: 'Playable' },
  soon: { he: 'בקרוב', en: 'Coming soon' },
  players: { he: 'שחקנים', en: 'players' },
  howItWorks: { he: 'איך זה עובד?', en: 'How it works' },
  step1: { he: 'פותחים חדר על המחשב או הטלוויזיה', en: 'Open a room on a PC or TV' },
  step2: { he: 'כולם סורקים את ה־QR בטלפון', en: 'Everyone scans the QR code' },
  step3: { he: 'בוחרים משחק ומשחקים!', en: 'Pick a game and play!' },
  scanToJoin: { he: 'סרקו כדי להצטרף', en: 'Scan to join' },
  orGoTo: { he: 'או היכנסו ל־', en: 'or go to' },
  code: { he: 'קוד חדר', en: 'Room code' },
  waitingPlayers: { he: 'מחכים לשחקנים…', en: 'Waiting for players…' },
  emptySlot: { he: 'מקום פנוי', en: 'Open slot' },
  start: { he: 'יאללה, מתחילים!', en: "Let's go!" },
  needPlayers: { he: 'צריך לפחות {n} שחקנים', en: 'Need at least {n} players' },
  chooseGame: { he: 'בחרו משחק', en: 'Choose a game' },
  ready: { he: 'מוכן!', en: 'Ready!' },
  notReady: { he: 'אני מוכן', en: "I'm ready" },
  leader: { he: 'מנהל החדר', en: 'Room leader' },
  kick: { he: 'הוצא', en: 'Kick' },
  makeLeader: { he: 'הפוך למנהל', en: 'Make leader' },
  pause: { he: 'השהה', en: 'Pause' },
  resume: { he: 'המשך', en: 'Resume' },
  endRound: { he: 'סיים סיבוב', en: 'End round' },
  paused: { he: 'הפסקה', en: 'Paused' },
  backToLobby: { he: 'חזרה ללובי', en: 'Back to lobby' },
  playAgain: { he: 'עוד סיבוב!', en: 'Play again!' },
  results: { he: 'תוצאות', en: 'Results' },
  sessionStars: { he: 'כוכבי הערב', en: "Tonight's stars" },
  go: { he: 'צא!', en: 'GO!' },
  join: { he: 'הצטרפות', en: 'Join' },
  yourName: { he: 'הכינוי שלך', en: 'Your nickname' },
  pickCritter: { he: 'בחרו דמות', en: 'Pick your critter' },
  enter: { he: 'כניסה למשחק', en: 'Enter game' },
  password: { he: 'סיסמת חדר', en: 'Room password' },
  waitHost: { he: 'מחכים שהמארח יתחיל…', en: 'Waiting for the host to start…' },
  selected: { he: 'נבחר', en: 'Selected' },
  leave: { he: 'יציאה', en: 'Leave' },
  change: { he: 'החלף', en: 'Change' },
  report: { he: 'דווח על כינוי פוגעני', en: 'Report offensive name' },
  reported: { he: 'הדיווח נשלח', en: 'Report sent' },
  kicked: { he: 'הוצאת מהחדר.', en: 'You were removed from the room.' },
  connecting: { he: 'מתחבר…', en: 'Connecting…' },
  reconnecting: { he: 'החיבור נפל — מתחבר מחדש…', en: 'Connection lost — reconnecting…' },
  watchScreen: { he: 'הסתכלו על המסך הגדול!', en: 'Look at the big screen!' },
  youWon: { he: 'ניצחת!', en: 'You won!' },
  place: { he: 'מקום', en: 'Place' },
  settings: { he: 'הגדרות', en: 'Settings' },
  sound: { he: 'צלילים', en: 'Sound' },
  motion: { he: 'אנימציות', en: 'Animations' },
  reduced: { he: 'מופחתות', en: 'Reduced' },
  full: { he: 'מלאות', en: 'Full' },
  on: { he: 'פועל', en: 'On' },
  off: { he: 'כבוי', en: 'Off' },
  maxPlayers: { he: 'מקסימום שחקנים', en: 'Max players' },
  roomPassword: { he: 'סיסמה לחדר (לא חובה)', en: 'Room password (optional)' },
  save: { he: 'שמור', en: 'Save' },
  remoteTip: { he: 'משחקים מרחוק? שלחו את קישור הצפייה כדי שכולם יראו את המסך.', en: 'Playing remotely? Share the watch link so everyone sees the screen.' },
  watchLink: { he: 'קישור צפייה', en: 'Watch link' },
  copy: { he: 'העתק', en: 'Copy' },
  copied: { he: 'הועתק!', en: 'Copied!' },
  errors_no_room: { he: 'החדר לא נמצא. בדקו את הקוד.', en: 'Room not found. Check the code.' },
  errors_bad_password: { he: 'סיסמה שגויה.', en: 'Wrong password.' },
  errors_room_full: { he: 'החדר מלא.', en: 'The room is full.' },
  errors_bad_name: { he: 'הכינוי לא תקין. נסו כינוי אחר.', en: 'That nickname is not allowed. Try another.' },
  errors_not_allowed: { he: 'הפעולה אינה מורשית.', en: 'Not allowed.' },
  errors_rate_limited: { he: 'יותר מדי ניסיונות. חכו רגע.', en: 'Too many attempts. Wait a moment.' },
  errors_in_game: { he: 'משחק כבר רץ.', en: 'A game is already running.' },
  errors_too_many_rooms: { he: 'השרת עמוס. נסו שוב בעוד רגע.', en: 'Server is busy. Try again shortly.' },
  errors_bad_message: { he: 'שגיאה.', en: 'Error.' },
  tiltHint: { he: 'סובבו את הטלפון לרוחב לשליטה נוחה', en: 'Rotate your phone sideways for comfy controls' },
  privacy: { he: 'אין צ׳אט פתוח. לא נאסף מידע אישי. אורחים משחקים בלי חשבון.', en: 'No open chat. No personal data collected. Guests play without an account.' },
  lives: { he: 'חיים', en: 'Lives' },
  lap: { he: 'הקפה', en: 'Lap' },
  round: { he: 'סבב', en: 'Round' },
  score: { he: 'ניקוד', en: 'Score' },
  youHaveBomb: { he: 'הפצצה אצלך! תעביר!', en: 'YOU HAVE THE BOMB! Pass it!' },
  youreOut: { he: 'בום! אתה בחוץ — צפה בסוף', en: "Boom! You're out — watch the finish" },
  early: { he: 'מוקדם מדי! −1', en: 'Too early! −1' },
  waitGreen: { he: 'חכו לירוק על המסך…', en: 'Wait for green on screen…' },
  dashReady: { he: 'הסתערות מוכנה', en: 'Dash ready' },
  item: { he: 'פריט', en: 'Item' },
  finished: { he: 'סיימת!', en: 'Finished!' },
  hostControls: { he: 'אתה מנהל החדר — אפשר לשלוט מכאן', en: "You're the room leader — control from here" },
};

export type Key = keyof typeof S;

export const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'he', setLang: () => {} });

export function useT() {
  const { lang } = useContext(LangCtx);
  const t = (k: Key, vars?: Record<string, string | number>) => {
    let s = S[k][lang];
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, String(b));
    return s;
  };
  const l = (x: L10n) => x[lang];
  return { t, l, lang };
}

export function initialLang(): Lang {
  try {
    const s = localStorage.getItem('fc.lang');
    if (s === 'he' || s === 'en') return s;
  } catch { /* storage blocked */ }
  return navigator.language?.startsWith('he') || navigator.language?.startsWith('iw') ? 'he' : 'en';
}
