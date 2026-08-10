//! Fixtures for the credit-registration (Suotar) system tests.
//!
//! Student numbers are `90000SSPP`: `SS` the spec index listed below, `PP` the person within that
//! spec, the leading `9` keeping them clear of real UH numbers. Digits only, 6–12 of them, per
//! `verified_student_numbers.student_number_format`.
//!
//! Account linking and worker ticks are both global — one spec's tick advances every eligible row in
//! the shared database — so two specs sharing a student number would see each other's registration
//! attempts. Each spec under `system-tests/src/tests/credit-registration/` owns one `SS`, and the
//! mock Suotar's persons must reuse the same numbers: 01 `suotar-happy-path`,
//! 02 `suotar-account-linking`, 03 `suotar-enrolment-problems`, 04 `suotar-import-outcomes`,
//! 05 `suotar-verify-outcomes`, 06 `suotar-sisu-outage`, 07 `suotar-consent`,
//! 08 `suotar-teacher-views`, 09 `suotar-admin-dashboard`, 10 `suotar-old-flow-coexistence`,
//! 11 `suotar-backfill-and-late-consent`, 12 `suotar-grade-improvement`,
//! 13 `suotar-student-emails`, 14 `suotar-fast-track-linking`, 15 `suotar-in-course-banner`,
//! 16 `suotar-student-profile`.
//!
//! Names and emails are unlikely strings (`Zzyzx …`) because a spec asserts their absence from the
//! scrubbed Suotar API log.
//!
//! The backfill course keeps `enable_credit_registration_via_suotar` off and nothing may turn it on:
//! its spec flips it from the UI, which is one-way and run-wide. Every other course has it on.
//!
//! The workers tick every phase unscoped every few seconds in the test deployment, so a fixture row
//! nothing may move has to sit on a paused module — that is what the states course is for.

use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use headless_lms_base::config::{SuotarConfiguration, bool_env_false_by_default};
use headless_lms_models::{
    PKeyPolicy, course_credit_registration_consents, course_instance_enrollments,
    course_module_completions::{self, NewCourseModuleCompletionSeed},
    credit_registration_account_linking_emails::{self, NewAccountLinkingEmail},
    credit_registration_admin_actions::{
        self, COURSE_TEACHER_ROLE, CreditRegistrationAdminAction,
        CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE, NewCreditRegistrationAdminAction,
    },
    credit_registrations::{
        self, CreditRegistrationErrorCode, CreditRegistrationState, NewCreditRegistration,
        PayloadSnapshot, Transition,
    },
    roles::UserRole,
    student_number_verification_tokens::{self, SeedStudentNumberVerificationToken},
    study_registry_registrars::{self, get_or_create_default_registrar},
    user_details::{self, EmailVerificationMethod},
    user_passwords::{hash_password, upsert_user_password},
    users,
    verified_student_numbers::{self, NewVerifiedStudentNumber, StudentNumberVerificationMethod},
};
use headless_lms_utils::http::REQWEST_CLIENT;
use secrecy::SecretString;
use sqlx::PgConnection;
use tracing::info;
use uuid::Uuid;

use crate::controllers::mock_suotar::commands::{
    CourseUnitUpsert, EnrolmentUpsert, PersonUpsert, ProductAccessTokenUpsert, RealisationUpsert,
    WorldPush,
};
use crate::controllers::mock_suotar::ids as mock_ids;
use crate::controllers::mock_suotar::world::{
    CourseBehaviour, CreditRange, DatePeriod, EnrolmentState, LocalizedName, PersonBehaviour,
    RealisationKind, Ripeness, WorldDefaults,
};
use crate::programs::seed::builder::{
    chapter::ChapterBuilder,
    context::SeedContext,
    course::{CourseBuilder, CourseInstanceConfig},
    module::{
        CompletionBuilder, CompletionRegisteredBuilder, CreditRegistrationSeed, ModuleBuilder,
    },
    page::PageBuilder,
};
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_helpers::paragraph;

/// The course the Suotar specs live on.
pub const SUOTAR_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0001_4a5e_9e6e_c0de00000001);
/// A course left on the legacy open-university pull flow, for the coexistence specs.
pub const OLD_FLOW_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0002_4a5e_9e6e_c0de00000002);
/// Owned by `suotar-import-outcomes.spec.ts`; its modules are the failing shapes.
pub const IMPORT_OUTCOMES_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0004_4a5e_9e6e_c0de00000004);
/// Owned by `suotar-grade-improvement.spec.ts`, and the only graded module here.
pub const GRADE_IMPROVEMENT_COURSE_ID: Uuid =
    Uuid::from_u128(0xc5ed17ea_0005_4a5e_9e6e_c0de00000005);
/// Owned outright by `suotar-backfill-and-late-consent.spec.ts`, which flips the Suotar flag on.
pub const BACKFILL_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0003_4a5e_9e6e_c0de00000003);
/// Owned exclusively by `suotar-admin-dashboard.spec.ts`: discovery and the linking mails tick by
/// course, so the spec that ticks them needs a course no other spec has students on.
pub const ADMIN_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0006_4a5e_9e6e_c0de00000006);
/// One frozen ledger row per registration state and per error code, on a paused module. Read by
/// `suotar-teacher-views.spec.ts` and the admin explorer, written by neither.
pub const STATES_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0007_4a5e_9e6e_c0de00000007);

/// A study registry registrar whose key a spec can present, so the legacy pull stream is readable
/// from a test. Every other registrar's key is random by design.
pub const PULL_REGISTRAR_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0008_4a5e_9e6e_c0de00000008);
pub const PULL_REGISTRAR_SECRET_KEY: &str = "credit-registration-system-tests-pull-registrar";

/// The seeded attempt chain, by fixed id so a spec can open the detail page without searching.
pub const SUPERSEDED_ATTEMPT_1_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0901_4a5e_9e6e_c0de00000901);
pub const SUPERSEDED_ATTEMPT_2_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0902_4a5e_9e6e_c0de00000902);

/// Linking tokens for `suotar-account-linking.spec.ts`, seeded rather than mailed.
///
/// Each is a UUID repeated four times because `student_number_verification_token_length` requires at
/// least 128 characters.
pub const LINKING_TOKEN_VALID: &str = concat!(
    "11111111-1111-1111-1111-111111111111",
    "11111111-1111-1111-1111-111111111111",
    "11111111-1111-1111-1111-111111111111",
    "11111111-1111-1111-1111-111111111111",
);
pub const LINKING_TOKEN_EXPIRED: &str = concat!(
    "22222222-2222-2222-2222-222222222222",
    "22222222-2222-2222-2222-222222222222",
    "22222222-2222-2222-2222-222222222222",
    "22222222-2222-2222-2222-222222222222",
);
pub const LINKING_TOKEN_ALREADY_USED: &str = concat!(
    "33333333-3333-3333-3333-333333333333",
    "33333333-3333-3333-3333-333333333333",
    "33333333-3333-3333-3333-333333333333",
    "33333333-3333-3333-3333-333333333333",
);
/// Its student number is already live on another account, so claiming it is refused without
/// consuming the token.
pub const LINKING_TOKEN_CONFLICT: &str = concat!(
    "44444444-4444-4444-4444-444444444444",
    "44444444-4444-4444-4444-444444444444",
    "44444444-4444-4444-4444-444444444444",
    "44444444-4444-4444-4444-444444444444",
);

pub const CRS_101: &str = "CRS-101";
pub const CRS_102: &str = "CRS-102";
pub const CRS_OLD_101: &str = "CRS-OLD-101";
/// The module `suotar-old-flow-coexistence.spec.ts` treats as already cut over: Suotar-enabled, but
/// holding a completion the legacy pull path registered before the cutover happened.
pub const CRS_OLD_102: &str = "CRS-OLD-102";
pub const CRS_BACKFILL_101: &str = "CRS-BACKFILL-101";
pub const CRS_ADMIN_101: &str = "CRS-ADMIN-101";
pub const CRS_STATES_101: &str = "CRS-STATES-101";

pub const CRS_GRADED_101: &str = "CRS-GRADED-101";
/// One module per import failure, each breaking exactly one thing.
pub const CRS_IMPORT_101: &str = "CRS-IMPORT-101";
pub const CRS_IMPORT_102: &str = "CRS-IMPORT-102";
pub const CRS_IMPORT_103: &str = "CRS-IMPORT-103";
pub const CRS_IMPORT_104: &str = "CRS-IMPORT-104";
pub const IMPORT_OUTCOME_COURSE_CODES: [&str; 4] = [
    CRS_IMPORT_101,
    CRS_IMPORT_102,
    CRS_IMPORT_103,
    CRS_IMPORT_104,
];

