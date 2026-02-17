-- CreateIndex
CREATE UNIQUE INDEX "Quote_request_id_interpreter_profile_id_key" ON "Quote"("request_id", "interpreter_profile_id");
