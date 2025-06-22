/*
  Warnings:

  - You are about to drop the column `phone` on the `Lead` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "phone",
ADD COLUMN     "phone_number" TEXT;
