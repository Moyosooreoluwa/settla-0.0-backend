/*
  Warnings:

  - You are about to drop the `_SavedProperties` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_SavedProperties" DROP CONSTRAINT "_SavedProperties_A_fkey";

-- DropForeignKey
ALTER TABLE "_SavedProperties" DROP CONSTRAINT "_SavedProperties_B_fkey";

-- DropTable
DROP TABLE "_SavedProperties";

-- CreateTable
CREATE TABLE "_saved_properties" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_saved_properties_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_saved_properties_B_index" ON "_saved_properties"("B");

-- AddForeignKey
ALTER TABLE "_saved_properties" ADD CONSTRAINT "_saved_properties_A_fkey" FOREIGN KEY ("A") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_saved_properties" ADD CONSTRAINT "_saved_properties_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
