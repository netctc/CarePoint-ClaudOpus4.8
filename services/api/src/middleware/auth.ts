import { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../lib/http';
import { verifyAccessToken } from '../lib/jwt';

export type RequestUser = {
  userId: string;
  role: string;
  organizationId?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      io?: import('socket.io').Server;
    }
  }
}

function extractBearerToken(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  if (typeof req.cookies?.accessToken === 'string') {
    return req.cookies.accessToken;
  }
  return null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return next(unauthorized('Missing access token'));
    }

    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub,
      role: payload.role,
      organizationId: payload.organizationId,
    };

    next();
  } catch {
    return next(unauthorized('Invalid access token'));
  }
}
