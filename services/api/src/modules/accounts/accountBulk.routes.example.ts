import type { Router } from 'express';
import {
  accountBulkStatusRequestSchema,
  accountImportCommitRequestSchema,
  accountImportPreviewRequestSchema,
} from './accountBulk.schema';
import { exportAccountsCsv } from './accountCsv';
import {
  commitAccountCsvImport,
  previewAccountCsvImport,
  runBulkAccountStatusMutation,
} from './accountBulk.service';

/**
 * Example integration only. Adapt imports and auth context to your existing Admin router.
 */
export function registerAccountBulkRoutes(router: Router, deps: { prisma: any; requireAdmin: any }) {
  router.get('/admin/accounts/export', deps.requireAdmin, async (req: any, res, next) => {
    try {
      const actor = buildActor(req);
      const accounts = await (deps.prisma.account ?? deps.prisma.user).findMany({
        where: {
          organizationId: actor.organizationId,
          ...(req.query.status ? { status: String(req.query.status) } : {}),
          ...(req.query.role ? { role: String(req.query.role) } : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 10_000,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="carepoint-accounts-export.csv"');
      res.status(200).send(exportAccountsCsv(accounts));
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/accounts/bulk/status', deps.requireAdmin, async (req: any, res, next) => {
    try {
      const body = accountBulkStatusRequestSchema.parse(req.body);
      const result = await runBulkAccountStatusMutation(deps.prisma, buildActor(req), body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/accounts/import/preview', deps.requireAdmin, async (req: any, res, next) => {
    try {
      const body = accountImportPreviewRequestSchema.parse(req.body);
      const result = await previewAccountCsvImport(body.csvText);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/accounts/import/commit', deps.requireAdmin, async (req: any, res, next) => {
    try {
      const body = accountImportCommitRequestSchema.parse(req.body);
      const result = await commitAccountCsvImport(deps.prisma, buildActor(req), body);
      res.status(result.committed ? 201 : 422).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/accounts/bulk/jobs/:jobId', deps.requireAdmin, async (req: any, res, next) => {
    try {
      const actor = buildActor(req);
      const job = await deps.prisma.accountBulkJob?.findFirst?.({
        where: { id: req.params.jobId, organizationId: actor.organizationId },
      });
      if (!job) return res.status(404).json({ error: 'Bulk job not found' });
      return res.status(200).json(job);
    } catch (error) {
      next(error);
    }
  });
}

function buildActor(req: any) {
  const user = req.user ?? req.auth?.user ?? {};
  return {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    facilityId: user.facilityId ?? null,
    requestId: req.id ?? req.headers?.['x-request-id'] ?? null,
  };
}
