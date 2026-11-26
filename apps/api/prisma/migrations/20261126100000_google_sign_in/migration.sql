ALTER TABLE "User" ADD COLUMN "google_subject" TEXT;
CREATE UNIQUE INDEX "User_google_subject_key" ON "User"("google_subject");
