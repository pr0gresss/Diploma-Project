# Apache Tika content extraction

For a backend running on the host with Tika published on port 9998, set
`TIKA_URL=http://127.0.0.1:9998` in `Backend/.env` and restart the backend.
The full Docker stack sets `TIKA_URL=http://tika:9998` automatically. An unset
`TIKA_URL` disables background extraction. `TIKA_TIMEOUT_MS` defaults to 60000.

The worker checks for interrupted jobs once a minute, even when Tika is disabled.
Jobs still RUNNING after 15 minutes become FAILED; expired extraction also marks
the material FAILED so its owner can retry. Expired generation leaves a READY
material unchanged. This window exceeds the configured parser/provider timeouts
and storage retry budget. Set `PROCESSING_WORKER_ENABLED=false` to disable all
polling and recovery in test processes or utility scripts.

New output keys are unique per attempt:
`materials/{materialId}/extractions/{jobId}.txt`. Existing extracted objects remain
readable through their saved keys. Late or failed attempts cannot overwrite the
output of a newer attempt. Failed publication removes confirmed unreferenced
output; ambiguous database failures retain the object for reconciliation.

Material and workspace deletion returns 409 while a child job is RUNNING.
Queued uploads remain deletable. Cleanup keys are collected in the transaction
that deletes the records; external storage calls run after that transaction.

After schema changes, run `npm run prisma:generate` and `npm run prisma:migrate:deploy`
before building or starting the backend. Uploading PDF/DOCX creates a queued job;
the worker moves the material through PROCESSING to READY or FAILED. Successful
text is saved in private object storage; PostgreSQL stores its object key. Text is served through the
authenticated `GET /materials/:materialId/text` endpoint. Image-only documents
require OCR support in the Tika image; empty extracted text is treated as failure.

Run `npm run test:tika` with PostgreSQL and Tika available to verify real PDF and
Unicode DOCX extraction, text persistence, ownership and corrupt-document failure.
The smoke check uses disposable database records and isolated local storage and
manually claims only its own jobs; it does not exercise the global queue claim SQL.
Use `npm run test:tika:r2` to run the same check against the configured private R2
bucket instead of local storage. It removes only its disposable fixtures afterward.


[Backend reference](README.md)
