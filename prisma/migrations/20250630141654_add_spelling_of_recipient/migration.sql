/*
  Warnings:

  - You are about to drop the column `receipientId` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `recipientId` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Made the column `last_checked` on table `SavedSearch` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_receipientId_fkey";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "receipientId",
ADD COLUMN     "recipientId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SavedSearch" ALTER COLUMN "last_checked" SET NOT NULL,
ALTER COLUMN "last_checked" SET DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
