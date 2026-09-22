-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarPath" TEXT,
ADD COLUMN     "avatarUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "phone" TEXT;