pub const SUOTAR_COURSE_SLUG: &str = "credit-registration-via-suotar";
pub const OLD_FLOW_COURSE_SLUG: &str = "credit-registration-old-flow";
pub const BACKFILL_COURSE_SLUG: &str = "credit-registration-backfill";
pub const IMPORT_OUTCOMES_COURSE_SLUG: &str = "credit-registration-import-outcomes";
pub const GRADE_IMPROVEMENT_COURSE_SLUG: &str = "credit-registration-grade-improvement";
pub const ADMIN_COURSE_SLUG: &str = "credit-registration-admin";
pub const STATES_COURSE_SLUG: &str = "credit-registration-states";

/// A seeded student and the Sisu person the mock must answer with for them. The database rows and
/// the pushed persons must carry the same identifiers, so both are built from here.
pub struct MockPersonFixture {
    pub student_number: &'static str,
    pub first_names: &'static str,
    pub last_name: &'static str,
    /// Where the account-linking mail goes.
    pub sisu_email: &'static str,
    pub account_email: Option<&'static str>,
}

impl MockPersonFixture {
    fn sisu_person_id(&self) -> String {
        format!("hy-hlo-{}", self.student_number)
    }
}

pub const CONSENTED_LINKED: MockPersonFixture = MockPersonFixture {
    student_number: "900000101",
    first_names: "Zzyzx",
    last_name: "Happypath",
    sisu_email: "zzyzx.happypath@helsinki.example",
    account_email: Some("credit-registration-consented-linked@example.com"),
};
pub const CONSENTED_UNLINKED: MockPersonFixture = MockPersonFixture {
    student_number: "900000102",
    first_names: "Zzyzx",
    last_name: "Linkpending",
    sisu_email: "zzyzx.linkpending@helsinki.example",
    account_email: Some("credit-registration-consented-unlinked@example.com"),
};
/// Never asked for consent, which is what makes the course-start dialog appear.
pub const NOT_CONSENTED: MockPersonFixture = MockPersonFixture {
    student_number: "900000103",
    first_names: "Zzyzx",
    last_name: "Noconsent",
    sisu_email: "zzyzx.noconsent@helsinki.example",
    account_email: Some("credit-registration-not-consented@example.com"),
};
/// The import that times out. Its own person, so the fault keyed on this student number cannot reach
/// another spec's row on the shared course.
pub const IMPORT_TIMEOUT: MockPersonFixture = MockPersonFixture {
    student_number: "900000402",
    first_names: "Zzyzx",
    last_name: "Timedout",
    sisu_email: "zzyzx.timedout@helsinki.example",
    account_email: Some("credit-registration-import-timeout@example.com"),
};
/// Deliberately absent from the mock's enrolments: the only way to reach `no_usable_enrolment`
/// without arming a fault.
pub const NO_ENROLMENT: MockPersonFixture = MockPersonFixture {
    student_number: "900000301",
    first_names: "Zzyzx",
    // Not "Notenrolled": its trigram distance from "notexisting" is close enough to spuriously
    // match search-users.spec.ts's no-such-user search.
    last_name: "Unenrolled",
    sisu_email: "zzyzx.unenrolled@helsinki.example",
    account_email: Some("credit-registration-no-enrolment@example.com"),
};
/// Enrolled on one course twice, through a degree programme and through the open university, so the
/// selection policy has something to choose between.
pub const TWO_ENROLMENTS: MockPersonFixture = MockPersonFixture {
    student_number: "900000302",
    first_names: "Zzyzx",
    last_name: "Twicenrolled",
    sisu_email: "zzyzx.twicenrolled@helsinki.example",
    account_email: Some("credit-registration-two-enrolments@example.com"),
};
pub const VERIFY_POLLING: MockPersonFixture = MockPersonFixture {
    student_number: "900000501",
    first_names: "Zzyzx",
    last_name: "Polling",
    sisu_email: "zzyzx.polling@helsinki.example",
    account_email: Some("credit-registration-verify-polling@example.com"),
};
pub const VERIFY_MISREGISTERED: MockPersonFixture = MockPersonFixture {
    student_number: "900000502",
    first_names: "Zzyzx",
    last_name: "Reversed",
    sisu_email: "zzyzx.reversed@helsinki.example",
    account_email: Some("credit-registration-verify-misregistered@example.com"),
};
/// Never asked, but eligible otherwise: its row would move the moment consent arrived.
pub const CONSENT_WITHHELD: MockPersonFixture = MockPersonFixture {
    student_number: "900000701",
    first_names: "Zzyzx",
    last_name: "Unasked",
    sisu_email: "zzyzx.unasked@helsinki.example",
    account_email: Some("credit-registration-consent-withheld@example.com"),
};
pub const CONSENT_WITHDRAWN: MockPersonFixture = MockPersonFixture {
    student_number: "900000702",
    first_names: "Zzyzx",
    last_name: "Withdrawn",
    sisu_email: "zzyzx.withdrawn@helsinki.example",
    account_email: Some("credit-registration-consent-withdrawn@example.com"),
};
pub const ADMIN_UNLINKED: MockPersonFixture = MockPersonFixture {
    student_number: "900000902",
    first_names: "Zzyzx",
    last_name: "Unlinked",
    sisu_email: "zzyzx.unlinked@helsinki.example",
    account_email: Some("credit-registration-admin-unlinked@example.com"),
};
/// Mailed to the cap, never claimed, no account: the stale-address population is the only place the
/// resend and manual-link actions render.
pub const ADMIN_STALE: MockPersonFixture = MockPersonFixture {
    student_number: "900000903",
    first_names: "Zzyzx",
    last_name: "Deadaddress",
    sisu_email: "zzyzx.deadaddress@helsinki.example",
    account_email: None,
};
/// A second capped person on `ADMIN_STALE`'s course, owned by the teacher specs so a cap-refused
/// resend cannot race whichever spec is overriding the cap.
pub const TEACHER_RESEND_CAPPED: MockPersonFixture = MockPersonFixture {
    student_number: "900000804",
    first_names: "Zzyzx",
    last_name: "Cappedmail",
    sisu_email: "zzyzx.cappedmail@helsinki.example",
    account_email: None,
};

pub const ADMIN_LINKED: MockPersonFixture = MockPersonFixture {
    student_number: "900000904",
    first_names: "Zzyzx",
    last_name: "Alreadylinked",
    sisu_email: "zzyzx.alreadylinked@helsinki.example",
    account_email: Some("credit-registration-admin-linked@example.com"),
};

/// Three distinct addresses out of one Sisu address: the dedup key is the address and the cap is
/// three mails per person and course.
const MAILED_ADDRESS_SUFFIXES: [&str; 3] = ["", "old.", "older."];

/// Enrolled on a Suotar course and nothing else, for the profile tab's empty state.
pub const PROFILE_EMPTY_EMAIL: &str = "credit-registration-profile-empty@example.com";

/// Claims the seeded linking tokens, and holds no student number of its own: the tokens are unbound
/// and bind to whoever opens the link.
pub const LINK_CLAIMER_EMAIL: &str = "credit-registration-link-claimer@example.com";
pub const LINK_VALID: MockPersonFixture = MockPersonFixture {
    student_number: "900000201",
    first_names: "Zzyzx",
    last_name: "Linkvalid",
    sisu_email: "zzyzx.linkvalid@helsinki.example",
    account_email: None,
};
pub const LINK_EXPIRED: MockPersonFixture = MockPersonFixture {
    student_number: "900000202",
    first_names: "Zzyzx",
    last_name: "Linkexpired",
    sisu_email: "zzyzx.linkexpired@helsinki.example",
    account_email: None,
};
pub const LINK_USED: MockPersonFixture = MockPersonFixture {
    student_number: "900000203",
    first_names: "Zzyzx",
    last_name: "Linkused",
    sisu_email: "zzyzx.linkused@helsinki.example",
    account_email: None,
};
pub const SUPERSEDED: MockPersonFixture = MockPersonFixture {
    student_number: "900000901",
    first_names: "Zzyzx",
    last_name: "Regraded",
    sisu_email: "zzyzx.regraded@helsinki.example",
    account_email: Some("credit-registration-superseded@example.com"),
};
/// Its Sisu address equals the account address, which is what the fast track fires on; the twin
/// below differs only in the account's verification flag.
pub const FAST_TRACK_VERIFIED: MockPersonFixture = MockPersonFixture {
    student_number: "900001401",
    first_names: "Zzyzx",
    last_name: "Fasttrack",
    sisu_email: "credit-registration-verified-email@example.com",
    account_email: Some("credit-registration-verified-email@example.com"),
};
pub const FAST_TRACK_TWIN: MockPersonFixture = MockPersonFixture {
    student_number: "900001402",
    first_names: "Zzyzx",
    last_name: "Nearmiss",
    sisu_email: "credit-registration-unverified-twin@example.com",
    account_email: Some("credit-registration-unverified-twin@example.com"),
};

pub const IMPORT_OUTCOMES: MockPersonFixture = MockPersonFixture {
    student_number: "900000401",
    first_names: "Zzyzx",
    last_name: "Importoutcomes",
    sisu_email: "zzyzx.importoutcomes@helsinki.example",
    account_email: Some("credit-registration-import-outcomes@example.com"),
};
pub const GRADE_IMPROVEMENT: MockPersonFixture = MockPersonFixture {
    student_number: "900001201",
    first_names: "Zzyzx",
    last_name: "Improved",
    sisu_email: "zzyzx.improved@helsinki.example",
    account_email: Some("credit-registration-grade-improvement@example.com"),
};

