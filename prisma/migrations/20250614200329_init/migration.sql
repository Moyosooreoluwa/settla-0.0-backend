-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('buyer', 'agent', 'admin');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('apartment', 'house', 'land', 'shortlet');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('sale', 'rent', 'shortlet');

-- CreateEnum
CREATE TYPE "Furnishing" AS ENUM ('furnished', 'unfurnished', 'partly_furnished');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('available', 'sold', 'rented');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('basic', 'premium', 'enterprise');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phone_number" TEXT,
    "profile_picture" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_docs" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "toilets" INTEGER NOT NULL,
    "size_sqm" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "discount_percent" DOUBLE PRECISION,
    "discounted_price" DOUBLE PRECISION,
    "address" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "property_type" "PropertyType" NOT NULL,
    "listing_type" "ListingType" NOT NULL,
    "furnishing" "Furnishing" NOT NULL,
    "availability" TEXT,
    "status" "PropertyStatus" NOT NULL,
    "amenities" TEXT[],
    "date_added" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modified" TIMESTAMP(3) NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyImage" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "PropertyImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
