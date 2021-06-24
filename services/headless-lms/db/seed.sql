--
-- PostgreSQL database dump
--

-- Dumped from database version 12.7 (Debian 12.7-1.pgdg100+1)
-- Dumped by pg_dump version 13.3 (Ubuntu 13.3-1.pgdg20.10+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public.user_exercise_states DROP CONSTRAINT user_exercise_states_user_id_fkey;
ALTER TABLE ONLY public.user_exercise_states DROP CONSTRAINT user_exercise_states_exercise_id_fkey;
ALTER TABLE ONLY public.user_exercise_states DROP CONSTRAINT user_exercise_states_course_instance_id_fkey;
ALTER TABLE ONLY public.submissions DROP CONSTRAINT submissions_user_id_fkey;
ALTER TABLE ONLY public.submissions DROP CONSTRAINT submissions_grading_id_fkey;
ALTER TABLE ONLY public.submissions DROP CONSTRAINT submissions_exercise_item_id_fkey;
ALTER TABLE ONLY public.submissions DROP CONSTRAINT submissions_exercise_id_fkey;
ALTER TABLE ONLY public.submissions DROP CONSTRAINT submissions_course_instance_id_fkey;
ALTER TABLE ONLY public.submissions DROP CONSTRAINT submissions_course_id_fkey;
ALTER TABLE ONLY public.roles DROP CONSTRAINT roles_user_id_fkey;
ALTER TABLE ONLY public.roles DROP CONSTRAINT roles_organization_id_fkey;
ALTER TABLE ONLY public.roles DROP CONSTRAINT roles_course_id_fkey;
ALTER TABLE ONLY public.regrading_submissions DROP CONSTRAINT regrading_submissions_submission_id_fkey;
ALTER TABLE ONLY public.regrading_submissions DROP CONSTRAINT regrading_submissions_regrading_id_fkey;
ALTER TABLE ONLY public.regrading_submissions DROP CONSTRAINT regrading_submissions_grading_before_regrading_fkey;
ALTER TABLE ONLY public.regrading_submissions DROP CONSTRAINT regrading_submissions_grading_after_regrading_fkey;
ALTER TABLE ONLY public.pages DROP CONSTRAINT pages_course_id_fkey;
ALTER TABLE ONLY public.pages DROP CONSTRAINT pages_chapter_id_fkey;
ALTER TABLE ONLY public.gradings DROP CONSTRAINT gradings_submission_id_fkey;
ALTER TABLE ONLY public.gradings DROP CONSTRAINT gradings_exercise_item_id_fkey;
ALTER TABLE ONLY public.gradings DROP CONSTRAINT gradings_exercise_id_fkey;
ALTER TABLE ONLY public.gradings DROP CONSTRAINT gradings_course_id_fkey;
ALTER TABLE ONLY public.exercises DROP CONSTRAINT exercises_page_id_fkey;
ALTER TABLE ONLY public.exercises DROP CONSTRAINT exercises_course_id_fkey;
ALTER TABLE ONLY public.exercise_tasks DROP CONSTRAINT exercise_items_exercise_id_fkey;
ALTER TABLE ONLY public.courses DROP CONSTRAINT courses_organization_id_fkey;
ALTER TABLE ONLY public.course_instances DROP CONSTRAINT course_instances_course_id_fkey;
ALTER TABLE ONLY public.chapters DROP CONSTRAINT chapters_front_page_id_fkey;
ALTER TABLE ONLY public.chapters DROP CONSTRAINT chapters_course_id_fkey;
DROP TRIGGER set_timestamp ON public.users;
DROP TRIGGER set_timestamp ON public.user_exercise_states;
DROP TRIGGER set_timestamp ON public.submissions;
DROP TRIGGER set_timestamp ON public.roles;
DROP TRIGGER set_timestamp ON public.regradings;
DROP TRIGGER set_timestamp ON public.regrading_submissions;
DROP TRIGGER set_timestamp ON public.pages;
DROP TRIGGER set_timestamp ON public.organizations;
DROP TRIGGER set_timestamp ON public.gradings;
DROP TRIGGER set_timestamp ON public.exercises;
DROP TRIGGER set_timestamp ON public.exercise_tasks;
DROP TRIGGER set_timestamp ON public.courses;
DROP TRIGGER set_timestamp ON public.course_instances;
DROP TRIGGER set_timestamp ON public.chapters;
DROP INDEX public.unique_pages_url_path_course_id_when_not_deleted;
DROP INDEX public.unique_chapters_chapter_number_course_id_when_not_deleted;
DROP INDEX public.pages_order_number_uniqueness;
ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
ALTER TABLE ONLY public.user_exercise_states DROP CONSTRAINT user_exercise_states_pkey;
ALTER TABLE ONLY public.submissions DROP CONSTRAINT submissions_pkey;
ALTER TABLE ONLY public.roles DROP CONSTRAINT roles_pkey;
ALTER TABLE ONLY public.regradings DROP CONSTRAINT regradings_pkey;
ALTER TABLE ONLY public.regrading_submissions DROP CONSTRAINT regrading_submissions_pkey;
ALTER TABLE ONLY public.pages DROP CONSTRAINT pages_pkey;
ALTER TABLE ONLY public.organizations DROP CONSTRAINT organizations_slug_key;
ALTER TABLE ONLY public.organizations DROP CONSTRAINT organizations_pkey;
ALTER TABLE ONLY public.gradings DROP CONSTRAINT gradings_pkey;
ALTER TABLE ONLY public.exercises DROP CONSTRAINT exercises_pkey;
ALTER TABLE ONLY public.exercise_tasks DROP CONSTRAINT exercise_items_pkey;
ALTER TABLE ONLY public.courses DROP CONSTRAINT courses_slug_key;
ALTER TABLE ONLY public.courses DROP CONSTRAINT courses_pkey;
ALTER TABLE ONLY public.course_instances DROP CONSTRAINT course_instances_pkey;
ALTER TABLE ONLY public.chapters DROP CONSTRAINT chapters_pkey;
ALTER TABLE ONLY public._sqlx_migrations DROP CONSTRAINT _sqlx_migrations_pkey;
DROP TABLE public.users;
DROP TABLE public.user_exercise_states;
DROP TABLE public.submissions;
DROP TABLE public.roles;
DROP TABLE public.regradings;
DROP TABLE public.regrading_submissions;
DROP TABLE public.pages;
DROP TABLE public.organizations;
DROP TABLE public.gradings;
DROP TABLE public.exercises;
DROP TABLE public.exercise_tasks;
DROP TABLE public.courses;
DROP TABLE public.course_instances;
DROP TABLE public.chapters;
DROP TABLE public._sqlx_migrations;
DROP FUNCTION public.trigger_set_timestamp();
DROP TYPE public.variant_status;
DROP TYPE public.user_role;
DROP TYPE public.user_points_update_strategy;
DROP TYPE public.grading_progress;
DROP TYPE public.activity_progress;
DROP EXTENSION "uuid-ossp";
--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: activity_progress; Type: TYPE; Schema: public; Owner: headless-lms
--

CREATE TYPE public.activity_progress AS ENUM (
    'initialized',
    'started',
    'in-progress',
    'submitted',
    'completed'
);


ALTER TYPE public.activity_progress OWNER TO "headless-lms";

--
-- Name: grading_progress; Type: TYPE; Schema: public; Owner: headless-lms
--

CREATE TYPE public.grading_progress AS ENUM (
    'fully-graded',
    'pending',
    'pending-manual',
    'failed',
    'not-ready'
);


ALTER TYPE public.grading_progress OWNER TO "headless-lms";

--
-- Name: user_points_update_strategy; Type: TYPE; Schema: public; Owner: headless-lms
--

CREATE TYPE public.user_points_update_strategy AS ENUM (
    'can-add-points-but-cannot-remove-points',
    'can-add-points-and-can-remove-points'
);


ALTER TYPE public.user_points_update_strategy OWNER TO "headless-lms";

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: headless-lms
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'assistant',
    'teacher',
    'reviewer'
);