pub const BACKFILL_STUDENTS: [MockPersonFixture; 4] = [
    MockPersonFixture {
        student_number: "900001101",
        first_names: "Zzyzx",
        last_name: "Backfill1",
        sisu_email: "zzyzx.backfill1@helsinki.example",
        account_email: Some("credit-registration-backfill-1@example.com"),
    },
    MockPersonFixture {
        student_number: "900001102",
        first_names: "Zzyzx",
        last_name: "Backfill2",
        sisu_email: "zzyzx.backfill2@helsinki.example",
        account_email: Some("credit-registration-backfill-2@example.com"),
    },
    MockPersonFixture {
        student_number: "900001103",
        first_names: "Zzyzx",
        last_name: "Backfill3",
        sisu_email: "zzyzx.backfill3@helsinki.example",
        account_email: Some("credit-registration-backfill-3@example.com"),
    },
    MockPersonFixture {
        student_number: "900001104",
        first_names: "Zzyzx",
        last_name: "Backfill4",
        sisu_email: "zzyzx.backfill4@helsinki.example",
        account_email: Some("credit-registration-backfill-4@example.com"),
    },
];

/// A seeded student, with the deterministic id a spec navigates by.
struct SeededStudent {
    user_id: Uuid,
    email: String,
}

pub async fn seed_credit_registration(common_course_data: CommonCourseData) -> Result<Uuid> {
    let CommonCourseData {
        db_pool,
        organization_id: org,
        teacher_user_id,
        base_url,
        ..
    } = common_course_data;

    let mut conn = db_pool.acquire().await?;
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: SUOTAR_COURSE_ID,
    };

    info!("inserting credit registration courses");

    let suotar_instance_id = cx.v5(b"instance:suotar");
    let (suotar_course, suotar_instance, _) =
        CourseBuilder::new("Credit registration via Suotar", SUOTAR_COURSE_SLUG)
            .desc("Fixture course for the credit registration system tests.")
            .course_id(SUOTAR_COURSE_ID)
            .role(teacher_user_id, UserRole::Teacher)
            .instance(instance_config(suotar_instance_id))
            .module(
                ModuleBuilder::new()
                    .order(0)
                    .ects(5.0)
                    .uh_course_code(CRS_101.to_string())
                    .credit_registration(credit_registration_config(CRS_101, true))
                    .chapter(
                        ChapterBuilder::new(1, "Registering credits")
                            .opens(Utc::now())
                            .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:front-page"))
                            .page(
                                PageBuilder::new("/chapter-1/page-1", "How registration works")
                                    .block(paragraph(
                                        "Completing this module registers credits into Sisu.",
                                        cx.v5(b"page:1:1:block"),
                                    )),
                            ),
                    ),
            )
            .module(
                ModuleBuilder::new()
                    .order(1)
                    .name("Second module")
                    .ects(3.0)
                    .uh_course_code(CRS_102.to_string())
                    .credit_registration(credit_registration_config(CRS_102, false)),
            )
            .seed(&mut conn, &cx)
            .await?;

    seed_old_flow_course(&mut conn, org, teacher_user_id).await?;
    seed_backfill_course(&mut conn, org, teacher_user_id).await?;
    seed_import_outcomes_course(&mut conn, org, teacher_user_id).await?;
    seed_grade_improvement_course(&mut conn, org, teacher_user_id).await?;
    seed_admin_course(&mut conn, org, teacher_user_id).await?;
    seed_states_course(&mut conn, org, teacher_user_id).await?;

    info!("inserting credit registration students");

    let consented_linked = insert_student(
        &mut conn,
        cx.v5(b"user:consented-linked"),
        "credit-registration-consented-linked@example.com",
        "Zzyzx",
        "Happypath",
    )
    .await?;
    let consented_unlinked = insert_student(
        &mut conn,
        cx.v5(b"user:consented-unlinked"),
        "credit-registration-consented-unlinked@example.com",
        "Zzyzx",
        "Linkpending",
    )
    .await?;
    let not_consented = insert_student(
        &mut conn,
        cx.v5(b"user:not-consented"),
        "credit-registration-not-consented@example.com",
        "Zzyzx",
        "Noconsent",
    )
    .await?;
    let verified_email = insert_student(
        &mut conn,
        cx.v5(b"user:verified-email"),
        "credit-registration-verified-email@example.com",
        "Zzyzx",
        "Fasttrack",
    )
    .await?;
    let unverified_twin = insert_student(
        &mut conn,
        cx.v5(b"user:unverified-twin"),
        "credit-registration-unverified-twin@example.com",
        "Zzyzx",
        "Nearmiss",
    )
    .await?;
    let superseded_student = insert_student(
        &mut conn,
        cx.v5(b"user:superseded-attempts"),
        "credit-registration-superseded@example.com",
        "Zzyzx",
        "Regraded",
    )
    .await?;

    let link_claimer = insert_student(
        &mut conn,
        cx.v5(b"user:link-claimer"),
        LINK_CLAIMER_EMAIL,
        "Zzyzx",
        "Claimer",
    )
    .await?;
    let profile_empty = insert_student(
        &mut conn,
        cx.v5(b"user:profile-empty"),
        PROFILE_EMPTY_EMAIL,
        "Zzyzx",
        "Emptyprofile",
    )
    .await?;

    for student in [
        &consented_linked,
        &consented_unlinked,
        &not_consented,
        &verified_email,
        &unverified_twin,
        &superseded_student,
        &link_claimer,
        &profile_empty,
    ] {
        course_instance_enrollments::insert(
            &mut conn,
            student.user_id,
            suotar_course.id,
            suotar_instance.id,
        )
        .await?;
    }

    // Consented, linked and completed; the mock's enrolments decide which of them gets stuck where.
    for fixture in [
        &IMPORT_TIMEOUT,
        &NO_ENROLMENT,
        &TWO_ENROLMENTS,
        &VERIFY_POLLING,
        &VERIFY_MISREGISTERED,
        &CONSENT_WITHDRAWN,
    ] {
        let student = seed_spec_student(
            &mut conn,
            &cx,
            fixture,
            suotar_course.id,
            suotar_instance.id,
            true,
        )
        .await?;
        seed_eligible_completion(&mut conn, &student, suotar_course.id, None).await?;
    }
    let consent_withheld = seed_spec_student(
        &mut conn,
        &cx,
        &CONSENT_WITHHELD,
        suotar_course.id,
        suotar_instance.id,
        false,
    )
    .await?;
    seed_eligible_completion(&mut conn, &consent_withheld, suotar_course.id, None).await?;

    // `not_consented` gets no row at all: a missing row is what makes the course-start dialog
    // appear, while `consent_given = false` means asked and declined.
    for student in [&consented_linked, &consented_unlinked, &verified_email] {
        course_credit_registration_consents::upsert(
            &mut conn,
            student.user_id,
            suotar_course.id,
            true,
        )
        .await?;
    }
    course_credit_registration_consents::upsert(
        &mut conn,
        superseded_student.user_id,
        suotar_course.id,
        true,
    )
    .await?;

    verified_student_numbers::insert(
        &mut conn,
        PKeyPolicy::Fixed(cx.v5(b"verified-student-number:consented-linked")),
        &NewVerifiedStudentNumber {
            user_id: consented_linked.user_id,
            student_number: CONSENTED_LINKED.student_number.to_string(),
            sisu_person_id: CONSENTED_LINKED.sisu_person_id(),
            first_names: Some(CONSENTED_LINKED.first_names.to_string()),
            last_name: Some(CONSENTED_LINKED.last_name.to_string()),
            verified_via: StudentNumberVerificationMethod::EmailedLink,
            verified_via_email: Some(CONSENTED_LINKED.sisu_email.to_string()),
            verified_via_email_match_field: None,
            account_email_verified_at: None,
            linked_by_user_id: None,
            link_reason: None,
            verified_from_course_id: Some(suotar_course.id),
        },
    )
    .await?;
    verified_student_numbers::insert(
        &mut conn,
        PKeyPolicy::Fixed(cx.v5(b"verified-student-number:superseded")),
        &NewVerifiedStudentNumber {
            user_id: superseded_student.user_id,
            student_number: SUPERSEDED.student_number.to_string(),
            sisu_person_id: SUPERSEDED.sisu_person_id(),
            first_names: Some(SUPERSEDED.first_names.to_string()),
            last_name: Some(SUPERSEDED.last_name.to_string()),
            verified_via: StudentNumberVerificationMethod::EmailedLink,
            verified_via_email: Some(SUPERSEDED.sisu_email.to_string()),
            verified_via_email_match_field: None,
            account_email_verified_at: None,
            linked_by_user_id: None,
            link_reason: None,
            verified_from_course_id: Some(suotar_course.id),
        },
    )
    .await?;

    // `verified_email` and `unverified_twin` differ only in this flag, and the mock Suotar person
    // for each must hold that account's own address as its primary email for the match to fire.
    // Without a verified address, an email match is an impersonation primitive.
    user_details::set_email_verified(
        &mut conn,
        verified_email.user_id,
        EmailVerificationMethod::EmailedCode,
        Utc::now() - Duration::days(30),
    )
    .await?;

    // The happy-path actor answers the consent dialog itself, so its completion has to wait here.
    seed_eligible_completion(&mut conn, &not_consented, suotar_course.id, None).await?;

    info!("inserting credit registration linking tokens");
    seed_linking_tokens(&mut conn, &cx, suotar_course.id, unverified_twin.user_id).await?;

    info!("inserting credit registration ledger history");
    seed_superseded_attempt_pair(
        &mut conn,
        &superseded_student,
        suotar_course.id,
        suotar_instance.id,
    )
    .await?;

    study_registry_registrars::insert(
        &mut conn,
        PKeyPolicy::Fixed(PULL_REGISTRAR_ID),
        "Credit registration system tests (pull)",
        PULL_REGISTRAR_SECRET_KEY,
    )
    .await?;

    info!("inserting credit registration admin actions");
    seed_admin_actions(&mut conn, &cx, suotar_course.id, teacher_user_id).await?;

    push_mock_suotar_world(&base_url).await?;

    Ok(SUOTAR_COURSE_ID)
}

