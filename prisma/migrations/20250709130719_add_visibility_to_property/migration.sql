/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `SubscriptionTier` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "VisibilityLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('SUBSCRIPTION', 'PROPERTY_BOOST', 'FEATURE_UPGRADE', 'CUSTOM');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "purpose" "PaymentPurpose" NOT NULL DEFAULT 'SUBSCRIPTION';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visibility" "VisibilityLevel" NOT NULL DEFAULT 'low';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "paystackCustomerCode" TEXT,
ADD COLUMN     "paystackEmailToken" TEXT,
ADD COLUMN     "paystackInvoiceToken" TEXT,
ADD COLUMN     "paystackSubscriptionCode" TEXT;

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "paystackPlanCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionTier_name_key" ON "SubscriptionTier"("name");
