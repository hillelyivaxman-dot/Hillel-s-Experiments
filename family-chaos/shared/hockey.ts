// Air hockey table constants shared by the server (rules) and the screen (drawing).
export const HOCKEY = {
  HW: 520, HH: 290, GOAL_HALF: 120, // half table size, half goal-mouth width
  PUCK_R: 24, MALLET_R: 42,
  MAXV: 640, ACC: 7500, BOOST_K: 1.6, BOOST_T: 0.35, BOOST_CD: 3,
  PUCK_KEEP: 0.78, WALL_E: 0.96, PUCK_MAX: 1500,
  WIN_GOALS: 7, MAX_TIME: 150, SUDDEN: 30, SERVE_PAUSE: 1.6,
} as const;
