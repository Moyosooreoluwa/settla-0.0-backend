/*
  Warnings:

  - You are about to drop the column `is_approved` on the `Property` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('approved', 'pending', 'rejected');

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "is_approved",
ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'pending';
