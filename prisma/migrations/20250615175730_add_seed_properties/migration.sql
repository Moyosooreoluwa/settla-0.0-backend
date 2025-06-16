/*
  Warnings:

  - The values [house,shortlet] on the enum `PropertyType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `address` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the `PropertyImage` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `city` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `Property` table without a default value. This is not possible if the table is not empty.
  - Added the required column `street` to the `Property` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PropertyType_new" AS ENUM ('apartment', 'detached', 'semi_detached', 'terrace', 'land');
ALTER TABLE "Property" ALTER COLUMN "property_type" TYPE "PropertyType_new" USING ("property_type"::text::"PropertyType_new");
ALTER TYPE "PropertyType" RENAME TO "PropertyType_old";
ALTER TYPE "PropertyType_new" RENAME TO "PropertyType";
DROP TYPE "PropertyType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "PropertyImage" DROP CONSTRAINT "PropertyImage_propertyId_fkey";

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "address",
DROP COLUMN "location",
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "state" TEXT NOT NULL,
ADD COLUMN     "street" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "saved_properties" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "PropertyImage";
