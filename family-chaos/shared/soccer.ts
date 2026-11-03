// Soccer pitch constants shared by the server (rules) and the screen (drawing).
export const SOCCER = {
  HW: 600, HH: 350, GOAL_HALF: 115, GOAL_DEPTH: 70, // pitch half-size, goal mouth half-width, net depth
  PLAYER_R: 28, BALL_R: 16, POST_R: 9,
  ACC: 1150, KEEP: 0.1, SPRINT_K: 1.55, STAMINA_USE: 45, STAMINA_REGEN: 22,
  KICK_V: 820, KICK_REACH: 70, KICK_CD: 0.35,
  BALL_KEEP: 0.5, CELEBRATE: 2.6, OT: 30, MERCY: 8,
} as const;
