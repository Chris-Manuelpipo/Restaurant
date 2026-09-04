-- CreateEnum
CREATE TYPE "RestaurantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('AVAILABLE', 'SOLD_OUT', 'DISABLED');

-- CreateEnum
CREATE TYPE "RuleTargetType" AS ENUM ('CATEGORY', 'ITEM');

-- CreateEnum
CREATE TYPE "RuleKind" AS ENUM ('VISIBILITY', 'PROMO');

-- CreateEnum
CREATE TYPE "AccessPointKind" AS ENUM ('TABLE', 'COUNTER', 'WINDOW', 'POSTER', 'OTHER');

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "status" "RestaurantStatus" NOT NULL DEFAULT 'TRIAL',
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "coverPreset" TEXT,
    "theme" JSONB NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Douala',
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "defaultLocale" TEXT NOT NULL DEFAULT 'fr',
    "enabledLocales" TEXT[] DEFAULT ARRAY['fr']::TEXT[],
    "address" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "socials" JSONB NOT NULL DEFAULT '{}',
    "enabledModules" TEXT[] DEFAULT ARRAY['core', 'menu_qr']::TEXT[],
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningHours" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT NOT NULL DEFAULT '11:00',
    "closeTime" TEXT NOT NULL DEFAULT '22:00',

    CONSTRAINT "OpeningHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "basePrice" INTEGER,
    "prepMinutes" INTEGER,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPerPerson" BOOLEAN NOT NULL DEFAULT false,
    "badge" JSONB,
    "status" "ItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "archivedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemVariant" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "price" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuItemVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemSupplement" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "price" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuItemSupplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemImage" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "variants" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "targetType" "RuleTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "kind" "RuleKind" NOT NULL,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" JSONB,
    "discountPercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessPoint" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "AccessPointKind" NOT NULL DEFAULT 'TABLE',
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AccessPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "diff" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "Restaurant_status_idx" ON "Restaurant"("status");

-- CreateIndex
CREATE INDEX "OpeningHours_restaurantId_idx" ON "OpeningHours"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningHours_restaurantId_dayOfWeek_key" ON "OpeningHours"("restaurantId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_restaurantId_idx" ON "User"("restaurantId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_restaurantId_idx" ON "Invitation"("restaurantId");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Category_restaurantId_position_idx" ON "Category"("restaurantId", "position");

-- CreateIndex
CREATE INDEX "Category_restaurantId_archivedAt_idx" ON "Category"("restaurantId", "archivedAt");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_position_idx" ON "MenuItem"("restaurantId", "position");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_categoryId_idx" ON "MenuItem"("restaurantId", "categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_status_idx" ON "MenuItem"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItemVariant_menuItemId_position_idx" ON "MenuItemVariant"("menuItemId", "position");

-- CreateIndex
CREATE INDEX "MenuItemSupplement_menuItemId_position_idx" ON "MenuItemSupplement"("menuItemId", "position");

-- CreateIndex
CREATE INDEX "MenuItemImage_menuItemId_position_idx" ON "MenuItemImage"("menuItemId", "position");

-- CreateIndex
CREATE INDEX "AvailabilityRule_restaurantId_targetType_targetId_idx" ON "AvailabilityRule"("restaurantId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "AvailabilityRule_restaurantId_kind_idx" ON "AvailabilityRule"("restaurantId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPoint_code_key" ON "AccessPoint"("code");

-- CreateIndex
CREATE INDEX "AccessPoint_restaurantId_isActive_idx" ON "AccessPoint"("restaurantId", "isActive");

-- CreateIndex
CREATE INDEX "AccessPoint_restaurantId_kind_idx" ON "AccessPoint"("restaurantId", "kind");

-- CreateIndex
CREATE INDEX "AuditLog_restaurantId_createdAt_idx" ON "AuditLog"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "OpeningHours" ADD CONSTRAINT "OpeningHours_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemVariant" ADD CONSTRAINT "MenuItemVariant_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemSupplement" ADD CONSTRAINT "MenuItemSupplement_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemImage" ADD CONSTRAINT "MenuItemImage_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPoint" ADD CONSTRAINT "AccessPoint_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
