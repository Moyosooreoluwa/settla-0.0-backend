/*
  Warnings:

  - You are about to drop the column `saved_properties` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "saved_properties";

-- CreateTable
CREATE TABLE "_SavedProperties" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SavedProperties_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SavedProperties_B_index" ON "_SavedProperties"("B");

-- AddForeignKey
ALTER TABLE "_SavedProperties" ADD CONSTRAINT "_SavedProperties_A_fkey" FOREIGN KEY ("A") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SavedProperties" ADD CONSTRAINT "_SavedProperties_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
