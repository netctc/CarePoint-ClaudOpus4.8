-- CreateTable
CREATE TABLE "InsuranceProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contactInfo" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoveragePlan" (
    "id" TEXT NOT NULL,
    "insuranceProviderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "coverage" JSONB,
    "deductible" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "copay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coinsurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoveragePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeographicCoverage" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "zipCodes" TEXT[],
    "radius" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeographicCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCoverage" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "covered" BOOLEAN NOT NULL DEFAULT true,
    "priorAuthRequired" BOOLEAN NOT NULL DEFAULT false,
    "copayAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkProvider" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "inNetwork" BOOLEAN NOT NULL DEFAULT true,
    "tier" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "terminationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizationRequirement" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "criteria" JSONB,
    "validDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizationRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoveragePolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveDate" TIMESTAMP(3),
    "auditTrail" JSONB,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoveragePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceProvider_code_key" ON "InsuranceProvider"("code");

-- CreateIndex
CREATE INDEX "InsuranceProvider_organizationId_status_idx" ON "InsuranceProvider"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CoveragePlan_organizationId_status_idx" ON "CoveragePlan"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CoveragePlan_insuranceProviderId_idx" ON "CoveragePlan"("insuranceProviderId");

-- CreateIndex
CREATE INDEX "GeographicCoverage_planId_idx" ON "GeographicCoverage"("planId");

-- CreateIndex
CREATE INDEX "ServiceCoverage_planId_idx" ON "ServiceCoverage"("planId");

-- CreateIndex
CREATE INDEX "ServiceCoverage_serviceId_idx" ON "ServiceCoverage"("serviceId");

-- CreateIndex
CREATE INDEX "NetworkProvider_planId_idx" ON "NetworkProvider"("planId");

-- CreateIndex
CREATE INDEX "NetworkProvider_providerId_idx" ON "NetworkProvider"("providerId");

-- CreateIndex
CREATE INDEX "AuthorizationRequirement_planId_idx" ON "AuthorizationRequirement"("planId");

-- CreateIndex
CREATE INDEX "AuthorizationRequirement_serviceId_idx" ON "AuthorizationRequirement"("serviceId");

-- CreateIndex
CREATE INDEX "CoveragePolicy_organizationId_status_idx" ON "CoveragePolicy"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "InsuranceProvider" ADD CONSTRAINT "InsuranceProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoveragePlan" ADD CONSTRAINT "CoveragePlan_insuranceProviderId_fkey" FOREIGN KEY ("insuranceProviderId") REFERENCES "InsuranceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoveragePlan" ADD CONSTRAINT "CoveragePlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeographicCoverage" ADD CONSTRAINT "GeographicCoverage_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CoveragePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCoverage" ADD CONSTRAINT "ServiceCoverage_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CoveragePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkProvider" ADD CONSTRAINT "NetworkProvider_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CoveragePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationRequirement" ADD CONSTRAINT "AuthorizationRequirement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CoveragePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoveragePolicy" ADD CONSTRAINT "CoveragePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
