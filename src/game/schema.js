import { z } from 'zod';
import { BASE_SPEED, MAX_SPEED, MAX_ACTIVE_ITEMS, SCENE_HEIGHT } from './constants.js';

export const ActiveItemSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.literal('shield'),
  name: z.string().min(1).max(50),
  icon: z.string().min(1).max(10),
  timeLeft: z.number().positive().optional(),
});

export const ObstacleSchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().min(-300).max(3000),
  width: z.number().min(10).max(200),
  height: z.number().min(10).max(200),
  type: z.enum(['single', 'tall', 'double']),
});

export const CollectibleSchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().min(-300).max(3000),
  y: z.number().min(0).max(SCENE_HEIGHT),
  width: z.number().min(10).max(100),
  height: z.number().min(10).max(100),
  type: z.literal('shield'),
  name: z.string().min(1).max(50),
  icon: z.string().min(1).max(10),
});

export const PlayerSchema = z.object({
  y: z.number().min(0).max(SCENE_HEIGHT),
  vy: z.number().min(-2500).max(2500),
  isJumping: z.boolean(),
});

export const GameStateSchema = z.object({
  status: z.enum(['ready', 'running', 'paused', 'gameover']),
  score: z.number().min(0).max(99999),
  record: z.number().min(0).max(99999),
  speed: z
    .number()
    .min(BASE_SPEED - 1)
    .max(MAX_SPEED + 50),
  playerName: z.string().trim().min(1).max(30),
  player: PlayerSchema,
  obstacles: z.array(ObstacleSchema),
  collectibles: z.array(CollectibleSchema),
  activeItems: z.array(ActiveItemSchema).max(MAX_ACTIVE_ITEMS),
  spawnTimer: z.number().min(0).max(60),
  nextSpawnInterval: z.number().min(0.5).max(10),
  recordAtStart: z.number().min(0).max(99999),
  hasFiredRecordConfettiThisRun: z.boolean(),
  savedAt: z.number().min(1700000000000).max(2500000000000),
});
