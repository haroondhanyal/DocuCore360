-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "accent" TEXT NOT NULL DEFAULT 'emerald',
ADD COLUMN     "colorfulHeader" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contrast" BOOLEAN NOT NULL DEFAULT false;
