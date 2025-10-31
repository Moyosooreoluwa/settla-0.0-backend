-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "dollar_price" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "last_login" TIMESTAMP(3),
ADD COLUMN     "last_password_change" TIMESTAMP(3);
