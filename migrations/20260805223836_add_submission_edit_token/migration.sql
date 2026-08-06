-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "editToken" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Submission_formId_idx" ON "Submission"("formId");
