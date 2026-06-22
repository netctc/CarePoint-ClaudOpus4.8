/*
  Warnings:

  - You are about to drop the column `roleCatalogId` on the `ProviderProfile` table. All the data in the column will be lost.
  - You are about to drop the `AccountBulkJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProviderRoleCatalog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProviderProfile" DROP CONSTRAINT "ProviderProfile_roleCatalogId_fkey";

-- DropForeignKey
ALTER TABLE "ProviderRoleCatalog" DROP CONSTRAINT "ProviderRoleCatalog_organizationId_fkey";

-- AlterTable
ALTER TABLE "ProviderProfile" DROP COLUMN "roleCatalogId";

-- DropTable
DROP TABLE "AccountBulkJob";

-- DropTable
DROP TABLE "ProviderRoleCatalog";

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_organizationId_status_idx" ON "User"("organizationId", "status");
