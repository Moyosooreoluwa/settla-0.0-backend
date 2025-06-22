/*
  Warnings:

  - Made the column `message` on table `Lead` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "message" SET NOT NULL;
