import { StatusCodes } from 'http-status-codes';

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(message = 'Resource not found') {
  return new HttpError(StatusCodes.NOT_FOUND, message);
}

export function forbidden(message = 'Forbidden') {
  return new HttpError(StatusCodes.FORBIDDEN, message);
}

export function unauthorized(message = 'Unauthorized') {
  return new HttpError(StatusCodes.UNAUTHORIZED, message);
}

export function badRequest(message = 'Bad request', details?: unknown) {
  return new HttpError(StatusCodes.BAD_REQUEST, message, details);
}

export function serviceUnavailable(message = 'Service unavailable', details?: unknown) {
  return new HttpError(StatusCodes.SERVICE_UNAVAILABLE, message, details);
}
