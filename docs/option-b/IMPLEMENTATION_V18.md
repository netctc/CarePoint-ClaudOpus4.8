# Implementación V18 - Schema migration rehearsal y backup restore drill

V18 añade dos gates operativos antes de incrementar canary en la opción B.

## Nuevos job types

- `platform.schema_migration_rehearsal`: valida evidencia sanitizada de rehearsals de migración, drift de schema, rollback plan, backfill plan, `prisma validate` y `migrate status`.
- `platform.backup_restore_drill`: valida metadata de backups y pruebas de restauración para Postgres, Redis y artifact store frente a RPO/RTO.

## Rutas Node bridge

- `POST /api/hybrid-python/platform/schema-migration/rehearsal/prepare`
- `POST /api/hybrid-python/platform/backup-restore/drill/prepare`

## Límites de ownership

Node/Express, Prisma, CI e infraestructura siguen siendo dueños de migraciones, despliegue, datos y rollback. Python solo evalúa metadata sanitizada y genera artefactos advisory.
