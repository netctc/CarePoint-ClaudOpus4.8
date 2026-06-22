CREATE TABLE IF NOT EXISTS "AppointmentSubjectContext" (
  "appointmentId" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "subjectProfileId" TEXT NOT NULL,
  "subjectLabel" TEXT,
  "subjectRelationship" TEXT,
  "isFamilySubject" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentSubjectContext_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AppointmentSubjectContext_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AppointmentSubjectContext_organizationId_patientId_idx"
  ON "AppointmentSubjectContext"("organizationId", "patientId");

CREATE INDEX IF NOT EXISTS "AppointmentSubjectContext_patientId_subjectProfileId_idx"
  ON "AppointmentSubjectContext"("patientId", "subjectProfileId");
