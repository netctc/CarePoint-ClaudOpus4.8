import { z } from 'zod';

export const accountBulkOperationSchema = z.enum([
  'DEACTIVATE',
  'REACTIVATE',
  'LOCK',
  'UNLOCK',
]);

export type AccountBulkOperation = z.infer<typeof accountBulkOperationSchema>;

export const accountBulkStatusRequestSchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1).max(500),
  operation: accountBulkOperationSchema,
  reason: z.string().trim().min(8).max(800),
  facilityId: z.string().trim().min(1).optional().nullable(),
});

export type AccountBulkStatusRequest = z.infer<typeof accountBulkStatusRequestSchema>;

export const accountImportRowSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(2).max(160),
  role: z.string().trim().min(2).max(80),
  facilityCode: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  externalReference: z.string().trim().max(120).optional().nullable(),
});

export type AccountImportRow = z.infer<typeof accountImportRowSchema>;

export const accountImportPreviewRequestSchema = z.object({
  csvText: z.string().min(1).max(1_500_000),
  dryRun: z.boolean().default(true),
  facilityId: z.string().trim().min(1).optional().nullable(),
});

export const accountImportCommitRequestSchema = z.object({
  csvText: z.string().min(1).max(1_500_000),
  idempotencyKey: z.string().trim().min(12).max(120),
  facilityId: z.string().trim().min(1).optional().nullable(),
  reason: z.string().trim().min(8).max(800),
});

export type AccountImportPreviewRequest = z.infer<typeof accountImportPreviewRequestSchema>;
export type AccountImportCommitRequest = z.infer<typeof accountImportCommitRequestSchema>;

export type AccountImportValidationIssue = {
  rowNumber: number;
  field?: string;
  code: string;
  message: string;
};

export type AccountImportPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateEmails: string[];
  issues: AccountImportValidationIssue[];
  normalizedRows: AccountImportRow[];
};
