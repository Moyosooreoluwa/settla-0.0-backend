/*
  Warnings:

  - Made the column `rank` on table `SubscriptionTier` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "SubscriptionTier" ALTER COLUMN "rank" SET NOT NULL;
