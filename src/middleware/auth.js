import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const jwksUrl = new URL(`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/certs`);
const jwks = createRemoteJWKSet(jwksUrl);

function extractRoles(payload) {
  const realmRoles = payload.realm_access?.roles ?? [];
  const clientRoles = payload.resource_access?.[env.KEYCLOAK_ROLE_CLIENT_ID]?.roles ?? [];
  return [...new Set([...realmRoles, ...clientRoles])];
}

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new HttpError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ');

    const { payload } = await jwtVerify(match[1], jwks, {
      issuer: env.KEYCLOAK_ISSUER,
      audience: env.KEYCLOAK_AUDIENCE,
      algorithms: ['RS256'],
    });

    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new HttpError(401, 'INVALID_TOKEN', 'Access token ไม่มี subject ที่ถูกต้อง');
    }

    req.user = {
      id: payload.sub,
      name: payload.given_name || payload.preferred_username || payload.email || payload.sub,
      username: payload.preferred_username || null,
      roles: extractRoles(payload),
      claims: payload,
    };
    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    return next(new HttpError(401, 'INVALID_TOKEN', 'Access token ไม่ถูกต้อง หมดอายุ หรือไม่ตรงกับ issuer/audience'));
  }
}

export function authenticateApiKeyOrBearer(req, res, next) {
  const providedKey = req.headers['x-api-key'];
  if (providedKey !== undefined) {
    if (!env.CBEVENT_API_KEY) return next(new HttpError(401, 'INVALID_API_KEY', 'API Key authentication is not configured'));
    const provided = Buffer.from(String(providedKey));
    const expected = Buffer.from(env.CBEVENT_API_KEY);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return next(new HttpError(401, 'INVALID_API_KEY', 'Invalid API Key'));
    req.user = { id: 'cbevent-service', name: 'cbevent', username: 'cbevent', roles: [roles.checker], claims: { auth_type: 'api_key', client: 'cbevent' } };
    return next();
  }
  return authenticate(req, res, next);
}

export function requireAnyRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ'));
    if (!allowedRoles.some((role) => req.user.roles.includes(role))) {
      return next(new HttpError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้'));
    }
    next();
  };
}

export const roles = Object.freeze({
  viewer: 'pmfilter-viewer',
  editor: 'pmfilter-editor',
  admin: 'pmfilter-admin',
  checker: 'pmfilter-checker',
});
