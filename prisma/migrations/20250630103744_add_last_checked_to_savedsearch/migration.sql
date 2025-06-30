/*
  Warnings:

  - You are about to drop the column `deliveryType` on the `SearchAlertLog` table. All the data in the column will be lost.
  - You are about to drop the column `matchedCount` on the `SearchAlertLog` table. All the data in the column will be lost.
  - You are about to drop the column `savedSearchId` on the `SearchAlertLog` table. All the data in the column will be lost.
  - You are about to drop the column `sentAt` on the `SearchAlertLog` table. All the data in the column will be lost.
  - Added the required column `method` to the `SearchAlertLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `result_count` to the `SearchAlertLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `searchId` to the `SearchAlertLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `SearchAlertLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SearchAlertLog" DROP CONSTRAINT "SearchAlertLog_savedSearchId_fkey";

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "last_checked" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SearchAlertLog" DROP COLUMN "deliveryType",
DROP COLUMN "matchedCount",
DROP COLUMN "savedSearchId",
DROP COLUMN "sentAt",
ADD COLUMN     "method" "NotificationType" NOT NULL,
ADD COLUMN     "notified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "result_count" INTEGER NOT NULL,
ADD COLUMN     "searchId" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "SearchAlertLog" ADD CONSTRAINT "SearchAlertLog_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "SavedSearch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