ALTER TYPE public.user_role OWNER TO "headless-lms";

--
-- Name: variant_status; Type: TYPE; Schema: public; Owner: headless-lms
--

CREATE TYPE public.variant_status AS ENUM (
    'draft',
    'upcoming',
    'active',
    'ended'
);


ALTER TYPE public.variant_status OWNER TO "headless-lms";

--
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: headless-lms
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
    NEW.updated_at = now();
    RETURN NEW;
ELSE
    RETURN OLD;
END IF;
END;
$$;


ALTER FUNCTION public.trigger_set_timestamp() OWNER TO "headless-lms";

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _sqlx_migrations; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public._sqlx_migrations (
    version bigint NOT NULL,
    description text NOT NULL,
    installed_on timestamp with time zone DEFAULT now() NOT NULL,
    success boolean NOT NULL,
    checksum bytea NOT NULL,
    execution_time bigint NOT NULL
);


ALTER TABLE public._sqlx_migrations OWNER TO "headless-lms";

--
-- Name: chapters; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.chapters (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    course_id uuid NOT NULL,
    chapter_number integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    front_page_id uuid
);


ALTER TABLE public.chapters OWNER TO "headless-lms";

--
-- Name: course_instances; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.course_instances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    course_id uuid NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    name character varying(255),
    description character varying(255),
    variant_status public.variant_status DEFAULT 'draft'::public.variant_status NOT NULL
);