/// Aligns the mock Suotar's world with the rows just written. Nothing is cleared first: the mock
/// installs under a fresh generation and flips the pointer last.
async fn push_mock_suotar_world(base_url: &str) -> Result<()> {
    if !(bool_env_false_by_default("TEST_MODE")
        && bool_env_false_by_default("USE_MOCK_SUOTAR_ENDPOINT"))
    {
        info!("mock Suotar is not enabled; leaving its world alone");
        return Ok(());
    }
    let url = SuotarConfiguration::mock_conf(base_url)?
        .api_base_url
        .join("control/command")?;
    let mut payload = serde_json::to_value(mock_suotar_world())?;
    if let Some(object) = payload.as_object_mut() {
        object.insert("command".to_string(), serde_json::json!("pushWorld"));
    }

    info!("pushing the mock Suotar world");
    let response = REQWEST_CLIENT
        .post(url.clone())
        .json(&payload)
        .send()
        .await?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        // A worldless mock surfaces as baffling failures a hundred specs later.
        anyhow::bail!("pushing the mock Suotar world to {url} failed with {status}: {body}");
    }
    Ok(())
}

/// Turns the module on and points it at the mock's realisation for the same course code.
///
/// `with_product` is per module because `open_university_product_access_tokens` is keyed on the
/// product id globally: two modules sharing one would let a spec that breaks the token refresh break
/// another spec's enrolment link.
fn credit_registration_config(course_code: &str, with_product: bool) -> CreditRegistrationSeed {
    CreditRegistrationSeed {
        open_university_product_id: with_product.then(|| product_id(course_code)),
        grade_scale_id: None,
        active_realisation_ids: vec![mock_ids::realisation_id(
            course_code,
            RealisationKind::Degree,
        )],
        paused_reason: None,
    }
}

fn instance_config(instance_id: Uuid) -> CourseInstanceConfig {
    CourseInstanceConfig {
        name: None,
        description: None,
        support_email: None,
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        opening_time: None,
        closing_time: None,
        instance_id: Some(instance_id),
    }
}

/// Owned by `suotar-old-flow-coexistence.spec.ts`: student numbers `9000010xx`.
///
/// Module 0 stays on the legacy pull path outright. Module 1 stands in for a module the moment after
/// a real cutover: Suotar is on, but its one completion predates the cutover and was already
/// registered through the legacy pull path, which must keep it out of both the pull stream and a
/// second, Suotar-side registration.
async fn seed_old_flow_course(
    conn: &mut PgConnection,
    org: Uuid,
    teacher_user_id: Uuid,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: OLD_FLOW_COURSE_ID,
    };
    let registrar_id = get_or_create_default_registrar(conn).await?;

    let still_legacy = insert_student(
        conn,
        cx.v5(b"user:still-legacy"),
        "credit-registration-old-flow-still-legacy@example.com",
        "Zzyzx",
        "Stilllegacy",
    )
    .await?;
    let already_cut_over = insert_student(
        conn,
        cx.v5(b"user:already-cut-over"),
        "credit-registration-old-flow-already-cut-over@example.com",
        "Zzyzx",
        "Alreadycutover",
    )
    .await?;

    let (course, instance, _) =
        CourseBuilder::new("Credit registration old flow", OLD_FLOW_COURSE_SLUG)
            .desc("Fixture course left on the legacy open university registration flow.")
            .course_id(OLD_FLOW_COURSE_ID)
            .instance(instance_config(cx.v5(b"instance:old-flow")))
            .module(
                ModuleBuilder::new()
                    .order(0)
                    .ects(5.0)
                    .uh_course_code(CRS_OLD_101.to_string())
                    .register_to_open_university(true)
                    .completion(
                        CompletionBuilder::new(still_legacy.user_id)
                            .email(still_legacy.email.clone())
                            .grade(3)
                            .passed(true)
                            .prerequisite_modules_completed(true),
                    ),
            )
            .module(
                ModuleBuilder::new()
                    .order(1)
                    .name("Cut over to Suotar")
                    .ects(5.0)
                    .uh_course_code(CRS_OLD_102.to_string())
                    .credit_registration(credit_registration_config(CRS_OLD_102, false))
                    .default_registrar(registrar_id)
                    .completion(
                        CompletionBuilder::new(already_cut_over.user_id)
                            .email(already_cut_over.email.clone())
                            .grade(3)
                            .passed(true)
                            .prerequisite_modules_completed(true)
                            .registered(
                                CompletionRegisteredBuilder::new().real_student_number("900001002"),
                            ),
                    ),
            )
            .seed(conn, &cx)
            .await?;

    for student in [&still_legacy, &already_cut_over] {
        course_instance_enrollments::insert(conn, student.user_id, course.id, instance.id).await?;
    }
    Ok(())
}

/// Four passed completions, one already registered by the legacy pull flow so the backfill spec can
/// assert it is skipped rather than re-pushed.
async fn seed_backfill_course(
    conn: &mut PgConnection,
    org: Uuid,
    teacher_user_id: Uuid,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: BACKFILL_COURSE_ID,
    };
    let registrar_id = get_or_create_default_registrar(conn).await?;

    let mut module = ModuleBuilder::new()
        .order(0)
        .ects(5.0)
        .uh_course_code(CRS_BACKFILL_101.to_string())
        .default_registrar(registrar_id)
        // The module-edit form's start/end chapter pickers are required; without one, the spec
        // that opts this module in through that UI finds "Confirm" permanently disabled.
        .chapter(
            ChapterBuilder::new(1, "Content")
                .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:front-page")),
        );

    for index in 1..=4 {
        let student = insert_student(
            conn,
            cx.v5(format!("user:backfill:{index}").as_bytes()),
            &format!("credit-registration-backfill-{index}@example.com"),
            "Zzyzx",
            &format!("Backfill{index}"),
        )
        .await?;
        let mut completion = CompletionBuilder::new(student.user_id)
            .email(student.email.clone())
            .grade(3)
            .passed(true)
            .prerequisite_modules_completed(true);
        if index == 1 {
            completion = completion.registered(
                CompletionRegisteredBuilder::new()
                    .real_student_number(BACKFILL_STUDENTS[index - 1].student_number.to_string()),
            );
        }
        module = module.completion(completion);
    }
    let failed_student = insert_student(
        conn,
        cx.v5(b"user:backfill:failed"),
        "credit-registration-backfill-failed@example.com",
        "Zzyzx",
        "Backfillfailed",
    )
    .await?;
    module = module.completion(
        CompletionBuilder::new(failed_student.user_id)
            .email(failed_student.email.clone())
            .grade(0)
            .passed(false)
            .prerequisite_modules_completed(true),
    );

    let (course, instance, _) = CourseBuilder::new(
        "Credit registration backfill",
        BACKFILL_COURSE_SLUG,
    )
    .desc("Fixture course with pre-existing passed completions, for the backfill-on-opt-in spec.")
    .course_id(BACKFILL_COURSE_ID)
    .instance(instance_config(cx.v5(b"instance:backfill")))
    .module(module)
    .seed(conn, &cx)
    .await?;

    // Nobody here is asked for consent: the point of the backfill is that its rows wait until one of
    // these students answers from their profile.
    for index in 1..=4 {
        let user_id = cx.v5(format!("user:backfill:{index}").as_bytes());
        course_instance_enrollments::insert(conn, user_id, course.id, instance.id).await?;
    }
    course_instance_enrollments::insert(conn, failed_student.user_id, course.id, instance.id)
        .await?;
    Ok(())
}

