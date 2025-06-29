-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'in_progress', 'closed');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('buyer', 'agent', 'admin');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('apartment', 'detached', 'semi_detached', 'terrace', 'land');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('sale', 'rent', 'shortlet');

-- CreateEnum
CREATE TYPE "Furnishing" AS ENUM ('furnished', 'unfurnished', 'partly_furnished');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('available', 'sold', 'rented', 'unavailable');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('basic', 'premium', 'enterprise');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('approved', 'pending', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phone_number" TEXT,
    "logo" TEXT,
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_docs" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "agentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bedrooms" TEXT NOT NULL,
    "bathrooms" TEXT NOT NULL,
    "toilets" TEXT NOT NULL,
    "size_sqm" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "discount_percent" DOUBLE PRECISION,
    "discounted_price" DOUBLE PRECISION,
    "property_type" "PropertyType" NOT NULL,
    "listing_type" "ListingType" NOT NULL,
    "furnishing" "Furnishing" NOT NULL,
    "status" "PropertyStatus" NOT NULL,
    "amenities" TEXT[],
    "date_added" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modified" TIMESTAMP(3) NOT NULL,
    "images" TEXT[],
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "parking_spaces" TEXT,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "approval_notes" TEXT,
    "availability" TEXT,
    "tenancy_info" TEXT,
    "service_charge" TEXT,
    "min_tenancy" TEXT,
    "deposit" DOUBLE PRECISION,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "userId" TEXT,
    "agentId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "closure_reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "receipientId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "type" "NotificationType" NOT NULL DEFAULT 'IN_APP',
    "message" TEXT NOT NULL DEFAULT '',
    "linkUrl" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "query" JSONB NOT NULL,
    "sendAlerts" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchAlertLog" (
    "id" TEXT NOT NULL,
    "savedSearchId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedCount" INTEGER NOT NULL,
    "deliveryType" "NotificationType" NOT NULL,

    CONSTRAINT "SearchAlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_saved_properties" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_saved_properties_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "_saved_properties_B_index" ON "_saved_properties"("B");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_receipientId_fkey" FOREIGN KEY ("receipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchAlertLog" ADD CONSTRAINT "SearchAlertLog_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_saved_properties" ADD CONSTRAINT "_saved_properties_A_fkey" FOREIGN KEY ("A") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_saved_properties" ADD CONSTRAINT "_saved_properties_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
