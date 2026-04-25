import { z } from 'zod';

export const SettingsSchemaV1 = z.object({
  version: z.literal(1),
  humans: z.array(z.enum(['N', 'E', 'S', 'W'])),
  aiLevels: z.object({
    N: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    E: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    S: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    W: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  }),
  paceMs: z.number().int().min(200).max(8000),
  endMode: z.enum(['points', 'deals']),
  targetPoints: z.union([z.literal(501), z.literal(1000), z.literal(1501)]),
  targetDeals: z.number().int().min(1).max(50),
  beloteEnabled: z.boolean(),
});

export type Settings = z.infer<typeof SettingsSchemaV1>;

export const DEFAULT_SETTINGS_V1: Settings = {
  version: 1,
  humans: ['S'],
  aiLevels: { N: 4, E: 4, W: 4 },
  paceMs: 4000,
  endMode: 'points',
  targetPoints: 501,
  targetDeals: 4,
  beloteEnabled: true,
};