ALTER TABLE public.course_instances OWNER TO "headless-lms";

--
-- Name: TABLE course_instances; Type: COMMENT; Schema: public; Owner: headless-lms
--

COMMENT ON TABLE public.course_instances IS 'Allows teachers to use a course multiple times with different points, submissions, and enrollments.';


--
-- Name: courses; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.courses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid NOT NULL,
    deleted_at timestamp with time zone,
    slug character varying(255) DEFAULT "substring"(md5((random())::text), 0, 15) NOT NULL
);


ALTER TABLE public.courses OWNER TO "headless-lms";

--
-- Name: exercise_tasks; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.exercise_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exercise_id uuid NOT NULL,
    exercise_type character varying(255) NOT NULL,
    assignment jsonb DEFAULT '[]'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    private_spec jsonb,
    spec_file_id uuid,
    public_spec jsonb
);


ALTER TABLE public.exercise_tasks OWNER TO "headless-lms";

--
-- Name: exercises; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.exercises (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    course_id uuid NOT NULL,
    deleted_at timestamp with time zone,
    name character varying(255) NOT NULL,
    deadline timestamp with time zone,
    page_id uuid NOT NULL,
    score_maximum integer DEFAULT 1 NOT NULL,
    order_number integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.exercises OWNER TO "headless-lms";

--
-- Name: TABLE exercises; Type: COMMENT; Schema: public; Owner: headless-lms
--

COMMENT ON TABLE public.exercises IS 'Exercise is an collection of exercise tasks. The exercise itself does not contain any information on what kind of activities it contains -- that information lives inside the tasks. This enables us for example to combine different exercise types or to provide different assignments to different students.';


--
-- Name: gradings; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.gradings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    submission_id uuid NOT NULL,
    course_id uuid NOT NULL,
    exercise_id uuid NOT NULL,
    exercise_task_id uuid NOT NULL,
    grading_priority integer DEFAULT 100 NOT NULL,
    score_given real,
    grading_progress public.grading_progress DEFAULT 'not-ready'::public.grading_progress NOT NULL,
    unscaled_score_maximum real,
    unscaled_max_points integer,
    grading_started_at timestamp with time zone,
    grading_completed_at timestamp with time zone,
    feedback_json jsonb,
    feedback_text text,
    user_points_update_strategy public.user_points_update_strategy DEFAULT 'can-add-points-but-cannot-remove-points'::public.user_points_update_strategy NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.gradings OWNER TO "headless-lms";

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.organizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    slug character varying(255) DEFAULT "substring"(md5((random())::text), 0, 15) NOT NULL
);


ALTER TABLE public.organizations OWNER TO "headless-lms";

--
-- Name: pages; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.pages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    course_id uuid NOT NULL,
    content jsonb NOT NULL,
    url_path character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    deleted_at timestamp with time zone,
    chapter_id uuid,
    order_number integer NOT NULL
);


ALTER TABLE public.pages OWNER TO "headless-lms";

--
-- Name: regrading_submissions; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.regrading_submissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    regrading_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    grading_before_regrading uuid NOT NULL,
    grading_after_regrading uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.regrading_submissions OWNER TO "headless-lms";

--
-- Name: regradings; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.regradings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    regrading_started_at timestamp with time zone,
    regrading_completed_at timestamp with time zone,
    total_grading_progress public.grading_progress DEFAULT 'not-ready'::public.grading_progress NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.regradings OWNER TO "headless-lms";

--
-- Name: roles; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid,
    course_id uuid,
    role public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.roles OWNER TO "headless-lms";

