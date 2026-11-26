-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'INTERPRETER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'FILLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterpreterProfile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "years_experience" INTEGER NOT NULL DEFAULT 0,
    "hourly_rate_aed" DECIMAL(10,2),
    "availability_notes" TEXT,
    "onsite_enabled" BOOLEAN NOT NULL DEFAULT false,
    "remote_enabled" BOOLEAN NOT NULL DEFAULT true,
    "opt_out_broadcast_emails" BOOLEAN NOT NULL DEFAULT false,
    "profile_completeness" INTEGER NOT NULL DEFAULT 0,
    "status" "ProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "rejection_reason" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterpreterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "interpreter_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterpreterLanguage" (
    "interpreter_profile_id" TEXT NOT NULL,
    "language_id" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "proficiency_level" TEXT,

    CONSTRAINT "InterpreterLanguage_pkey" PRIMARY KEY ("interpreter_profile_id","language_id","direction")
);

-- CreateTable
CREATE TABLE "InterpreterDomain" (
    "interpreter_profile_id" TEXT NOT NULL,
    "domain_id" INTEGER NOT NULL,

    CONSTRAINT "InterpreterDomain_pkey" PRIMARY KEY ("interpreter_profile_id","domain_id")
);

-- CreateTable
CREATE TABLE "InterpreterCity" (
    "interpreter_profile_id" TEXT NOT NULL,
    "city_id" INTEGER NOT NULL,

    CONSTRAINT "InterpreterCity_pkey" PRIMARY KEY ("interpreter_profile_id","city_id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "source_language" TEXT NOT NULL,
    "target_language" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "onsite_required" BOOLEAN NOT NULL DEFAULT false,
    "remote_allowed" BOOLEAN NOT NULL DEFAULT true,
    "budget_min_aed" DECIMAL(10,2),
    "budget_max_aed" DECIMAL(10,2),
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "filled_quote_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestRecipient" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "interpreter_profile_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "RequestRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "interpreter_profile_id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "amount_aed" DECIMAL(10,2) NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectInquiry" (
    "id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "interpreter_profile_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "category" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_user_id_idx" ON "EmailVerificationToken"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "InterpreterProfile_user_id_key" ON "InterpreterProfile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Language_name_key" ON "Language"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_name_key" ON "Domain"("name");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RequestRecipient_request_id_interpreter_profile_id_key" ON "RequestRecipient"("request_id", "interpreter_profile_id");

-- CreateIndex
CREATE INDEX "Notification_user_id_created_at_idx" ON "Notification"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpreterProfile" ADD CONSTRAINT "InterpreterProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_interpreter_profile_id_fkey" FOREIGN KEY ("interpreter_profile_id") REFERENCES "InterpreterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpreterLanguage" ADD CONSTRAINT "InterpreterLanguage_interpreter_profile_id_fkey" FOREIGN KEY ("interpreter_profile_id") REFERENCES "InterpreterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpreterLanguage" ADD CONSTRAINT "InterpreterLanguage_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpreterDomain" ADD CONSTRAINT "InterpreterDomain_interpreter_profile_id_fkey" FOREIGN KEY ("interpreter_profile_id") REFERENCES "InterpreterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpreterDomain" ADD CONSTRAINT "InterpreterDomain_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpreterCity" ADD CONSTRAINT "InterpreterCity_interpreter_profile_id_fkey" FOREIGN KEY ("interpreter_profile_id") REFERENCES "InterpreterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpreterCity" ADD CONSTRAINT "InterpreterCity_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestRecipient" ADD CONSTRAINT "RequestRecipient_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestRecipient" ADD CONSTRAINT "RequestRecipient_interpreter_profile_id_fkey" FOREIGN KEY ("interpreter_profile_id") REFERENCES "InterpreterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_interpreter_profile_id_fkey" FOREIGN KEY ("interpreter_profile_id") REFERENCES "InterpreterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectInquiry" ADD CONSTRAINT "DirectInquiry_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectInquiry" ADD CONSTRAINT "DirectInquiry_interpreter_profile_id_fkey" FOREIGN KEY ("interpreter_profile_id") REFERENCES "InterpreterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
