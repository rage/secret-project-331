//! Database rows for the credit-registration (Suotar) system tests. The identities they are built
//! from, and the matching registry world, are in [`crate::controllers::mock_suotar::fixtures`].
//!
//! The backfill course keeps `enable_credit_registration_via_suotar` off and nothing may turn it on:
//! its spec flips it from the UI, which is one-way and run-wide. Every other course has it on.
//!
//! The workers tick every phase unscoped every few seconds in the test deployment, so a fixture row
//! nothing may move has to sit on a paused module — that is what the states course is for.

use anyhow::Result;
use chrono::{Duration, Utc};
use headless_lms_base::config::{
    ApplicationConfiguration, SuotarConfiguration, bool_env_false_by_default,
};
use headless_lms_models::{
    PKeyPolicy, course_instance_enrollments,
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
use sqlx::{Connection, PgConnection};
use tracing::info;
use uuid::Uuid;

use crate::controllers::mock_suotar::fixtures::*;
use crate::controllers::mock_suotar::ids as mock_ids;
use crate::controllers::mock_suotar::world::RealisationKind;
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

/// A seeded student, with the deterministic id a spec navigates by.
struct SeededStudent {
    user_id: Uuid,
    email: String,
}

pub async fn seed_credit_registration(
    app_config: &ApplicationConfiguration,
    common_course_data: CommonCourseData,
) -> Result<Uuid> {
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
                    // suotar-in-course-banner.spec.ts needs a chapter page it can actually read.
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
            .seed(&mut conn, app_config, &cx)
            .await?;

    seed_old_flow_course(&mut conn, app_config, org, teacher_user_id).await?;
    seed_backfill_course(&mut conn, app_config, org, teacher_user_id).await?;
    seed_import_outcomes_course(&mut conn, app_config, org, teacher_user_id).await?;
    seed_grade_improvement_course(&mut conn, app_config, org, teacher_user_id).await?;
    seed_admin_course(&mut conn, app_config, org, teacher_user_id).await?;
    seed_states_course(&mut conn, app_config, org, teacher_user_id).await?;
    seed_retry_course(&mut conn, app_config, org, teacher_user_id).await?;

    info!("inserting credit registration students");

    let linked_student = insert_student(
        &mut conn,
        cx.v5(b"user:linked-student"),
        "credit-registration-linked-student@example.com",
        "Zzyzx",
        "Numberlinked",
    )
    .await?;
    let unlinked_student = insert_student(
        &mut conn,
        cx.v5(b"user:unlinked-student"),
        "credit-registration-unlinked-student@example.com",
        "Zzyzx",
        "Linkpending",
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
        &linked_student,
        &unlinked_student,
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

    // Linked and completed; the mock's enrolments decide which of them gets stuck where.
    for fixture in [
        &IMPORT_TIMEOUT,
        &SISU_OUTAGE,
        &NO_ENROLMENT,
        &TWO_ENROLMENTS,
        &VERIFY_POLLING,
        &VERIFY_MISREGISTERED,
        &EMAILS_REGISTERED,
        &EMAILS_NO_ENROLMENT,
        &BANNER_STUCK,
        &BANNER_REENROLS,
    ] {
        let student = seed_spec_student(
            &mut conn,
            &cx,
            fixture,
            suotar_course.id,
            suotar_instance.id,
        )
        .await?;
        seed_eligible_completion(&mut conn, &student, suotar_course.id, None).await?;
    }

    verified_student_numbers::insert(
        &mut conn,
        PKeyPolicy::Fixed(cx.v5(b"verified-student-number:linked-student")),
        &NewVerifiedStudentNumber {
            user_id: linked_student.user_id,
            student_number: LINKED_STUDENT.student_number.to_string(),
            sisu_person_id: LINKED_STUDENT.sisu_person_id(),
            first_names: Some(LINKED_STUDENT.first_names.to_string()),
            last_name: Some(LINKED_STUDENT.last_name.to_string()),
            verified_via: StudentNumberVerificationMethod::EmailedLink,
            verified_via_email: Some(LINKED_STUDENT.sisu_email.to_string()),
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

    seed_eligible_completion(&mut conn, &verified_email, suotar_course.id, None).await?;

    info!("inserting credit registration fast track near misses");
    seed_fast_track_near_misses(&mut conn, &cx).await?;

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

/// The accounts that make the fast track *not* fire, one per reason it may refuse. Each holds a
/// confirmed address, so what separates them is only the thing under test; the twin above is the
/// unconfirmed case. None of them is given a completion: being on the registry's roster is all it
/// takes to be offered to the fast track.
async fn seed_fast_track_near_misses(conn: &mut PgConnection, cx: &SeedContext) -> Result<()> {
    let now = Utc::now();
    for (fixture, verified_at) in [
        (&FAST_TRACK_STALE, now - Duration::days(400)),
        (&FAST_TRACK_NAME_MISMATCH, now - Duration::days(30)),
        (&FAST_TRACK_HAS_NUMBER, now - Duration::days(30)),
        (&FAST_TRACK_SECONDARY_ONLY, now - Duration::days(30)),
        (&FAST_TRACK_NO_MATCH, now - Duration::days(30)),
    ] {
        let account_email = fixture
            .account_email
            .ok_or_else(|| anyhow::anyhow!("a fast track near miss needs an account"))?;
        // Unlike its neighbours the mismatch account is a different person from the one the registry
        // names, which is the whole fixture.
        let (first_name, last_name) =
            if fixture.student_number == FAST_TRACK_NAME_MISMATCH.student_number {
                ("Qqoqq", "Accountname")
            } else {
                (fixture.first_names, fixture.last_name)
            };
        let student = insert_student(
            conn,
            cx.v5(account_email.as_bytes()),
            account_email,
            first_name,
            last_name,
        )
        .await?;
        user_details::set_email_verified(
            conn,
            student.user_id,
            EmailVerificationMethod::EmailedCode,
            verified_at,
        )
        .await?;
        if fixture.student_number == FAST_TRACK_HAS_NUMBER.student_number {
            verified_student_numbers::insert(
                conn,
                PKeyPolicy::Fixed(cx.v5(b"verified-student-number:fast-track-has-number")),
                &NewVerifiedStudentNumber {
                    user_id: student.user_id,
                    student_number: FAST_TRACK_OTHER_NUMBER.to_string(),
                    sisu_person_id: format!("hy-hlo-{FAST_TRACK_OTHER_NUMBER}"),
                    first_names: Some(fixture.first_names.to_string()),
                    last_name: Some(fixture.last_name.to_string()),
                    verified_via: StudentNumberVerificationMethod::EmailedLink,
                    verified_via_email: Some(account_email.to_string()),
                    verified_via_email_match_field: None,
                    account_email_verified_at: None,
                    linked_by_user_id: None,
                    link_reason: None,
                    verified_from_course_id: None,
                },
            )
            .await?;
        }
    }
    Ok(())
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
    app_config: &ApplicationConfiguration,
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
            .seed(conn, app_config, &cx)
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
    app_config: &ApplicationConfiguration,
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
    .seed(conn, app_config, &cx)
    .await?;

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
    app_config: &ApplicationConfiguration,
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
        .seed(conn, app_config, &cx)
        .await?;

    let unlinked = seed_spec_account(conn, &cx, &ADMIN_UNLINKED, course.id, instance.id).await?;
    seed_eligible_completion(conn, &unlinked, course.id, None).await?;
    let linked = seed_spec_student(conn, &cx, &ADMIN_LINKED, course.id, instance.id).await?;
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
    app_config: &ApplicationConfiguration,
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
    .seed(conn, app_config, &cx)
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

/// Rows a teacher may put back on the queue and rows they may not.
///
/// Its own course rather than more rows on the states course, because a bulk retry sweeps a whole
/// course and would leave the states fixture with no `failed_permanent` row and no error codes.
/// Paused for the same reason the states course is: a retried row has to hold still in
/// `ready_to_submit` long enough for the spec to read it.
async fn seed_retry_course(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    org: Uuid,
    teacher_user_id: Uuid,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: RETRY_COURSE_ID,
    };
    let (course, instance, _) = CourseBuilder::new("Credit registration retry", RETRY_COURSE_SLUG)
        .desc("Fixture course holding the registrations a teacher retries, and the ones they cannot.")
        .course_id(RETRY_COURSE_ID)
        .role(teacher_user_id, UserRole::Teacher)
        .instance(instance_config(cx.v5(b"instance:retry")))
        .module(
            ModuleBuilder::new()
                .order(0)
                .ects(5.0)
                .uh_course_code(CRS_RETRY_101.to_string())
                .credit_registration(CreditRegistrationSeed {
                    paused_reason: Some(
                        "Seeded fixture: the retry specs read these rows and the workers must not move them."
                            .to_string(),
                    ),
                    ..credit_registration_config(CRS_RETRY_101, false)
                }),
        )
        .seed(conn, app_config, &cx)
        .await?;

    // `Retry04` is not a failure, so no retry of any shape moves it: `suotar-teacher-views.spec.ts`
    // reads it both as the refusal and as the row whose state it asserts is unchanged.
    for (person, last_name, state) in [
        (80, "Retry01", CreditRegistrationState::FailedPermanent),
        (81, "Retry02", CreditRegistrationState::FailedPermanent),
        (82, "Retry03", CreditRegistrationState::SubmissionUncertain),
        (83, "Retry04", CreditRegistrationState::Cancelled),
    ] {
        seed_frozen_registration(
            conn,
            &cx,
            course.id,
            instance.id,
            person,
            last_name,
            state,
            None,
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
            ..Transition::planted(state)
        },
    )
    .await?;
    Ok(())
}

/// One module per failing import shape, so the spec picks its error by picking a module rather than
/// by flipping something every other spec on the course can see.
async fn seed_import_outcomes_course(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
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
    let (course, instance, _) = course.seed(conn, app_config, &cx).await?;
    let student = seed_spec_student(conn, &cx, &IMPORT_OUTCOMES, course.id, instance.id).await?;
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
    app_config: &ApplicationConfiguration,
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
            .uh_course_code(CRS_GRADED_101.to_string())
            .credit_registration(credit_registration_config(CRS_GRADED_101, false)),
    )
    .seed(conn, app_config, &cx)
    .await?;
    let student = seed_spec_student(conn, &cx, &GRADE_IMPROVEMENT, course.id, instance.id).await?;
    seed_eligible_completion(conn, &student, course.id, Some(3)).await?;
    Ok(())
}

/// A user, an enrolment and a verified student number for one spec's actor.
async fn seed_spec_student(
    conn: &mut PgConnection,
    cx: &SeedContext,
    fixture: &MockPersonFixture,
    course_id: Uuid,
    course_instance_id: Uuid,
) -> Result<SeededStudent> {
    let student = seed_spec_account(conn, cx, fixture, course_id, course_instance_id).await?;
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
/// defaults it to false, and such a completion never leaves `pending`.
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
            student_number: LINKED_STUDENT.student_number.to_string(),
            sisu_person_id: LINKED_STUDENT.sisu_person_id(),
            first_names: Some(LINKED_STUDENT.first_names.to_string()),
            last_name: Some(LINKED_STUDENT.last_name.to_string()),
            emailed_to: LINKED_STUDENT.sisu_email.to_string(),
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

    // One transaction: the deferred foreign key lets attempt 1 point at its successor before that
    // row exists, which is what clears `uq_credit_registrations_completion` for the insert.
    let mut tx = conn.begin().await?;
    let attempt_1 = insert_registered_attempt(
        &mut tx,
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
    credit_registrations::mark_superseded(&mut tx, attempt_1, SUPERSEDED_ATTEMPT_2_ID).await?;
    insert_registered_attempt(
        &mut tx,
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
    tx.commit().await?;
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
        &Transition::planted(CreditRegistrationState::Registered),
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
}
