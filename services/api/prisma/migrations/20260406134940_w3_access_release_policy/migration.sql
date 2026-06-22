/*
  Warnings:

  - You are about to drop the column `data` on the `PolicyTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `PolicyTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `PolicyTemplate` table. All the data in the column will be lost.
  - The `status` column on the `PolicyTemplate` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Campaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ClinicalOrder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CoverageRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FacilitySetting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IntegrationConnection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LabWorkItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ModerationCase` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PatientCarePlanItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PatientConsentRecord` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PatientFamilyProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PatientNotificationItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PatientReminderPlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PatientRpmProgram` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PatientSupportTicket` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PrescriptionDraft` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PricingRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProviderAlert` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProviderOnboardingState` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProviderScheduleTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReportDefinition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RpmEnrollment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SafetyCase` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceCatalogItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SupportWorkItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[code]` on the table `PolicyTemplate` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `country` to the `PolicyTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `policyArea` to the `PolicyTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `templateName` to the `PolicyTemplate` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MfaStatus" AS ENUM ('ENABLED', 'PENDING', 'BYPASSED');

-- CreateEnum
CREATE TYPE "AccessReviewStatus" AS ENUM ('DUE', 'CERTIFIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PhiScope" AS ENUM ('FULL', 'LIMITED', 'BILLING_ONLY', 'CLINICAL_SUMMARY');

-- CreateEnum
CREATE TYPE "PolicyTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReleaseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReleasePurpose" AS ENUM ('CARE_CONTINUITY', 'INSURANCE', 'EMPLOYER', 'LEGAL', 'PATIENT_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('INSURER', 'EMPLOYER', 'LEGAL', 'PATIENT', 'PROVIDER', 'OTHER');

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ClinicalOrder" DROP CONSTRAINT "ClinicalOrder_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "CoverageRule" DROP CONSTRAINT "CoverageRule_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "FacilitySetting" DROP CONSTRAINT "FacilitySetting_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "IntegrationConnection" DROP CONSTRAINT "IntegrationConnection_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "LabWorkItem" DROP CONSTRAINT "LabWorkItem_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ModerationCase" DROP CONSTRAINT "ModerationCase_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PatientCarePlanItem" DROP CONSTRAINT "PatientCarePlanItem_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PatientConsentRecord" DROP CONSTRAINT "PatientConsentRecord_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PatientFamilyProfile" DROP CONSTRAINT "PatientFamilyProfile_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PatientNotificationItem" DROP CONSTRAINT "PatientNotificationItem_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PatientReminderPlan" DROP CONSTRAINT "PatientReminderPlan_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PatientRpmProgram" DROP CONSTRAINT "PatientRpmProgram_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PatientSupportTicket" DROP CONSTRAINT "PatientSupportTicket_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PolicyTemplate" DROP CONSTRAINT "PolicyTemplate_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PrescriptionDraft" DROP CONSTRAINT "PrescriptionDraft_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PricingRule" DROP CONSTRAINT "PricingRule_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ProviderAlert" DROP CONSTRAINT "ProviderAlert_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ProviderOnboardingState" DROP CONSTRAINT "ProviderOnboardingState_lastActorId_fkey";

-- DropForeignKey
ALTER TABLE "ProviderOnboardingState" DROP CONSTRAINT "ProviderOnboardingState_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ProviderOnboardingState" DROP CONSTRAINT "ProviderOnboardingState_providerId_fkey";

-- DropForeignKey
ALTER TABLE "ProviderScheduleTemplate" DROP CONSTRAINT "ProviderScheduleTemplate_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ReportDefinition" DROP CONSTRAINT "ReportDefinition_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "RpmEnrollment" DROP CONSTRAINT "RpmEnrollment_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "SafetyCase" DROP CONSTRAINT "SafetyCase_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceCatalogItem" DROP CONSTRAINT "ServiceCatalogItem_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "SupportWorkItem" DROP CONSTRAINT "SupportWorkItem_organizationId_fkey";

-- DropIndex
DROP INDEX "PolicyTemplate_organizationId_code_key";

-- AlterTable
ALTER TABLE "PolicyTemplate" DROP COLUMN "data",
DROP COLUMN "name",
DROP COLUMN "organizationId",
ADD COLUMN     "body" TEXT,
ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "phiScope" "PhiScope" NOT NULL DEFAULT 'LIMITED',
ADD COLUMN     "policyArea" TEXT NOT NULL,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "requiresConsent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "templateName" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "PolicyTemplateStatus" NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "version" DROP DEFAULT,
ALTER COLUMN "version" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "Campaign";

-- DropTable
DROP TABLE "ClinicalOrder";

-- DropTable
DROP TABLE "CoverageRule";

-- DropTable
DROP TABLE "FacilitySetting";

-- DropTable
DROP TABLE "IntegrationConnection";

-- DropTable
DROP TABLE "LabWorkItem";

-- DropTable
DROP TABLE "ModerationCase";

-- DropTable
DROP TABLE "PatientCarePlanItem";

-- DropTable
DROP TABLE "PatientConsentRecord";

-- DropTable
DROP TABLE "PatientFamilyProfile";

-- DropTable
DROP TABLE "PatientNotificationItem";

-- DropTable
DROP TABLE "PatientReminderPlan";

-- DropTable
DROP TABLE "PatientRpmProgram";

-- DropTable
DROP TABLE "PatientSupportTicket";

-- DropTable
DROP TABLE "PrescriptionDraft";

-- DropTable
DROP TABLE "PricingRule";

-- DropTable
DROP TABLE "ProviderAlert";

-- DropTable
DROP TABLE "ProviderOnboardingState";

-- DropTable
DROP TABLE "ProviderScheduleTemplate";

-- DropTable
DROP TABLE "ReportDefinition";

-- DropTable
DROP TABLE "RpmEnrollment";

-- DropTable
DROP TABLE "SafetyCase";

-- DropTable
DROP TABLE "ServiceCatalogItem";

-- DropTable
DROP TABLE "SupportWorkItem";

-- DropEnum
DROP TYPE "ProviderOnboardingStatus";

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "grantScope" TEXT NOT NULL DEFAULT 'Organization',
    "mfaStatus" "MfaStatus" NOT NULL DEFAULT 'PENDING',
    "accessReviewStatus" "AccessReviewStatus" NOT NULL DEFAULT 'DUE',
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "patientId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientType" "RecipientType" NOT NULL DEFAULT 'OTHER',
    "recipientContact" TEXT,
    "purpose" "ReleasePurpose" NOT NULL,
    "phiScope" "PhiScope" NOT NULL,
    "templateId" TEXT,
    "notes" TEXT,
    "status" "ReleaseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_idx" ON "RoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "RoleAssignment_role_idx" ON "RoleAssignment"("role");

-- CreateIndex
CREATE INDEX "RoleAssignment_deactivatedAt_idx" ON "RoleAssignment"("deactivatedAt");

-- CreateIndex
CREATE INDEX "ReleaseRequest_patientId_idx" ON "ReleaseRequest"("patientId");

-- CreateIndex
CREATE INDEX "ReleaseRequest_status_idx" ON "ReleaseRequest"("status");

-- CreateIndex
CREATE INDEX "ReleaseRequest_organizationId_idx" ON "ReleaseRequest"("organizationId");

-- CreateIndex
CREATE INDEX "ReleaseRequest_requestedByUserId_idx" ON "ReleaseRequest"("requestedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyTemplate_code_key" ON "PolicyTemplate"("code");

-- CreateIndex
CREATE INDEX "PolicyTemplate_status_idx" ON "PolicyTemplate"("status");

-- CreateIndex
CREATE INDEX "PolicyTemplate_policyArea_idx" ON "PolicyTemplate"("policyArea");

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseRequest" ADD CONSTRAINT "ReleaseRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseRequest" ADD CONSTRAINT "ReleaseRequest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PolicyTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
