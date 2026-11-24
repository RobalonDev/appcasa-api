-- CreateEnum
CREATE TYPE "verification_code_status" AS ENUM ('PENDING', 'ACTIVE', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "auth_email_kind" AS ENUM ('VERIFICATION_CODE', 'REGISTRATION_NOTICE');

-- CreateEnum
CREATE TYPE "auth_email_send_status" AS ENUM ('PENDING', 'SENT');

-- CreateEnum
CREATE TYPE "login_outcome" AS ENUM ('FAILURE', 'SUCCESS');

-- CreateEnum
CREATE TYPE "session_end_reason" AS ENUM ('LOGOUT', 'LOGOUT_ALL', 'COPIED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "code_hmac" TEXT NOT NULL,
    "status" "verification_code_status" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "issued_at" TIMESTAMPTZ(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_email_sends" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "kind" "auth_email_kind" NOT NULL,
    "status" "auth_email_send_status" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_failures" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "failed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verification_failures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "outcome" "login_outcome" NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "end_reason" "session_end_reason",

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "verification_codes_email_status_idx" ON "verification_codes"("email", "status");

-- Added by hand: Prisma's schema language cannot express a partial unique index.
-- At most one ACTIVE (issued, usable) verification code per email (RF-11; plan 001, data model).
CREATE UNIQUE INDEX "verification_codes_one_active_per_email_key"
    ON "verification_codes"("email")
    WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "auth_email_sends_email_created_at_idx" ON "auth_email_sends"("email", "created_at");

-- CreateIndex
CREATE INDEX "verification_failures_email_failed_at_idx" ON "verification_failures"("email", "failed_at");

-- CreateIndex
CREATE INDEX "login_attempts_email_at_idx" ON "login_attempts"("email", "at");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
