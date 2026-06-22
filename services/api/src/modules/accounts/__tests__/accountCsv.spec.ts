import { describe, expect, it } from 'vitest';
import { accountImportTemplateCsv, buildAccountImportPreview, exportAccountsCsv } from '../accountCsv';

describe('account CSV import/export helpers', () => {
  it('builds a template with required columns', () => {
    expect(accountImportTemplateCsv()).toContain('email,displayName,role');
  });

  it('validates duplicate emails during preview', () => {
    const csv = [
      'email,displayName,role',
      'doctor@example.test,Doctor One,DOCTOR',
      'doctor@example.test,Doctor One Duplicate,DOCTOR',
    ].join('\n');

    const preview = buildAccountImportPreview(csv);

    expect(preview.totalRows).toBe(2);
    expect(preview.invalidRows).toBe(2);
    expect(preview.duplicateEmails).toEqual(['doctor@example.test']);
  });

  it('escapes exported CSV values safely', () => {
    const csv = exportAccountsCsv([
      {
        id: 'a1',
        email: 'a@example.test',
        displayName: 'Name, With Comma',
        role: 'ADMIN',
        status: 'ACTIVE',
        facilityId: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      },
    ]);

    expect(csv).toContain('"Name, With Comma"');
  });
});
