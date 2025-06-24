/*
  Warnings:

  - You are about to drop the column `userId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `user_email` on the `Notification` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('IN_APP', 'EMAIL');

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "userId",
DROP COLUMN "user_email",
ADD COLUMN     "receipientId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "receipient_email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'IN_APP',
ALTER COLUMN "title" SET DEFAULT '',
ALTER COLUMN "message" SET DEFAULT '';

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_receipientId_fkey" FOREIGN KEY ("receipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
