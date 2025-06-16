-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_agentId_fkey";

-- AlterTable
ALTER TABLE "Property" ALTER COLUMN "agentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
