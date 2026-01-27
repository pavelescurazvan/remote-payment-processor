CREATE SCHEMA pay_pro;

CREATE TABLE pay_pro.event_store (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR NOT NULL,
  client INTEGER NOT NULL,
  version BIGINT NOT NULL,
  tx INTEGER NOT NULL,
  amount BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT event_store_client_version_uk UNIQUE (client, version),
  CONSTRAINT event_store_client_tx_type_uk UNIQUE (client, tx, type),
  CONSTRAINT event_store_type_chk CHECK (type IN ('deposit','withdrawal','dispute','resolve','chargeback'))
);