--
-- Name: submissions; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.submissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    exercise_id uuid NOT NULL,
    course_id uuid NOT NULL,
    exercise_task_id uuid NOT NULL,
    data_json jsonb,
    grading_id uuid,
    metadata jsonb,
    user_id uuid NOT NULL,
    course_instance_id uuid NOT NULL
);


ALTER TABLE public.submissions OWNER TO "headless-lms";

--
-- Name: user_exercise_states; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.user_exercise_states (
    user_id uuid NOT NULL,
    exercise_id uuid NOT NULL,
    course_instance_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    score_given real,
    grading_progress public.grading_progress DEFAULT 'not-ready'::public.grading_progress NOT NULL,
    activity_progress public.activity_progress DEFAULT 'initialized'::public.activity_progress NOT NULL
);


ALTER TABLE public.user_exercise_states OWNER TO "headless-lms";

--
-- Name: TABLE user_exercise_states; Type: COMMENT; Schema: public; Owner: headless-lms
--

COMMENT ON TABLE public.user_exercise_states IS 'Keeps track of state related to a user and to an exercise. Each course instance run has their own entries in the table. It is the source of truth for activity status, points etc.';


--
-- Name: users; Type: TABLE; Schema: public; Owner: headless-lms
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    upstream_id integer
);


ALTER TABLE public.users OWNER TO "headless-lms";

