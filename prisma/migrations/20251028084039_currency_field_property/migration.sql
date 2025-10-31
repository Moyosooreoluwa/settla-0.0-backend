/*
  Warnings:

  - You are about to drop the column `dollar_price` on the `Property` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "currency" AS ENUM ('USD', 'NGN');

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "dollar_price",
ADD COLUMN     "currency" "currency" NOT NULL DEFAULT 'NGN';
