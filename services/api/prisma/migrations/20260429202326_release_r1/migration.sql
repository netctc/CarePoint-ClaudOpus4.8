/*
  Warnings:

  - You are about to drop the `ProviderCredentialPolicy` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProviderCredentialPolicy" DROP CONSTRAINT "ProviderCredentialPolicy_organizationId_fkey";

-- DropTable
DROP TABLE "ProviderCredentialPolicy";
