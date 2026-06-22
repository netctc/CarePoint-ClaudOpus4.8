import jwt from 'jsonwebtoken';
import { env } from './env';

export type AccessTokenPayload = {
  sub: string;
  role: string;
  organizationId?: string;
};

const accessTokenTtl: jwt.SignOptions['expiresIn'] = env.jwtAccessTtl as jwt.SignOptions['expiresIn'];
const refreshTokenTtl: jwt.SignOptions['expiresIn'] = env.jwtRefreshTtl as jwt.SignOptions['expiresIn'];

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.jwtAccessSecret as jwt.Secret, {
    expiresIn: accessTokenTtl,
  });
}

export function signRefreshToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.jwtRefreshSecret as jwt.Secret, {
    expiresIn: refreshTokenTtl,
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtAccessSecret as jwt.Secret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.jwtRefreshSecret as jwt.Secret) as AccessTokenPayload;
}
