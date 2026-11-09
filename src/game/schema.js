import { z } from 'zod';
import { BASE_SPEED } from './constants.js';

export const ActiveItemSchema = z.object({
  id: z.string().min(1),
  type: z.literal('shield'),
  name: z.string().min(1),
  icon: z.string().min(1),
  timeLeft: z.number().optional(),
});

export const ObstacleSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  type: z.enum(['single', 'tall', 'double']),
});

export const CollectibleSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number().min(0),
  type: z.literal('shield'),
  name: z.string().min(1),
  icon: z.string().min(1),
});

export const PlayerSchema = z.object({
  y: z.number().min(0).default(0),
  vy: z.number().default(0),
  isJumping: z.boolean().default(false),
});

export const GameStateSchema = z.object({
  status: z.enum(['ready', 'running', 'paused', 'gameover']).default('ready'),
  score: z.number().nonnegative().default(0),
  record: z.number().nonnegative().default(0),
  speed: z.number().positive().default(BASE_SPEED),
  playerName: z.string().max(40).default('Дино'),
  player: PlayerSchema.default(() => ({ y: 0, vy: 0, isJumping: false })),
  obstacles: z.array(ObstacleSchema).default([]),
  collectibles: z.array(CollectibleSchema).default([]),
  activeItems: z.array(ActiveItemSchema).default([]),
  savedAt: z
    .number()
    .nonnegative()
    .default(() => Date.now()),
});
