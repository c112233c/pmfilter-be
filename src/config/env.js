import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().min(1).default('tdms_pmfilter'),
  DB_USER: z.string().min(1).default('pmfilter_app'),
  DB_PASSWORD: z.string().default(''),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  KEYCLOAK_URL: z.string().url().default('https://sso.pealive.com:8081'),
  KEYCLOAK_REALM: z.string().min(1).default('OMD'),
  KEYCLOAK_AUDIENCE: z.string().min(1).default('pmfilter-fe'),
  KEYCLOAK_ROLE_CLIENT_ID: z.string().default('pmfilter-fe'),
  CBEVENT_API_KEY: z.string().default('').refine((value) => !value || value.length >= 32, 'CBEVENT_API_KEY must be at least 32 characters when configured'),
  MAX_PAGE_SIZE: z.coerce.number().int().min(1).max(500).default(100),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;
export const env = Object.freeze({
  ...raw,
  CORS_ORIGINS: raw.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  KEYCLOAK_ISSUER: `${raw.KEYCLOAK_URL.replace(/\/$/, '')}/realms/${raw.KEYCLOAK_REALM}`,
});
