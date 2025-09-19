-- AlterEnum
ALTER TYPE "PropertyStatus" ADD VALUE 'unlisted';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
