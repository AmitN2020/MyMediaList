CREATE OR REPLACE FUNCTION immutable_array_to_string(arr text[], sep text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT array_to_string(arr, sep) $$;
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "search_tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english'::regconfig, coalesce("title", '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(immutable_array_to_string("creators", ' '), '')), 'B') || setweight(to_tsvector('english'::regconfig, coalesce("description", '') || ' ' || coalesce(immutable_array_to_string("genres", ' '), '') || ' ' || coalesce(immutable_array_to_string("keywords", ' '), '')), 'C')) STORED;--> statement-breakpoint
CREATE INDEX "items_search_tsv_idx" ON "items" USING gin ("search_tsv");