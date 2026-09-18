import { badRequest } from './http';

export const TEMPORARY_PASSWORD_MIN_LENGTH = 16;
export const TEMPORARY_PASSWORD_MAX_LENGTH = 128;

const forbiddenFragments = ['password', 'changeme', 'carepoint', 'temporary'];

function normalize(value: unknown) {
  return String(value ?? '').trim();
}

export function validateTemporaryPassword(value: unknown, options: { required?: boolean } = {}) {
  const password = normalize(value);
  const required = options.required === true;

  if (!password) {
    if (required) {
      throw badRequest(`An explicit temporary password of at least ${TEMPORARY_PASSWORD_MIN_LENGTH} characters is required`);
    }
    return null;
  }

  if (password.length < TEMPORARY_PASSWORD_MIN_LENGTH || password.length > TEMPORARY_PASSWORD_MAX_LENGTH) {
    throw badRequest(`Temporary password must be between ${TEMPORARY_PASSWORD_MIN_LENGTH} and ${TEMPORARY_PASSWORD_MAX_LENGTH} characters`);
  }

  const lowered = password.toLowerCase();
  if (forbiddenFragments.some((fragment) => lowered.includes(fragment))) {
    throw badRequest('Temporary password must not contain common default or product-name terms');
  }

  return password;
}
