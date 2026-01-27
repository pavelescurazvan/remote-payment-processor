CREATE SCHEMA pay_pro;

CREATE TABLE pay_pro.event_store (
  id BIGSERIAL PRIMARY KEY,
  client INTEGER NOT NULL,
  version BIGSERIAL NOT NULL UNIQUE,
  type VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX event_store_client_idx ON pay_pro.event_store (client);
