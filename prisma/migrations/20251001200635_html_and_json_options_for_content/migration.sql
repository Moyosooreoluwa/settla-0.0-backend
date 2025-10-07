/*
  Warnings:

  - You are about to drop the column `content` on the `Article` table. All the data in the column will be lost.
  - Added the required column `contentHTML` to the `Article` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contentJSON` to the `Article` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Article" DROP COLUMN "content",
ADD COLUMN     "contentHTML" TEXT NOT NULL,
ADD COLUMN     "contentJSON" TEXT NOT NULL;
