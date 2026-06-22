import { accountImportRowSchema, type AccountImportPreview, type AccountImportRow } from './accountBulk.schema';

const REQUIRED_COLUMNS = ['email', 'displayName', 'role'] as const;
const OPTIONAL_COLUMNS = ['facilityCode', 'phone', 'externalReference'] as const;
const EXPORT_COLUMNS = [
  'id',
  'email',
  'displayName',
  'role',
  'status',
  'facilityId',
  'createdAt',
  'updatedAt',
] as const;

export function parseAccountCsv(csvText: string): Record<string, string>[] {
  const rows = parseCsv(csvText.trim());
  if (rows.length === 0) return [];

  const [headers, ...dataRows] = rows;
  const normalizedHeaders = headers.map((header) => header.trim());

  return dataRows
    .filter((cells) => cells.some((cell) => cell.trim().length > 0))
    .map((cells) => {
      const row: Record<string, string> = {};
      normalizedHeaders.forEach((header, index) => {
        row[header] = (cells[index] ?? '').trim();
      });
      return row;
    });
}

export function buildAccountImportPreview(csvText: string): AccountImportPreview {
  const parsedRows = parseAccountCsv(csvText);
  const issues: AccountImportPreview['issues'] = [];
  const normalizedRows: AccountImportRow[] = [];
  const seen = new Map<string, number[]>();

  parsedRows.forEach((row, index) => {
    const rowNumber = index + 2;

    for (const column of REQUIRED_COLUMNS) {
      if (!Object.prototype.hasOwnProperty.call(row, column) || row[column].trim() === '') {
        issues.push({
          rowNumber,
          field: column,
          code: 'REQUIRED_COLUMN_MISSING',
          message: `Missing required column value: ${column}`,
        });
      }
    }

    const candidate = {
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      facilityCode: nullable(row.facilityCode),
      phone: nullable(row.phone),
      externalReference: nullable(row.externalReference),
    };

    const parsed = accountImportRowSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          rowNumber,
          field: issue.path.join('.') || undefined,
          code: issue.code,
          message: issue.message,
        });
      }
      return;
    }

    const emailKey = parsed.data.email.toLowerCase();
    seen.set(emailKey, [...(seen.get(emailKey) ?? []), rowNumber]);
    normalizedRows.push({ ...parsed.data, email: emailKey });
  });

  const duplicateEmails = [...seen.entries()]
    .filter(([, rowNumbers]) => rowNumbers.length > 1)
    .map(([email]) => email);

  for (const email of duplicateEmails) {
    for (const rowNumber of seen.get(email) ?? []) {
      issues.push({
        rowNumber,
        field: 'email',
        code: 'DUPLICATE_EMAIL_IN_FILE',
        message: `Duplicate email in import file: ${email}`,
      });
    }
  }

  const validRows = normalizedRows.filter((row) => !duplicateEmails.includes(row.email));

  return {
    totalRows: parsedRows.length,
    validRows: validRows.length,
    invalidRows: parsedRows.length - validRows.length,
    duplicateEmails,
    issues,
    normalizedRows: validRows,
  };
}

export function accountImportTemplateCsv(): string {
  return [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].join(',') + '\n';
}

export function exportAccountsCsv(accounts: Array<Record<string, unknown>>): string {
  const lines = [EXPORT_COLUMNS.join(',')];

  for (const account of accounts) {
    lines.push(
      EXPORT_COLUMNS.map((column) => escapeCsvCell(formatCell(account[column]))).join(','),
    );
  }

  return lines.join('\n') + '\n';
}

function nullable(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function formatCell(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}
