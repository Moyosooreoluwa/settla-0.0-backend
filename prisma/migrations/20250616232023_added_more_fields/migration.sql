-- AlterEnum
ALTER TYPE "PropertyStatus" ADD VALUE 'unavailable';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "deposit" DOUBLE PRECISION,
ADD COLUMN     "min_tenancy" TEXT,
ADD COLUMN     "parking_spaces" INTEGER,
ADD COLUMN     "service_charge" TEXT,
ADD COLUMN     "tenancy_info" TEXT;
