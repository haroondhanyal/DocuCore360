ALTER TABLE "User" ADD COLUMN "username" TEXT NOT NULL DEFAULT ('user_'::text || replace((gen_random_uuid())::text, '-'::text, ''::text)),
ADD COLUMN "sidebarLabel" TEXT NOT NULL DEFAULT 'username';
WITH handles AS (
  SELECT "id", coalesce(nullif(left(regexp_replace(lower("name"), '[^a-z0-9]', '', 'g'), 24), ''), 'user') || '_' || row_number() OVER (ORDER BY "id")::text AS handle
  FROM "User"
)
UPDATE "User" SET "username" = handles.handle FROM handles WHERE "User"."id" = handles."id";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
ALTER TABLE "UserPreference" ADD COLUMN "buttonColor" TEXT NOT NULL DEFAULT 'theme';
