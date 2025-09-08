

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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "level" "text" DEFAULT 'info'::"text" NOT NULL,
    "type" "text" NOT NULL,
    "properties" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "hashed_ip" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "events_level_check" CHECK (("level" = ANY (ARRAY['info'::"text", 'warn'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "therapist_id" "uuid",
    "patient_id" "uuid",
    "status" "text" DEFAULT 'proposed'::"text",
    "commission_collected" numeric DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "secure_uuid" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "responded_at" timestamp with time zone,
    "therapist_contacted_at" timestamp with time zone,
    "therapist_responded_at" timestamp with time zone,
    "patient_confirmed_at" timestamp with time zone
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "name" "text",
    "type" "text",
    "status" "text" DEFAULT 'new'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "people_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'pending_verification'::"text", 'verified'::"text", 'rejected'::"text"]))),
    CONSTRAINT "people_type_check" CHECK (("type" = ANY (ARRAY['patient'::"text", 'therapist'::"text"])))
);


ALTER TABLE "public"."people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."therapist_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "therapist_id" "uuid" NOT NULL,
    "contract_version" "text" DEFAULT 'v1.0'::"text" NOT NULL,
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."therapist_contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."therapists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "phone" "text",
    "gender" "text",
    "city" "text",
    "photo_url" "text",
    "modalities" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "session_preferences" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending_verification'::"text" NOT NULL,
    "approach_text" "text",
    "accepting_new" boolean DEFAULT true NOT NULL,
    "typical_rate" integer,
    "availability_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "therapists_status_check" CHECK (("status" = ANY (ARRAY['pending_verification'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."therapists" OWNER TO "postgres";


ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."therapist_contracts"
    ADD CONSTRAINT "therapist_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."therapists"
    ADD CONSTRAINT "therapists_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."therapists"
    ADD CONSTRAINT "therapists_pkey" PRIMARY KEY ("id");



CREATE INDEX "events_created_at_idx" ON "public"."events" USING "btree" ("created_at" DESC);



CREATE INDEX "events_level_idx" ON "public"."events" USING "btree" ("level");



CREATE INDEX "events_type_idx" ON "public"."events" USING "btree" ("type");



CREATE INDEX "idx_therapist_contracts_therapist_id" ON "public"."therapist_contracts" USING "btree" ("therapist_id");



CREATE UNIQUE INDEX "matches_secure_uuid_key" ON "public"."matches" USING "btree" ("secure_uuid");



CREATE INDEX "people_metadata_gin_idx" ON "public"."people" USING "gin" ("metadata");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."people"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."therapist_contracts"
    ADD CONSTRAINT "therapist_contracts_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Allow all operations for authenticated users" ON "public"."matches" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations for authenticated users" ON "public"."people" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."people" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service role can insert" ON "public"."events" FOR INSERT TO "service_role" WITH CHECK (true);



ALTER TABLE "public"."therapist_contracts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."therapists" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";








































































































































































GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."people" TO "anon";
GRANT ALL ON TABLE "public"."people" TO "authenticated";
GRANT ALL ON TABLE "public"."people" TO "service_role";



GRANT ALL ON TABLE "public"."therapist_contracts" TO "anon";
GRANT ALL ON TABLE "public"."therapist_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."therapist_contracts" TO "service_role";



GRANT ALL ON TABLE "public"."therapists" TO "anon";
GRANT ALL ON TABLE "public"."therapists" TO "authenticated";
GRANT ALL ON TABLE "public"."therapists" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
