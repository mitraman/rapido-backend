Create sequence sketchevents_id_seq;

CREATE TABLE public.sketchevents
(
    id integer NOT NULL DEFAULT nextval('sketchevents_id_seq'::regclass),
    sketchid integer,
    eventtype character varying COLLATE pg_catalog."default",
    eventdata character varying COLLATE pg_catalog."default",
    createdat timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT sketchevents_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
);
