-- AlterTable: add roleId, migrate from FormAccessLevel, drop level + enum
ALTER TABLE "FormAccess" ADD COLUMN "roleId" TEXT NOT NULL DEFAULT 'viewer';

UPDATE "FormAccess"
SET "roleId" = CASE
  WHEN "level"::text = 'EDIT' THEN 'manager'
  ELSE 'viewer'
END;

ALTER TABLE "FormAccess" DROP COLUMN "level";

DROP TYPE "FormAccessLevel";