--
-- Data for Name: _sqlx_migrations; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public._sqlx_migrations (version, description, installed_on, success, checksum, execution_time) FROM stdin;
20210216125447	setup db	2021-06-24 06:52:39.189572+00	t	\\xed69620a117b1ad71dc8d549d82dada87893eaba5fd0d0eea8f340944ccfd2da5a6a72302d29bd9f711dd9443aef0fb7	25210929
20210416062216	add slugs	2021-06-24 06:52:39.205562+00	t	\\x0f0950d22314db07bc35334975262cd80a0eec8e18b644968fa258616f01e2ca2bcd2eadd47cf69c326e6e578f31ac65	14498987
20210416092619	make exercise item assignment not null	2021-06-24 06:52:39.208869+00	t	\\x92ec07a7f0586d12b89345e16bee90f91e27d0a4d5f700f274ec8cce5526681f4bf5403a8ba43c27cb57d5ff695e781f	1711333
20210428102857	add score maximum to exercise	2021-06-24 06:52:39.212282+00	t	\\x8075aff261ee0fe01ddefede7125adfb0dc0ee3fa1208cdd417f582681aef2b9eeb0322027335f331c211c8abb7deab2	1550894
20210428152927	create course parts	2021-06-24 06:52:39.219359+00	t	\\x09e205bea70e19d791a36a1a87b44be00c592d6ffc9137990e70214cacd044f7b5e33b29693e6d92abbbb8a78433ea9f	5507470
20210430071032	add page id to course parts	2021-06-24 06:52:39.222634+00	t	\\xd5c87c39e19ba7825fd56190e029de2e6cddcfe999dbf8db4c9fab4ac082f97296a055815c06f091eb3ef4f1acf8ad59	1909723
20210430073130	add public spec to exercise items	2021-06-24 06:52:39.225957+00	t	\\x2d665fac77e58868b018e47f516b9df3e19b1f57911d92c4dc568c4266ac5764e8bdf35cda7a8c8cb34cfc466cadaddc	1728364
20210430121801	add course part id to pages	2021-06-24 06:52:39.229256+00	t	\\x866b856dcbcc407605afe0de2e449baebd05d2e0add8797712253d27ac79f15f0baed2b2a3845f60c41ca1bfa8579a66	1637385
20210503061144	add fix course path uniqueness index	2021-06-24 06:52:39.234093+00	t	\\x889ca123fe32a6e9b3a43c3a4bba852698e4edb90bff9a0e8ec9924aaed3fe5d7a748e83f1efe7abb383b7c6d1b23318	3300937
20210504040825	update submissions	2021-06-24 06:52:39.249425+00	t	\\xca0706c4a604cd65d4443a9c061e1e6c37aba2b12aef0b24fc2b33ca91068de215f808bb21a88ad3626a717731a78e0d	14023308
20210505102130	add users	2021-06-24 06:52:39.25468+00	t	\\x1f7e51a1d8450189852b46704f1640a4164eb4ddad52ddc7c226079f644024c9beade15907e677dc2d44053ede65cf49	3767137
20210505105627	make submission grading id nullable	2021-06-24 06:52:39.257576+00	t	\\x1961e2b5aee6ee15d83fc5462bfcfb692c3608733c54edfd2be164c91d048725d856e09bcbac3a1c81a065451f03bb19	1423325
20210528050335	rename unscaled max points to unscaled score maximum	2021-06-24 06:52:39.260834+00	t	\\x27c3f8777ffce072ae404ec8ffc37ddc45defc433acc1a81774c729fa44bf8b2fd8e52e1a43781b966055da136002baf	1752763
20210528091159	change deleted to deleted at	2021-06-24 06:52:39.299547+00	t	\\x5e93d7b8a3b4da29829665960ec973877ef1f26edd7e97ed659454375c8344283d90411eb40b81873aededaafc758ac9	37120785
20210603174417	change timestamps to have timezone	2021-06-24 06:52:39.340884+00	t	\\x81b82c69c53e62b92a3e3ad633ec53a91ba83cdf40b2e8a94b042de55d6aaa472c061c015f585ec540662a9c5f4a2f11	39890125
20210607104520	rename course parts to chapter	2021-06-24 06:52:39.344241+00	t	\\x37a7753cab98930a023fe7529e3cd5aec17dbbc47e6b534095e9f8738d7c1ded05f6bbfe836de3a4a87ffee3f406adf0	1707564
20210607113519	rename chapter page id to front page id	2021-06-24 06:52:39.347271+00	t	\\x1eaadb7ebf331d38d9fa1a657b7d1b395e1eac3272e421d404cc3f790bf92a126eb7a8ad310cb16a506415cecebc2915	1589474
20210607121853	page-order-number	2021-06-24 06:52:39.351926+00	t	\\x1fc32e96b836a5c57aeb7f1bd0a38ebf241b327db322c9282b04bb27432109e36c3c36d0fb53e0b2ac8b88a54ee3c5c4	3280198
20210607201656	create-roles	2021-06-24 06:52:39.358618+00	t	\\xd961e7911bfdda265b128123643898711cc1dcf1c1842f0bbe8ea9ee4f57e33c99a24e9709cb20f4a2429e6d697a6ec1	5210640
20210608070822	rename chapter contraints	2021-06-24 06:52:39.362378+00	t	\\x3f27540d2788dbf5b5c6d9e35e0e815070eed3b7d1a4e0106df194ca67cbcdb899938cf84fe0df0c958b141afbf10c69	2117092
20210609061756	change unique constraints to handle null values	2021-06-24 06:52:39.369287+00	t	\\x08d5cc99f6b70732506dd86e3e378c21a587bb377c390789b10c06241f995ed6ee0b673a53842018e7e2ef8ac25eed3f	5379910
20210609093333	add upstream id for users	2021-06-24 06:52:39.372523+00	t	\\x529cd407afab7cc5edbfb2965756111302ae017ac170a83c68b1d559f98477769b7954655efee2351e976ccd03539430	1803833
20210609111555	add user exercise states	2021-06-24 06:52:39.384495+00	t	\\x923243d4296da64a1cdde7b6eeca5fa3e2f9bf28c0d597e442cef1d014db521c6a019748aed473c9706d8d341ee45bc9	10540911
20210610124821	exercise order number	2021-06-24 06:52:39.387751+00	t	\\x278bbd9e506b6e199a5d9300e7747a5101026b99f964f7e8f5698af2b46e7a16498f0e1dda10922b5a4ec1450d65c816	1691074
20210611092622	add timestamps to user roles	2021-06-24 06:52:39.391285+00	t	\\x343b4b2012b9a8c1c27eef18a288a25fcdb37c92ae2236446fde66dc0319c3f7d6258263c3b5748dd93a1b1fe785e5a3	2056512
20210611094331	add course variant status to course instances	2021-06-24 06:52:39.394822+00	t	\\x72bffb397b30dc24f2b42b51ed02785a1299b2df1974f6734ddff13bd62ef453e96bcc3930e16de63ec0db75c9ebc0c2	2113792
20210614091624	rename exercise item to exercise task	2021-06-24 06:52:39.397733+00	t	\\x757d9f6b73f6e8b0e7dbba466c24cf2d78226b3fb808c831d3a1175b3e22e195a3ef16c84c5c078a798e8ad8e012c3d7	1688905
\.


--
-- Data for Name: chapters; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.chapters (id, name, course_id, chapter_number, created_at, updated_at, deleted_at, front_page_id) FROM stdin;
\.


