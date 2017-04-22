-- Create sequence for project table for auto increment.
Create sequence sketches_id_seq;

-- Projects table will contain all the user associated project data.
CREATE TABLE public.sketches
(
    id integer NOT NULL DEFAULT nextval('sketches_id_seq'::regclass),
    name character varying COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default",
    userid integer REFERENCES users (id),
    projectid integer REFERENCES projects (id),
    createdat timestamp with time zone NOT NULL DEFAULT now(),
    modifiedat timestamp with time zone DEFAULT now(),
    treedata jsonb,
    vocabulary jsonb,
    CONSTRAINT sketches_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
);
