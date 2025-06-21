/*
  Warnings:

  - The `verification_docs` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "verification_docs",
ADD COLUMN     "verification_docs" JSONB;
