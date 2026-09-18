import type { RequestHandler } from 'express';
import { badRequest } from '../lib/http';
import { validateTemporaryPassword } from '../lib/account-password-policy';

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells;
}

function importRows(body: any) {
  if (Array.isArray(body?.rows)) {
    return body.rows as Array<Record<string, unknown>>;
  }

  const csv = String(body?.csv ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!csv) return [] as Array<Record<string, unknown>>;
  const lines = csv.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [] as Array<Record<string, unknown>>;
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

function rowPassword(row: Record<string, unknown>) {
  for (const key of ['password', 'temporaryPassword', 'temporary_password']) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  return undefined;
}

function validateImportPasswords(body: any) {
  const rows = importRows(body);
  if (rows.length === 0) return;
  rows.forEach((row, index) => {
    try {
      validateTemporaryPassword(rowPassword(row), { required: true });
    } catch {
      throw badRequest(`Import row ${index + 2} must include a valid unique temporary password`);
    }
  });
}

function normalizedPath(path: string) {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

export const releaseAccountPasswordPolicy: RequestHandler = (req, _res, next) => {
  try {
    const method = req.method.toUpperCase();
    const path = normalizedPath(req.path);

    if (method === 'POST' && ['/patients', '/providers', '/iam-users'].includes(path)) {
      validateTemporaryPassword(req.body?.password, { required: true });
    } else if (method === 'POST' && path === '/import') {
      validateImportPasswords(req.body);
    } else if (method === 'PUT' && (/^\/patients\/[^/]+$/.test(path) || /^\/providers\/[^/]+$/.test(path))) {
      if (String(req.body?.password ?? '').trim()) {
        validateTemporaryPassword(req.body.password);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