/// The account-linking fixtures, on a course of their own.
///
/// The stale-address list only renders a (person, course) mailed to the cap and never claimed, which
/// takes three mails at three addresses because the dedup key is the address.
async fn seed_admin_course(
    conn: &mut PgConnection,
    org: Uuid,
    teacher_user_id: Uuid,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: ADMIN_COURSE_ID,
    };
    let (course, instance, _) = CourseBuilder::new("Credit registration admin", ADMIN_COURSE_SLUG)
        .desc("Fixture course for the admin dashboard's account linking views.")
        .course_id(ADMIN_COURSE_ID)
        .role(teacher_user_id, UserRole::Teacher)
        .instance(instance_config(cx.v5(b"instance:admin")))
        .module(
            ModuleBuilder::new()
                .order(0)
                .ects(5.0)
                .uh_course_code(CRS_ADMIN_101.to_string())
                .credit_registration(credit_registration_config(CRS_ADMIN_101, true)),
        )
        .seed(conn, &cx)
        .await?;

    let unlinked =
        seed_spec_account(conn, &cx, &ADMIN_UNLINKED, course.id, instance.id, true).await?;
    seed_eligible_completion(conn, &unlinked, course.id, None).await?;
    let linked = seed_spec_student(conn, &cx, &ADMIN_LINKED, course.id, instance.id, true).await?;
    seed_eligible_completion(conn, &linked, course.id, None).await?;

    for fixture in [&ADMIN_STALE, &TEACHER_RESEND_CAPPED] {
        for suffix in MAILED_ADDRESS_SUFFIXES {
            let address = format!("{suffix}{}", fixture.sisu_email);
            let claimed = credit_registration_account_linking_emails::claim_send_slot(
                conn,
                &NewAccountLinkingEmail {
                    student_number: fixture.student_number.to_string(),
                    sisu_person_id: fixture.sisu_person_id(),
                    course_id: course.id,
                    emailed_to: address.clone(),
                    student_number_verification_token_id: None,
                    email_delivery_id: None,
                },
            )
            .await?;
            anyhow::ensure!(
                claimed.is_some(),
                "the dedup key refused a seeded linking mail to {address}"
            );
        }
    }
    Ok(())
}

/// Every registration state, and every error code, as a frozen row.
///
/// The module is paused because every phase's claim query skips paused modules; otherwise the
/// workers in the test deployment would walk these onwards seconds after the seed finished.
async fn seed_states_course(
    conn: &mut PgConnection,
    org: Uuid,
    teacher_user_id: Uuid,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: STATES_COURSE_ID,
    };
    let (course, instance, _) = CourseBuilder::new(
        "Credit registration states",
        STATES_COURSE_SLUG,
    )
    .desc("Fixture course holding one frozen registration per state and per error code.")
    .course_id(STATES_COURSE_ID)
    .role(teacher_user_id, UserRole::Teacher)
    .instance(instance_config(cx.v5(b"instance:states")))
    .module(
        ModuleBuilder::new()
            .order(0)
            .ects(5.0)
            .uh_course_code(CRS_STATES_101.to_string())
            .credit_registration(CreditRegistrationSeed {
                paused_reason: Some(
                    "Seeded fixture: these rows are read by the teacher and admin views and must not move."
                        .to_string(),
                ),
                ..credit_registration_config(CRS_STATES_101, false)
            }),
    )
    .seed(conn, &cx)
    .await?;

    for (index, state) in CreditRegistrationState::ALL.iter().enumerate() {
        seed_frozen_registration(
            conn,
            &cx,
            course.id,
            instance.id,
            index + 1,
            &format!("State{:02}", index + 1),
            *state,
            None,
        )
        .await?;
    }
    // Every code on the same state, so the explorer's error-code filter can be exercised alone.
    for (index, error_code) in CreditRegistrationErrorCode::ALL.iter().enumerate() {
        seed_frozen_registration(
            conn,
            &cx,
            course.id,
            instance.id,
            50 + index,
            &format!("Error{:02}", index + 1),
            CreditRegistrationState::FailedPermanent,
            Some(*error_code),
        )
        .await?;
    }
    Ok(())
}

/// One student, one completion and one ledger row parked in `state`.
///
/// `person` is the `PP` half of the student number, in the teacher-views block. The first two get a
/// student number too, one link-verified and one manual, because the teacher view renders them
/// differently.
#[allow(clippy::too_many_arguments)]
async fn seed_frozen_registration(
    conn: &mut PgConnection,
    cx: &SeedContext,
    course_id: Uuid,
    course_instance_id: Uuid,
    person: usize,
    last_name: &str,
    state: CreditRegistrationState,
    error_code: Option<CreditRegistrationErrorCode>,
) -> Result<()> {
    let student_number = format!("9000008{person:02}");
    let account_email = format!(
        "credit-registration-{}@example.com",
        last_name.to_lowercase()
    );
    let student = insert_student(
        conn,
        cx.v5(account_email.as_bytes()),
        &account_email,
        "Zzyzx",
        last_name,
    )
    .await?;
    course_instance_enrollments::insert(conn, student.user_id, course_id, course_instance_id)
        .await?;
    course_credit_registration_consents::upsert(conn, student.user_id, course_id, true).await?;
    let verified_via = match person {
        1 => Some(StudentNumberVerificationMethod::EmailedLink),
        2 => Some(StudentNumberVerificationMethod::AdminManual),
        _ => None,
    };
    if let Some(verified_via) = verified_via {
        verified_student_numbers::insert(
            conn,
            PKeyPolicy::Fixed(cx.v5(format!("verified:{student_number}").as_bytes())),
            &NewVerifiedStudentNumber {
                user_id: student.user_id,
                student_number: student_number.clone(),
                sisu_person_id: format!("hy-hlo-{student_number}"),
                first_names: Some("Zzyzx".to_string()),
                last_name: Some(last_name.to_string()),
                verified_via,
                verified_via_email: (verified_via != StudentNumberVerificationMethod::AdminManual)
                    .then(|| format!("zzyzx.{}@helsinki.example", last_name.to_lowercase())),
                verified_via_email_match_field: None,
                account_email_verified_at: None,
                linked_by_user_id: (verified_via == StudentNumberVerificationMethod::AdminManual)
                    .then_some(cx.teacher),
                link_reason: (verified_via == StudentNumberVerificationMethod::AdminManual).then(
                    || "Seeded fixture: the address Sisu holds rejects our mail.".to_string(),
                ),
                verified_from_course_id: Some(course_id),
            },
        )
        .await?;
    }

    let completion_id = seed_eligible_completion(conn, &student, course_id, None).await?;
    let course_module_id =
        headless_lms_models::course_modules::get_default_by_course_id(conn, course_id)
            .await?
            .id;
    let id = credit_registrations::insert(
        conn,
        PKeyPolicy::Fixed(cx.v5(format!("credit-registration:{account_email}").as_bytes())),
        &NewCreditRegistration {
            course_module_completion_id: completion_id,
            user_id: student.user_id,
            course_id,
            course_module_id,
            course_instance_id,
            attempt_number: 1,
        },
        Some("Seeded fixture"),
    )
    .await?;
    credit_registrations::transition(
        conn,
        id,
        &Transition {
            error_code,
            needs_admin_attention: error_code.map(|_| true),
            ..Transition::to(state)
        },
    )
    .await?;
    Ok(())
}

/// One module per failing import shape, so the spec picks its error by picking a module rather than
/// by flipping something every other spec on the course can see.
async fn seed_import_outcomes_course(
    conn: &mut PgConnection,
    org: Uuid,
    teacher_user_id: Uuid,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: IMPORT_OUTCOMES_COURSE_ID,
    };
    let mut course = CourseBuilder::new(
        "Credit registration import outcomes",
        IMPORT_OUTCOMES_COURSE_SLUG,
    )
    .desc("Fixture course whose modules each provoke one Sisu import error.")
    .course_id(IMPORT_OUTCOMES_COURSE_ID)
    .instance(instance_config(cx.v5(b"instance:import-outcomes")));
    for (order, course_code) in IMPORT_OUTCOME_COURSE_CODES.iter().enumerate() {
        let mut module = ModuleBuilder::new()
            .order(order as i32)
            .ects(5.0)
            .uh_course_code(course_code.to_string())
            .credit_registration(credit_registration_config(course_code, false));
        if order > 0 {
            module = module.name(format!("Module {course_code}"));
        }
        course = course.module(module);
    }
    let (course, instance, _) = course.seed(conn, &cx).await?;
    let student =
        seed_spec_student(conn, &cx, &IMPORT_OUTCOMES, course.id, instance.id, true).await?;
    for module in headless_lms_models::course_modules::get_by_course_id(conn, course.id).await? {
        course_module_completions::insert_seed_row(
            conn,
            &NewCourseModuleCompletionSeed {
                course_id: course.id,
                course_module_id: module.id,
                user_id: student.user_id,
                completion_date: Some(Utc::now() - Duration::days(1)),
                completion_language: Some("en-US".to_string()),
                eligible_for_ects: Some(true),
                email: Some(student.email.clone()),
                grade: None,
                passed: Some(true),
                prerequisite_modules_completed: Some(true),
                needs_to_be_reviewed: Some(false),
            },
        )
        .await?;
    }
    Ok(())
}

