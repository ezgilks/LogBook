CREATE SEQUENCE IF NOT EXISTS records_seq;

CREATE TABLE IF NOT EXISTS records (
    user_id    uuid   NOT NULL,
    kind       text   NOT NULL,
    id         text   NOT NULL,
    data       jsonb  NOT NULL,
    updated_at bigint NOT NULL,
    deleted_at bigint,
    seq        bigint NOT NULL,
    PRIMARY KEY (user_id, kind, id)
);

CREATE INDEX IF NOT EXISTS records_user_seq_idx ON records (user_id, seq);

-- Defense in depth if this table is ever exposed through Supabase's REST API:
-- the Go service connects as the table owner and is unaffected.
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
