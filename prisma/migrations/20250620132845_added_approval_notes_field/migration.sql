/*
  Warnings:

  - You are about to drop the column `approval_note` on the `Property` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Property" DROP COLUMN "approval_note",
ADD COLUMN     "approval_notes" TEXT;