async fn seed_grade_improvement_course(
    conn: &mut PgConnection,
    org: Uuid,
    teacher_user_id: Uuid,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: GRADE_IMPROVEMENT_COURSE_ID,
    };
    let (course, instance, _) = CourseBuilder::new(
        "Credit registration grade improvement",
        GRADE_IMPROVEMENT_COURSE_SLUG,
    )
    .desc("Fixture course whose module is graded rather than pass/fail.")
    .course_id(GRADE_IMPROVEMENT_COURSE_ID)
    .instance(instance_config(cx.v5(b"instance:grade-improvement")))
    .module(
        ModuleBuilder::new()
            .order(0)
            .ects(5.0)
            .uh_course_code(CRS_GRADED_101.to_string()),
    )
    .seed(conn, &cx)
    .await?;
    seed_spec_student(conn, &cx, &GRADE_IMPROVEMENT, course.id, instance.id, true).await?;
    Ok(())
}

/// A user, an enrolment, a verified student number and optionally a consent for one spec's actor.
///
/// `consented = false` leaves the consent row out rather than writing a declined one: a missing row
/// is what makes the course-start dialog appear, a declined one means asked.
async fn seed_spec_student(
    conn: &mut PgConnection,
    cx: &SeedContext,
    fixture: &MockPersonFixture,
    course_id: Uuid,
    course_instance_id: Uuid,
    consented: bool,
) -> Result<SeededStudent> {
    let student =
        seed_spec_account(conn, cx, fixture, course_id, course_instance_id, consented).await?;
    link_student_number(
        conn,
        cx,
        fixture,
        student.user_id,
        course_id,
        StudentNumberVerificationMethod::EmailedLink,
    )
    .await?;
    Ok(student)
}

/// The same, without a student number: whoever is meant to be discovered and mailed.
async fn seed_spec_account(
    conn: &mut PgConnection,
    cx: &SeedContext,
    fixture: &MockPersonFixture,
    course_id: Uuid,
    course_instance_id: Uuid,
    consented: bool,
) -> Result<SeededStudent> {
    let account_email = fixture
        .account_email
        .ok_or_else(|| anyhow::anyhow!("a driven spec actor needs an account"))?;
    let student = insert_student(
        conn,
        cx.v5(account_email.as_bytes()),
        account_email,
        fixture.first_names,
        fixture.last_name,
    )
    .await?;
    course_instance_enrollments::insert(conn, student.user_id, course_id, course_instance_id)
        .await?;
    if consented {
        course_credit_registration_consents::upsert(conn, student.user_id, course_id, true).await?;
    }
    Ok(student)
}

async fn link_student_number(
    conn: &mut PgConnection,
    cx: &SeedContext,
    fixture: &MockPersonFixture,
    user_id: Uuid,
    course_id: Uuid,
    verified_via: StudentNumberVerificationMethod,
) -> Result<()> {
    verified_student_numbers::insert(
        conn,
        PKeyPolicy::Fixed(cx.v5(format!("verified:{}", fixture.student_number).as_bytes())),
        &NewVerifiedStudentNumber {
            user_id,
            student_number: fixture.student_number.to_string(),
            sisu_person_id: fixture.sisu_person_id(),
            first_names: Some(fixture.first_names.to_string()),
            last_name: Some(fixture.last_name.to_string()),
            verified_via,
            verified_via_email: (verified_via != StudentNumberVerificationMethod::AdminManual)
                .then(|| fixture.sisu_email.to_string()),
            verified_via_email_match_field: None,
            account_email_verified_at: None,
            linked_by_user_id: (verified_via == StudentNumberVerificationMethod::AdminManual)
                .then_some(cx.teacher),
            link_reason: (verified_via == StudentNumberVerificationMethod::AdminManual)
                .then(|| "Seeded fixture: the address Sisu holds rejects our mail.".to_string()),
            verified_from_course_id: Some(course_id),
        },
    )
    .await?;
    Ok(())
}

/// A completion the pipeline will pick up. `prerequisite_modules_completed` is the trap: the builder
/// defaults it to false, and such a completion never leaves `pending_prerequisites`.
async fn seed_eligible_completion(
    conn: &mut PgConnection,
    student: &SeededStudent,
    course_id: Uuid,
    grade: Option<i32>,
) -> Result<Uuid> {
    let course_module_id =
        headless_lms_models::course_modules::get_default_by_course_id(conn, course_id)
            .await?
            .id;
    let completion_id = course_module_completions::insert_seed_row(
        conn,
        &NewCourseModuleCompletionSeed {
            course_id,
            course_module_id,
            user_id: student.user_id,
            completion_date: Some(Utc::now() - Duration::days(1)),
            completion_language: Some("en-US".to_string()),
            eligible_for_ects: Some(true),
            email: Some(student.email.clone()),
            grade,
            passed: Some(true),
            prerequisite_modules_completed: Some(true),
            needs_to_be_reviewed: Some(false),
        },
    )
    .await?;
    Ok(completion_id)
}

async fn insert_student(
    conn: &mut PgConnection,
    user_id: Uuid,
    email: &str,
    first_name: &str,
    last_name: &str,
) -> Result<SeededStudent> {
    let user_id = users::insert(
        conn,
        PKeyPolicy::Fixed(user_id),
        email,
        Some(first_name),
        Some(last_name),
    )
    .await?;
    user_details::update_user_country(conn, user_id, "fi").await?;
    // The local part of the address is the password, so these students can log in through the
    // stored-password fallback without an entry in `authenticate_test_user`.
    let password = email
        .split('@')
        .next()
        .expect("split always yields one element");
    let hash = hash_password(&SecretString::new(password.to_string().into()))
        .map_err(|e| anyhow::anyhow!("failed to hash a seeded password: {e}"))?;
    upsert_user_password(conn, user_id, &hash).await?;
    Ok(SeededStudent {
        user_id,
        email: email.to_string(),
    })
}

/// `emailed_to` matches no seeded account on purpose: tokens are unbound, and bind to whoever opens
/// the link while logged in.
async fn seed_linking_tokens(
    conn: &mut PgConnection,
    cx: &SeedContext,
    course_id: Uuid,
    claimed_by_user_id: Uuid,
) -> Result<()> {
    let now = Utc::now();
    student_number_verification_tokens::insert_seed_row(
        conn,
        PKeyPolicy::Fixed(cx.v5(b"linking-token:valid")),
        &SeedStudentNumberVerificationToken {
            token: LINKING_TOKEN_VALID.to_string(),
            student_number: LINK_VALID.student_number.to_string(),
            sisu_person_id: LINK_VALID.sisu_person_id(),
            first_names: Some(LINK_VALID.first_names.to_string()),
            last_name: Some(LINK_VALID.last_name.to_string()),
            emailed_to: LINK_VALID.sisu_email.to_string(),
            course_id: Some(course_id),
            expires_at: now + Duration::days(14),
            used_at: None,
            claimed_by_user_id: None,
        },
    )
    .await?;
    student_number_verification_tokens::insert_seed_row(
        conn,
        PKeyPolicy::Fixed(cx.v5(b"linking-token:expired")),
        &SeedStudentNumberVerificationToken {
            token: LINKING_TOKEN_EXPIRED.to_string(),
            student_number: LINK_EXPIRED.student_number.to_string(),
            sisu_person_id: LINK_EXPIRED.sisu_person_id(),
            first_names: Some(LINK_EXPIRED.first_names.to_string()),
            last_name: Some(LINK_EXPIRED.last_name.to_string()),
            emailed_to: LINK_EXPIRED.sisu_email.to_string(),
            course_id: Some(course_id),
            expires_at: now - Duration::days(1),
            used_at: None,
            claimed_by_user_id: None,
        },
    )
    .await?;
    student_number_verification_tokens::insert_seed_row(
        conn,
        PKeyPolicy::Fixed(cx.v5(b"linking-token:already-used")),
        &SeedStudentNumberVerificationToken {
            token: LINKING_TOKEN_ALREADY_USED.to_string(),
            student_number: LINK_USED.student_number.to_string(),
            sisu_person_id: LINK_USED.sisu_person_id(),
            first_names: Some(LINK_USED.first_names.to_string()),
            last_name: Some(LINK_USED.last_name.to_string()),
            emailed_to: LINK_USED.sisu_email.to_string(),
            course_id: Some(course_id),
            expires_at: now + Duration::days(14),
            used_at: Some(now - Duration::hours(1)),
            claimed_by_user_id: Some(claimed_by_user_id),
        },
    )
    .await?;
    student_number_verification_tokens::insert_seed_row(
        conn,
        PKeyPolicy::Fixed(cx.v5(b"linking-token:conflict")),
        &SeedStudentNumberVerificationToken {
            token: LINKING_TOKEN_CONFLICT.to_string(),
            student_number: CONSENTED_LINKED.student_number.to_string(),
            sisu_person_id: CONSENTED_LINKED.sisu_person_id(),
            first_names: Some(CONSENTED_LINKED.first_names.to_string()),
            last_name: Some(CONSENTED_LINKED.last_name.to_string()),
            emailed_to: CONSENTED_LINKED.sisu_email.to_string(),
            course_id: Some(course_id),
            expires_at: now + Duration::days(14),
            used_at: None,
            claimed_by_user_id: None,
        },
    )
    .await?;
    Ok(())
}

