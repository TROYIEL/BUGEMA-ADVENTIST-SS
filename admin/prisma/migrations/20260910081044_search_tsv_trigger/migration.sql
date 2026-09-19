-- Prisma cannot represent a GENERATED ALWAYS column. It reads the generation
-- expression as a column default and emits a broken
-- `ALTER COLUMN "tsv" DROP DEFAULT` on every subsequent diff, which errors
-- against a generated column.
--
-- A trigger-maintained column is invisible to Prisma's differ (it ignores
-- triggers entirely) while remaining just as authoritative: the value is
-- recomputed by Postgres on every insert/update regardless of whether the row
-- was written by Prisma Client or raw SQL.

DROP INDEX IF EXISTS "search_documents_tsv_idx";

ALTER TABLE "search_documents" DROP COLUMN IF EXISTS "tsv";
ALTER TABLE "search_documents" ADD COLUMN "tsv" tsvector;

CREATE OR REPLACE FUNCTION search_documents_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW."tsv" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."keywords", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."excerpt", '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER search_documents_tsv_trigger
  BEFORE INSERT OR UPDATE OF "title", "keywords", "excerpt"
  ON "search_documents"
  FOR EACH ROW EXECUTE FUNCTION search_documents_tsv_update();

-- Backfill any existing rows through the trigger.
UPDATE "search_documents" SET "title" = "title";

CREATE INDEX "search_documents_tsv_idx" ON "search_documents" USING GIN ("tsv");
