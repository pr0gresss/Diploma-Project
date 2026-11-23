-- Keep the extracted content in PostgreSQL as well as private object storage.
-- Existing materials remain readable through their stored object key.
ALTER TABLE materials ADD COLUMN extracted_text TEXT;
