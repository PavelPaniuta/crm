-- Client pipeline statuses and custom field definitions per organization

CREATE TABLE "ClientStatus" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientStatus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientFieldDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "options" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientFieldDefinition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Client" ADD COLUMN "statusId" TEXT,
ADD COLUMN "bank" TEXT,
ADD COLUMN "assistantName" TEXT,
ADD COLUMN "callSummary" TEXT,
ADD COLUMN "callStartedAt" TIMESTAMP(3),
ADD COLUMN "customData" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "ClientStatus" ADD CONSTRAINT "ClientStatus_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ClientStatus_organizationId_slug_key" ON "ClientStatus"("organizationId", "slug");
CREATE INDEX "ClientStatus_organizationId_idx" ON "ClientStatus"("organizationId");

ALTER TABLE "ClientFieldDefinition" ADD CONSTRAINT "ClientFieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ClientFieldDefinition_organizationId_key_key" ON "ClientFieldDefinition"("organizationId", "key");
CREATE INDEX "ClientFieldDefinition_organizationId_idx" ON "ClientFieldDefinition"("organizationId");

ALTER TABLE "Client" ADD CONSTRAINT "Client_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ClientStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Client_statusId_idx" ON "Client"("statusId");
