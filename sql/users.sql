-- Create sequence for user.
Create sequence users_id_seq;

-- Create user table.
CREATE TABLE public.users
(
    id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    fullname character varying COLLATE pg_catalog."default",
    nickname character varying COLLATE pg_catalog."default",
    password character varying COLLATE pg_catalog."default",
    email character varying COLLATE pg_catalog."default",
    isactive boolean,
    isverified boolean,
    secretkey text COLLATE pg_catalog."default",
    createdat timestamp with time zone DEFAULT now(),
    modifiedat timestamp with time zone DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
);

COMMENT ON TABLE public.users
    IS 'store only user related information.';

-- Create sequence for user verify table for auto increment.
Create sequence user_verify_id_seq;

-- Email aaccount verification purpose, once email account verified then the data will be deleted by app automatically.
-- Stale data can be there, write the code to remove the stale data from this table.
CREATE TABLE public.user_verify
(
    id integer NOT NULL DEFAULT nextval('user_verify_id_seq'::regclass),
    userid bigint,
    verifytoken character varying COLLATE pg_catalog."default",
    CONSTRAINT user_verify_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = TRUE
);

COMMENT ON TABLE public.user_verify
    IS 'store email verification token temporary basis, till user verifies it.';
