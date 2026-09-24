-- CreateEnum
CREATE TYPE "Category" AS ENUM ('WRITING', 'BUSINESS', 'CODING', 'IMAGE', 'VIDEO', 'MUSIC', 'MARKETING', 'EDUCATION', 'DATA_ANALYSIS', 'RESEARCH', 'GENERAL_WRITING');

-- CreateEnum
CREATE TYPE "PromptStyle" AS ENUM ('PROFESSIONAL', 'CREATIVE', 'TECHNICAL', 'EDUCATIONAL');

-- CreateEnum
CREATE TYPE "TemplateSource" AS ENUM ('SYSTEM', 'USER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "rawInput" TEXT NOT NULL,
    "detectedCategory" "Category" NOT NULL,
    "promptStyle" "PromptStyle" NOT NULL DEFAULT 'PROFESSIONAL',
    "options" JSONB NOT NULL DEFAULT '{}',
    "generatedPrompt" TEXT NOT NULL,
    "recommendedTools" TEXT[],
    "title" VARCHAR(160),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "baseStructure" JSONB NOT NULL,
    "createdBy" "TemplateSource" NOT NULL DEFAULT 'SYSTEM',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Prompt_userId_createdAt_idx" ON "Prompt"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Prompt_detectedCategory_idx" ON "Prompt"("detectedCategory");

-- CreateIndex
CREATE UNIQUE INDEX "Template_key_key" ON "Template"("key");

-- CreateIndex
CREATE INDEX "Template_category_idx" ON "Template"("category");

-- CreateIndex
CREATE INDEX "Template_ownerId_idx" ON "Template"("ownerId");

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
