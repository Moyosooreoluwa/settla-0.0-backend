-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorCode" TEXT,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorExpiresAt" TIMESTAMP(3);
