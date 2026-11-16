import { z } from 'zod';

/**
 * Single source of truth for environment variables.
 * Validated once at bootstrap: if anything is missing or malformed the app refuses to start
 * (fail fast) instead of failing later in the middle of a request.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type Env = z.infer<typeof envSchema>;
