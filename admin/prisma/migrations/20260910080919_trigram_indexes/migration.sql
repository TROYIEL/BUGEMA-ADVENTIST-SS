-- Replaces the raw expression trigram index from the previous migration with
-- per-column trigram indexes that Prisma can represent in schema.prisma, so
-- `migrate dev` stops trying to drop them.
--
-- NOTE: Prisma generated an `ALTER COLUMN "tsv" DROP DEFAULT` here, which
-- errors on a GENERATED ALWAYS column. It is intentionally omitted.

DROP INDEX IF EXISTS "applications_name_trgm_idx";

CREATE INDEX "applications_firstName_idx" ON "applications" USING GIN ("firstName" gin_trgm_ops);

CREATE INDEX "applications_lastName_idx" ON "applications" USING GIN ("lastName" gin_trgm_ops);
