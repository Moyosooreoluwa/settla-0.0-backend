/*
  Warnings:

  - A unique constraint covering the columns `[paystackSubscriptionCode]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'COMPLIMENTARY';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "category" TEXT,
ADD COLUMN     "relatedEntityId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "nextPaymentDate" TIMESTAMP(3),
ADD COLUMN     "paystackPlanCode" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" JSONB,
ADD COLUMN     "socials" JSONB;

-- CreateTable
CREATE TABLE "PaystackCustomer" (
    "userId" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,

    CONSTRAINT "PaystackCustomer_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaystackCustomer_customerCode_key" ON "PaystackCustomer"("customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_paystackSubscriptionCode_key" ON "Subscription"("paystackSubscriptionCode");

-- AddForeignKey
ALTER TABLE "PaystackCustomer" ADD CONSTRAINT "PaystackCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
