/*
  Warnings:

  - You are about to drop the column `email` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `phone_number` on the `Lead` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "email",
DROP COLUMN "name",
DROP COLUMN "phone_number";
