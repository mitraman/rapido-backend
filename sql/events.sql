Create sequence events_id_seq;

CREATE TABLE public.events
(
    id integer NOT NULL DEFAULT nextval('events_id_seq'::regclass),
    eventdata jsonb,
    createdat timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT events_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
);