/// A registered grade-3 attempt superseded by a grade-4 one, so the admin-detail and
/// grade-improvement specs get an attempt chain without driving a regrade first.
async fn seed_superseded_attempt_pair(
    conn: &mut PgConnection,
    student: &SeededStudent,
    course_id: Uuid,
    course_instance_id: Uuid,
) -> Result<()> {
    let course_module_id =
        headless_lms_models::course_modules::get_default_by_course_id(conn, course_id)
            .await?
            .id;
    let completion_id = course_module_completions::insert_seed_row(
        conn,
        &NewCourseModuleCompletionSeed {
            course_id,
            course_module_id,
            user_id: student.user_id,
            completion_date: Some(Utc::now() - Duration::days(20)),
            completion_language: Some("en-US".to_string()),
            eligible_for_ects: Some(true),
            email: Some(student.email.clone()),
            grade: Some(4),
            passed: Some(true),
            prerequisite_modules_completed: Some(true),
            needs_to_be_reviewed: Some(false),
        },
    )
    .await?;

    let attempt_1 = insert_registered_attempt(
        conn,
        SUPERSEDED_ATTEMPT_1_ID,
        completion_id,
        student.user_id,
        course_id,
        course_module_id,
        course_instance_id,
        1,
        "3",
    )
    .await?;
    // `uq_credit_registrations_completion` allows only one attempt per completion with a NULL
    // `superseded_by_id`, and the FK cannot point at a row that does not exist yet: park attempt 1
    // on itself, insert the successor, then repoint.
    credit_registrations::mark_superseded(conn, attempt_1, attempt_1).await?;
    let attempt_2 = insert_registered_attempt(
        conn,
        SUPERSEDED_ATTEMPT_2_ID,
        completion_id,
        student.user_id,
        course_id,
        course_module_id,
        course_instance_id,
        2,
        "4",
    )
    .await?;
    credit_registrations::mark_superseded(conn, attempt_1, attempt_2).await?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn insert_registered_attempt(
    conn: &mut PgConnection,
    id: Uuid,
    course_module_completion_id: Uuid,
    user_id: Uuid,
    course_id: Uuid,
    course_module_id: Uuid,
    course_instance_id: Uuid,
    attempt_number: i32,
    grade_id: &str,
) -> Result<Uuid> {
    let id = credit_registrations::insert(
        conn,
        PKeyPolicy::Fixed(id),
        &NewCreditRegistration {
            course_module_completion_id,
            user_id,
            course_id,
            course_module_id,
            course_instance_id,
            attempt_number,
        },
        Some("Seeded fixture"),
    )
    .await?;
    credit_registrations::set_payload_snapshot(
        conn,
        id,
        &PayloadSnapshot {
            student_number: SUPERSEDED.student_number.to_string(),
            sisu_person_id: SUPERSEDED.sisu_person_id(),
            uh_course_code: CRS_101.to_string(),
            selected_enrolment_id: Some(format!("otm-{}-degree", SUPERSEDED.student_number)),
            selected_enrolment_kind: Some("degree".to_string()),
            selected_enrolment_realisation_id: Some("hy-opt-cur-900000901".to_string()),
            attainment_date: (Utc::now() - Duration::days(20)).date_naive(),
            attainment_language: "en".to_string(),
            grade_scale_id: "sis-0-5".to_string(),
            grade_id: grade_id.to_string(),
            credits: 5.0,
        },
    )
    .await?;
    credit_registrations::transition(
        conn,
        id,
        &Transition::to(CreditRegistrationState::Registered),
    )
    .await?;
    Ok(id)
}

/// One `global_admin` and one `course_teacher` row, so the Audit tab has content without depending
/// on another spec having clicked something.
async fn seed_admin_actions(
    conn: &mut PgConnection,
    cx: &SeedContext,
    course_id: Uuid,
    teacher_user_id: Uuid,
) -> Result<()> {
    let admin_user_id = headless_lms_models::users::get_by_email(conn, "admin@example.com")
        .await?
        .id;
    credit_registration_admin_actions::record(
        conn,
        &NewCreditRegistrationAdminAction {
            target_id: Some(SUPERSEDED_ATTEMPT_1_ID),
            reason: Some("Seeded fixture: checked Sisu by hand and requeued".to_string()),
            before_state: Some(CreditRegistrationState::SubmissionUncertain),
            after_state: Some(CreditRegistrationState::Registered),
            affected_row_count: Some(1),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::TransitionItem,
                CreditRegistrationAdminActionTarget::CreditRegistration,
                admin_user_id,
                GLOBAL_ADMIN_ROLE,
            )
        },
    )
    .await?;
    credit_registration_admin_actions::record(
        conn,
        &NewCreditRegistrationAdminAction {
            target_id: Some(cx.v5(b"linking-token:valid")),
            actor_course_id: Some(course_id),
            reason: Some("Seeded fixture: student reported the mail never arrived".to_string()),
            affected_row_count: Some(1),
            ..NewCreditRegistrationAdminAction::new(
                CreditRegistrationAdminAction::ResendLinkEmail,
                CreditRegistrationAdminActionTarget::StudentNumberVerificationToken,
                teacher_user_id,
                COURSE_TEACHER_ROLE,
            )
        },
    )
    .await?;
    Ok(())
}

