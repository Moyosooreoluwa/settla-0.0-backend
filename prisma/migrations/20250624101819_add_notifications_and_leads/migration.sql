/*
  Warnings:

  - Changed the column `type` on the `Notification` table from a scalar field to a list field. If there are non-null values in that column, this step will fail.

*/
-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "type" DROP DEFAULT,
ALTER COLUMN "type" SET DATA TYPE "NotificationType"[];
