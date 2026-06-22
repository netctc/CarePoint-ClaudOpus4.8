import { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../lib/http';

export function allowRoles(roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(forbidden('Role is not allowed to access this resource'));
    }

    next();
  };
}
