# Course Material Generated Migration Checklist

Current state:

- `services/headless-lms/server/src/controllers/course_material` is annotated and aggregated into OpenAPI by subtree.
- `services/headless-lms/server/src/openapi.rs` exports both `main-frontend` and `course-material`.
- `services/headless-lms/server/openapi/course-material.openapi.json` exists and is generated from the backend docs.
- `services/main-frontend/openapi-ts.config.ts` targets both `main-frontend` and `course-material`.
- `services/main-frontend/src/generated/course-material-api/` contains the generated SDK, types, zod validators, and React Query helpers.
- `services/main-frontend/src/services/course-material/backend.ts` and `courseMaterialClient.ts` have been removed.

Use the same checklist rule as the `main-frontend` migration:

- Do not mark an item done until backend OpenAPI is in place, frontend generated code exists, callers are migrated, and verification passes.

Backend

- [x] `services/headless-lms/server/src/openapi.rs`
- [x] `services/headless-lms/server/src/bin/export_openapi.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/mod.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/chapters.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/chatbot.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/code_giveaways.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/course_instances.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/course_modules.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/courses.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/exams.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/exercises.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/glossary.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/oembed.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/organizations.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/page_audio_files.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/pages.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/proposed_edits.rs`
- [x] `services/headless-lms/server/src/controllers/course_material/user_details.rs`

Frontend

- [x] `services/main-frontend/openapi-ts.config.ts`
- [x] `services/main-frontend/src/services/course-material/backend.ts`
- [x] `services/main-frontend/src/services/course-material/courseMaterialClient.ts`

Verification

- [x] `cargo fmt -p headless-lms-server`
- [x] `SQLX_OFFLINE=1 cargo check -p headless-lms-server`
- [x] `pnpm run export-openapi`
- [x] `pnpm run codegen:api`
- [x] `cd services/main-frontend && pnpm exec tsc --noEmit`