--
-- Data for Name: course_instances; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.course_instances (id, created_at, updated_at, deleted_at, course_id, starts_at, ends_at, name, description, variant_status) FROM stdin;
d495025a-cf9f-49fa-9cbc-ee8eadf21fbe	2021-06-24 06:52:39.408327+00	2021-06-24 06:52:39.408327+00	\N	ae1c9573-273a-4b5d-a820-8a35426c7e94	\N	\N	\N	\N	upcoming
\.


--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.courses (id, name, created_at, updated_at, organization_id, deleted_at, slug) FROM stdin;
ae1c9573-273a-4b5d-a820-8a35426c7e94	Introduction to everything	2021-06-24 06:52:39.402914+00	2021-06-24 06:52:39.402914+00	6c32e817-bdf1-4696-a032-316cc83d96bb	\N	Introduction to everything
\.


--
-- Data for Name: exercise_tasks; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.exercise_tasks (id, created_at, updated_at, exercise_id, exercise_type, assignment, deleted_at, private_spec, spec_file_id, public_spec) FROM stdin;
\.


--
-- Data for Name: exercises; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.exercises (id, created_at, updated_at, course_id, deleted_at, name, deadline, page_id, score_maximum, order_number) FROM stdin;
\.


--
-- Data for Name: gradings; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.gradings (id, created_at, updated_at, submission_id, course_id, exercise_id, exercise_task_id, grading_priority, score_given, grading_progress, unscaled_score_maximum, unscaled_max_points, grading_started_at, grading_completed_at, feedback_json, feedback_text, user_points_update_strategy, deleted_at) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.organizations (id, name, created_at, updated_at, deleted_at, slug) FROM stdin;
6c32e817-bdf1-4696-a032-316cc83d96bb	University of Helsinki	2021-06-24 06:52:39.400411+00	2021-06-24 06:52:39.400411+00	\N	hy
5161acc4-388f-416c-8ef5-ccc525606527	University of Helsinki, Department of Mathematics and Statistics	2021-06-24 06:52:39.401556+00	2021-06-24 06:52:39.401556+00	\N	uh-mathstat
\.


--
-- Data for Name: pages; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.pages (id, created_at, updated_at, course_id, content, url_path, title, deleted_at, chapter_id, order_number) FROM stdin;
\.


--
-- Data for Name: regrading_submissions; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.regrading_submissions (id, created_at, updated_at, regrading_id, submission_id, grading_before_regrading, grading_after_regrading, deleted_at) FROM stdin;
\.


--
-- Data for Name: regradings; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.regradings (id, created_at, updated_at, regrading_started_at, regrading_completed_at, total_grading_progress, deleted_at) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.roles (id, user_id, organization_id, course_id, role, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: submissions; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.submissions (id, created_at, updated_at, deleted_at, exercise_id, course_id, exercise_task_id, data_json, grading_id, metadata, user_id, course_instance_id) FROM stdin;
\.


--
-- Data for Name: user_exercise_states; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.user_exercise_states (user_id, exercise_id, course_instance_id, created_at, updated_at, deleted_at, score_given, grading_progress, activity_progress) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: headless-lms
--

COPY public.users (id, created_at, updated_at, deleted_at, upstream_id) FROM stdin;
\.


--
-- Name: _sqlx_migrations _sqlx_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public._sqlx_migrations
    ADD CONSTRAINT _sqlx_migrations_pkey PRIMARY KEY (version);


--
-- Name: chapters chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);


--
-- Name: course_instances course_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.course_instances
    ADD CONSTRAINT course_instances_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: courses courses_slug_key; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_slug_key UNIQUE (slug);


