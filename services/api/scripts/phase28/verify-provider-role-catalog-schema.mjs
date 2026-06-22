import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function hasTable(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function hasColumn(tableName, columnName) {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function countRows(tableName) {
  if (tableName === 'ProviderRoleCatalog') {
    const rows = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "ProviderRoleCatalog"`;
    return Number(rows[0]?.count ?? 0);
  }
  return 0;
}

async function main() {
  const providerRoleCatalogTable = await hasTable('ProviderRoleCatalog');
  const roleCatalogIdColumn = await hasColumn('ProviderProfile', 'roleCatalogId');
  const seedCount = providerRoleCatalogTable ? await countRows('ProviderRoleCatalog') : 0;

  const issues = [];
  if (!providerRoleCatalogTable) issues.push('Missing table: ProviderRoleCatalog');
  if (!roleCatalogIdColumn) issues.push('Missing column: ProviderProfile.roleCatalogId');
  if (providerRoleCatalogTable && seedCount < 4) issues.push(`ProviderRoleCatalog seed rows look incomplete: ${seedCount}`);

  console.log(JSON.stringify({
    status: issues.length === 0 ? 'READY' : 'NEEDS_REPAIR',
    checks: {
      providerRoleCatalogTable,
      roleCatalogIdColumn,
      providerRoleCatalogRows: seedCount,
    },
    issues,
  }, null, 2));

  if (issues.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      status: 'CHECK_FAILED',
      message: error?.message ?? String(error),
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
