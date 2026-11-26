CREATE TABLE "BookingSession" (
    "request_id" TEXT NOT NULL,
    "details" TEXT,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "BookingSession_pkey" PRIMARY KEY ("request_id")
);

ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
