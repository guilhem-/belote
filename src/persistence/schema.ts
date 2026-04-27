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
  /** Cadence dédiée à la phase d'enchère (par défaut 1s, plus rapide que paceMs). */
  bidPaceMs: z.number().int().min(100).max(5000).default(1000),
  endMode: z.enum(['points', 'deals']),
  targetPoints: z.union([z.literal(501), z.literal(1000), z.literal(1501)]),
  targetDeals: z.number().int().min(1).max(50),
  beloteEnabled: z.boolean(),
  /** Disposition des cartes du pli : en croix géographique (défaut) ou en ligne. */
  trickLayout: z.enum(['cross', 'inline']).default('cross'),
  /** Joue automatiquement la carte humaine quand il n'en reste qu'une légale. */
  autoPlayLastCard: z.boolean().default(true),
  /** Lance automatiquement la donne suivante quand la précédente se termine. */
  autoNextDeal: z.boolean().default(true),
});

export type Settings = z.infer<typeof SettingsSchemaV1>;

export const DEFAULT_SETTINGS_V1: Settings = {
  version: 1,
  humans: ['S'],
  aiLevels: { N: 4, E: 4, W: 4 },
  paceMs: 4000,
  bidPaceMs: 1000,
  endMode: 'points',
  targetPoints: 501,
  targetDeals: 4,
  beloteEnabled: true,
  trickLayout: 'cross',
  autoPlayLastCard: true,
  autoNextDeal: true,
};
