-- Create sequence for project table for auto increment.
Create sequence projects_id_seq;

-- Projects table will contain all the user associated project data.
CREATE TABLE public.projects
(
    id integer NOT NULL DEFAULT nextval('projects_id_seq'::regclass),
    name character varying COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default",
    userid bigint,
    createdat timestamp with time zone NOT NULL DEFAULT now(),
    modifiedat timestamp with time zone DEFAULT now(),
    createdby bigint,
    modifiedby bigint,
    treedata jsonb,
    vocabulary jsonb,
    apidetails jsonb,
    CONSTRAINT projects_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
);

COMMENT ON TABLE public.projects
    IS 'store only user associated projects with sketch data.';