--
-- Name: exercise_tasks exercise_items_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.exercise_tasks
    ADD CONSTRAINT exercise_items_pkey PRIMARY KEY (id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: gradings gradings_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.gradings
    ADD CONSTRAINT gradings_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: regrading_submissions regrading_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.regrading_submissions
    ADD CONSTRAINT regrading_submissions_pkey PRIMARY KEY (id);


--
-- Name: regradings regradings_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.regradings
    ADD CONSTRAINT regradings_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: user_exercise_states user_exercise_states_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.user_exercise_states
    ADD CONSTRAINT user_exercise_states_pkey PRIMARY KEY (user_id, exercise_id, course_instance_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: pages_order_number_uniqueness; Type: INDEX; Schema: public; Owner: headless-lms
--

CREATE UNIQUE INDEX pages_order_number_uniqueness ON public.pages USING btree (chapter_id, order_number) WHERE (deleted_at IS NULL);


--
-- Name: unique_chapters_chapter_number_course_id_when_not_deleted; Type: INDEX; Schema: public; Owner: headless-lms
--

CREATE UNIQUE INDEX unique_chapters_chapter_number_course_id_when_not_deleted ON public.chapters USING btree (chapter_number, course_id) WHERE (deleted_at IS NOT NULL);


--
-- Name: unique_pages_url_path_course_id_when_not_deleted; Type: INDEX; Schema: public; Owner: headless-lms
--

CREATE UNIQUE INDEX unique_pages_url_path_course_id_when_not_deleted ON public.pages USING btree (url_path, course_id) WHERE (deleted_at IS NOT NULL);


--
-- Name: chapters set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.chapters FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: course_instances set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.course_instances FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: courses set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: exercise_tasks set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.exercise_tasks FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: exercises set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: gradings set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.gradings FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: organizations set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: pages set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: regrading_submissions set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.regrading_submissions FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: regradings set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.regradings FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: roles set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: submissions set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: user_exercise_states set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.user_exercise_states FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: users set_timestamp; Type: TRIGGER; Schema: public; Owner: headless-lms
--

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: chapters chapters_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: chapters chapters_front_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_front_page_id_fkey FOREIGN KEY (front_page_id) REFERENCES public.pages(id);


--
-- Name: course_instances course_instances_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.course_instances
    ADD CONSTRAINT course_instances_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: courses courses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: exercise_tasks exercise_items_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.exercise_tasks
    ADD CONSTRAINT exercise_items_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: exercises exercises_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: exercises exercises_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id);


--
-- Name: gradings gradings_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.gradings
    ADD CONSTRAINT gradings_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: gradings gradings_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.gradings
    ADD CONSTRAINT gradings_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: gradings gradings_exercise_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.gradings
    ADD CONSTRAINT gradings_exercise_item_id_fkey FOREIGN KEY (exercise_task_id) REFERENCES public.exercise_tasks(id);


--
-- Name: gradings gradings_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.gradings
    ADD CONSTRAINT gradings_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id);


--
-- Name: pages pages_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id);


--
-- Name: pages pages_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: regrading_submissions regrading_submissions_grading_after_regrading_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.regrading_submissions
    ADD CONSTRAINT regrading_submissions_grading_after_regrading_fkey FOREIGN KEY (grading_after_regrading) REFERENCES public.gradings(id);


--
-- Name: regrading_submissions regrading_submissions_grading_before_regrading_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.regrading_submissions
    ADD CONSTRAINT regrading_submissions_grading_before_regrading_fkey FOREIGN KEY (grading_before_regrading) REFERENCES public.gradings(id);


--
-- Name: regrading_submissions regrading_submissions_regrading_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.regrading_submissions
    ADD CONSTRAINT regrading_submissions_regrading_id_fkey FOREIGN KEY (regrading_id) REFERENCES public.regradings(id);


--
-- Name: regrading_submissions regrading_submissions_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.regrading_submissions
    ADD CONSTRAINT regrading_submissions_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id);


--
-- Name: roles roles_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: roles roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: roles roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: submissions submissions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: submissions submissions_course_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_course_instance_id_fkey FOREIGN KEY (course_instance_id) REFERENCES public.course_instances(id);


--
-- Name: submissions submissions_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: submissions submissions_exercise_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_exercise_item_id_fkey FOREIGN KEY (exercise_task_id) REFERENCES public.exercise_tasks(id);


--
-- Name: submissions submissions_grading_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_grading_id_fkey FOREIGN KEY (grading_id) REFERENCES public.gradings(id);


--
-- Name: submissions submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_exercise_states user_exercise_states_course_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.user_exercise_states
    ADD CONSTRAINT user_exercise_states_course_instance_id_fkey FOREIGN KEY (course_instance_id) REFERENCES public.course_instances(id);


--
-- Name: user_exercise_states user_exercise_states_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.user_exercise_states
    ADD CONSTRAINT user_exercise_states_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: user_exercise_states user_exercise_states_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: headless-lms
--

ALTER TABLE ONLY public.user_exercise_states
    ADD CONSTRAINT user_exercise_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