/// The world the mock Suotar serves, built from the same fixtures the database rows above are.
///
/// Pure and pool-free on purpose: the restore-from-template setup path runs no seed and has the mock
/// install this lazily instead, so both setup scripts hand the suite the same fixtures.
pub fn mock_suotar_world() -> WorldPush {
    let now = Utc::now();
    let wide = DatePeriod {
        start_date: (now - Duration::days(730)).date_naive(),
        end_date: (now + Duration::days(730)).date_naive(),
    };
    let past = DatePeriod {
        start_date: (now - Duration::days(900)).date_naive(),
        end_date: (now - Duration::days(800)).date_naive(),
    };

    let on_crs_101 = [
        &CONSENTED_LINKED,
        &CONSENTED_UNLINKED,
        &NOT_CONSENTED,
        &LINK_VALID,
        &LINK_EXPIRED,
        &LINK_USED,
        &SUPERSEDED,
        &FAST_TRACK_VERIFIED,
        &FAST_TRACK_TWIN,
        &IMPORT_TIMEOUT,
        &TWO_ENROLMENTS,
        &VERIFY_POLLING,
        &VERIFY_MISREGISTERED,
        &CONSENT_WITHHELD,
        &CONSENT_WITHDRAWN,
    ];
    let on_crs_admin_101 = [
        &ADMIN_UNLINKED,
        &ADMIN_STALE,
        &ADMIN_LINKED,
        &TEACHER_RESEND_CAPPED,
    ];

    let mut persons: Vec<PersonUpsert> = on_crs_101.iter().map(|f| person(f)).collect();
    persons.extend(on_crs_admin_101.iter().map(|f| {
        let mut upsert = person(f);
        // Sisu's live address must differ from the mailed history below, or a resend hits the
        // dedup guard (already mailed this address) before it ever reaches the cap it exists to
        // demonstrate.
        if f.student_number == ADMIN_STALE.student_number
            || f.student_number == TEACHER_RESEND_CAPPED.student_number
        {
            upsert.primary_email = format!("current.{}", f.sisu_email);
        }
        upsert
    }));
    persons.push(person(&NO_ENROLMENT));
    persons.push(person(&IMPORT_OUTCOMES));
    persons.push(person(&GRADE_IMPROVEMENT));
    persons.extend(BACKFILL_STUDENTS.iter().map(person));

    let mut enrolments: Vec<EnrolmentUpsert> = on_crs_101
        .iter()
        .map(|fixture| enrolment(fixture, CRS_101, RealisationKind::Degree, wide.clone(), now))
        .collect();
    enrolments.extend(BACKFILL_STUDENTS.iter().map(|fixture| {
        enrolment(
            fixture,
            CRS_BACKFILL_101,
            RealisationKind::Degree,
            wide.clone(),
            now,
        )
    }));
    enrolments.extend(IMPORT_OUTCOME_COURSE_CODES.iter().map(|course_code| {
        enrolment(
            &IMPORT_OUTCOMES,
            course_code,
            RealisationKind::Degree,
            wide.clone(),
            now,
        )
    }));
    enrolments.push(enrolment(
        &GRADE_IMPROVEMENT,
        CRS_GRADED_101,
        RealisationKind::Degree,
        wide.clone(),
        now,
    ));
    enrolments.extend(on_crs_admin_101.iter().map(|fixture| {
        enrolment(
            fixture,
            CRS_ADMIN_101,
            RealisationKind::Degree,
            wide.clone(),
            now,
        )
    }));
    enrolments.push(enrolment(
        &TWO_ENROLMENTS,
        CRS_101,
        RealisationKind::OpenUniversity,
        wide.clone(),
        now,
    ));

    let import_outcomes = [
        CourseUnitShape {
            import_allowed: false,
            ..CourseUnitShape::new(CRS_IMPORT_101, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
        CourseUnitShape {
            credits: Some(CreditRange { min: 1.0, max: 1.0 }),
            ..CourseUnitShape::new(CRS_IMPORT_102, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
        CourseUnitShape {
            activity_period: Some(past),
            ..CourseUnitShape::new(CRS_IMPORT_103, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
        CourseUnitShape {
            acceptor: false,
            ..CourseUnitShape::new(CRS_IMPORT_104, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
    ];

    let mut course_units = vec![
        CourseUnitShape {
            kinds: &[RealisationKind::Degree, RealisationKind::OpenUniversity],
            ..CourseUnitShape::new(CRS_101, SUOTAR_COURSE_SLUG, 5.0)
        }
        .build(&wide),
        CourseUnitShape::new(CRS_102, SUOTAR_COURSE_SLUG, 3.0).build(&wide),
        CourseUnitShape {
            kinds: &[RealisationKind::OpenUniversity],
            ..CourseUnitShape::new(CRS_OLD_101, OLD_FLOW_COURSE_SLUG, 5.0)
        }
        .build(&wide),
        CourseUnitShape::new(CRS_BACKFILL_101, BACKFILL_COURSE_SLUG, 5.0).build(&wide),
        CourseUnitShape {
            kinds: &[RealisationKind::Degree, RealisationKind::OpenUniversity],
            ..CourseUnitShape::new(CRS_ADMIN_101, ADMIN_COURSE_SLUG, 5.0)
        }
        .build(&wide),
        CourseUnitShape::new(CRS_STATES_101, STATES_COURSE_SLUG, 5.0).build(&wide),
        // Every other module is pass/fail, so grade improvement needs a graded one.
        CourseUnitShape {
            grade_scale_id: "sis-0-5",
            ..CourseUnitShape::new(CRS_GRADED_101, GRADE_IMPROVEMENT_COURSE_SLUG, 5.0)
        }
        .build(&wide),
    ];
    course_units.extend(import_outcomes.into_iter().map(|shape| shape.build(&wide)));

    WorldPush {
        defaults: Some(WorldDefaults {
            ripeness: Ripeness::Manual,
            ..WorldDefaults::default()
        }),
        persons,
        course_units,
        enrolments,
        attainments: Vec::new(),
        submissions: Vec::new(),
        product_tokens: vec![
            product_token(CRS_101),
            product_token(CRS_OLD_101),
            product_token(CRS_ADMIN_101),
        ],
    }
}

fn person(fixture: &MockPersonFixture) -> PersonUpsert {
    PersonUpsert {
        student_number: fixture.student_number.to_string(),
        person_id: Some(fixture.sisu_person_id()),
        first_names: fixture.first_names.to_string(),
        last_name: fixture.last_name.to_string(),
        primary_email: fixture.sisu_email.to_string(),
        secondary_email: None,
        behaviour: PersonBehaviour::default(),
        owner_user_email: fixture.account_email.map(str::to_string),
    }
}

fn enrolment(
    fixture: &MockPersonFixture,
    course_code: &str,
    kind: RealisationKind,
    validity: DatePeriod,
    enrolled_at: DateTime<Utc>,
) -> EnrolmentUpsert {
    EnrolmentUpsert {
        id: None,
        student_number: fixture.student_number.to_string(),
        course_code: course_code.to_string(),
        realisation_id: None,
        kind,
        state: EnrolmentState::Enrolled,
        study_right_id: None,
        study_right_validity_period: validity,
        enrolment_date_time: Some(enrolled_at),
    }
}

/// What the mock's realisation for one module looks like. The defaults are the working shape; the
/// import-outcomes modules each break exactly one of them.
struct CourseUnitShape<'a> {
    course_code: &'a str,
    course_slug: &'a str,
    ects: f64,
    kinds: &'a [RealisationKind],
    grade_scale_id: &'a str,
    credits: Option<CreditRange>,
    activity_period: Option<DatePeriod>,
    acceptor: bool,
    import_allowed: bool,
}

impl<'a> CourseUnitShape<'a> {
    fn new(course_code: &'a str, course_slug: &'a str, ects: f64) -> Self {
        Self {
            course_code,
            course_slug,
            ects,
            kinds: &[RealisationKind::Degree],
            grade_scale_id: "sis-hyl-hyv",
            credits: None,
            activity_period: None,
            acceptor: true,
            import_allowed: true,
        }
    }

    fn build(self, activity_period: &DatePeriod) -> CourseUnitUpsert {
        let name = LocalizedName {
            fi: self.course_code.to_string(),
            sv: self.course_code.to_string(),
            en: self.course_code.to_string(),
        };
        CourseUnitUpsert {
            course_code: self.course_code.to_string(),
            course_unit_id: None,
            name: Some(name),
            realisations: self
                .kinds
                .iter()
                .map(|kind| RealisationUpsert {
                    id: None,
                    name: None,
                    assessment_item_id: None,
                    kind: *kind,
                    activity_period: self
                        .activity_period
                        .clone()
                        .unwrap_or_else(|| activity_period.clone()),
                    grade_scale_id: self.grade_scale_id.to_string(),
                    credits: self.credits.clone().unwrap_or(CreditRange {
                        min: self.ects,
                        max: self.ects,
                    }),
                    acceptor_person_id: self.acceptor.then(|| "hy-hlo-acceptor".to_string()),
                    open_university_product_id: match kind {
                        RealisationKind::OpenUniversity => Some(product_id(self.course_code)),
                        RealisationKind::Degree => None,
                    },
                })
                .collect(),
            behaviour: CourseBehaviour {
                import_allowed: self.import_allowed,
            },
            owner_course_slug: Some(self.course_slug.to_string()),
        }
    }
}

fn product_token(course_code: &str) -> ProductAccessTokenUpsert {
    ProductAccessTokenUpsert {
        open_university_product_id: product_id(course_code),
        id: None,
        access_token: None,
        state: None,
        document_state: None,
    }
}

fn product_id(course_code: &str) -> String {
    format!("otm-product-{}", course_code.to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `student_number_verification_token_length` requires at least 128 characters; a violation
    /// would otherwise surface only as a seed crash.
    #[test]
    fn seeded_linking_tokens_are_long_enough() {
        for token in [
            LINKING_TOKEN_VALID,
            LINKING_TOKEN_EXPIRED,
            LINKING_TOKEN_ALREADY_USED,
            LINKING_TOKEN_CONFLICT,
        ] {
            assert!(token.len() >= 128, "token too short: {}", token.len());
        }
    }

    /// A world that does not hang together surfaces as confusing Playwright failures elsewhere.
    #[test]
    fn the_pushed_world_is_internally_consistent() {
        let world = mock_suotar_world();
        let scales = world
            .defaults
            .as_ref()
            .map(|defaults| defaults.grade_scales.clone())
            .unwrap_or_default();
        let product_ids: Vec<&String> = world
            .product_tokens
            .iter()
            .map(|token| &token.open_university_product_id)
            .collect();

        for unit in &world.course_units {
            for realisation in &unit.realisations {
                assert!(
                    scales
                        .iter()
                        .any(|scale| scale.answers_to(&realisation.grade_scale_id)),
                    "{} names an unknown grade scale {}",
                    unit.course_code,
                    realisation.grade_scale_id
                );
                if let Some(product_id) = &realisation.open_university_product_id {
                    assert!(
                        product_ids.contains(&product_id),
                        "{} references a product token that was not pushed: {product_id}",
                        unit.course_code
                    );
                }
            }
        }

        for enrolment in &world.enrolments {
            assert!(
                world
                    .persons
                    .iter()
                    .any(|person| person.student_number == enrolment.student_number),
                "enrolment for an unpushed person {}",
                enrolment.student_number
            );
            let unit = world
                .course_units
                .iter()
                .find(|unit| unit.course_code == enrolment.course_code)
                .unwrap_or_else(|| {
                    panic!("enrolment on an unpushed course {}", enrolment.course_code)
                });
            assert!(
                unit.realisations
                    .iter()
                    .any(|realisation| realisation.kind == enrolment.kind),
                "{} has no {:?} realisation for {} to enrol on",
                unit.course_code,
                enrolment.kind,
                enrolment.student_number
            );
        }
    }
}
