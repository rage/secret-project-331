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
//! No module here has `enable_credit_registration_via_suotar` on, and nothing may turn it on: the
//! backfill spec flips it from the UI, which is one-way and run-wide.

use anyhow::Result;
use chrono::{Duration, Utc};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    PKeyPolicy, course_credit_registration_consents, course_instance_enrollments,
    course_module_completions::{self, NewCourseModuleCompletionSeed},
    credit_registration_admin_actions::{
        self, CreditRegistrationAdminAction, CreditRegistrationAdminActionTarget,
        NewCreditRegistrationAdminAction,
    },
    credit_registrations::{
        self, CreditRegistrationState, NewCreditRegistration, PayloadSnapshot, Transition,
    },
    student_number_verification_tokens::{self, SeedStudentNumberVerificationToken},
    study_registry_registrars::get_or_create_default_registrar,
    user_details::{self, EmailVerificationMethod},
    user_passwords::{hash_password, upsert_user_password},
    users,
    verified_student_numbers::{self, NewVerifiedStudentNumber, StudentNumberVerificationMethod},
};
use secrecy::SecretString;
use sqlx::PgConnection;
use tracing::info;
use uuid::Uuid;

use crate::programs::seed::builder::{
    chapter::ChapterBuilder,
    context::SeedContext,
    course::{CourseBuilder, CourseInstanceConfig},
    module::{CompletionBuilder, CompletionRegisteredBuilder, ModuleBuilder},
    page::PageBuilder,
};
use crate::programs::seed::seed_courses::CommonCourseData;
use crate::programs::seed::seed_helpers::paragraph;

/// The course the Suotar specs live on.
pub const SUOTAR_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0001_4a5e_9e6e_c0de00000001);
/// A course left on the legacy open-university pull flow, for the coexistence specs.
pub const OLD_FLOW_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0002_4a5e_9e6e_c0de00000002);
/// Owned outright by `suotar-backfill-and-late-consent.spec.ts`, which flips the Suotar flag on.
pub const BACKFILL_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0003_4a5e_9e6e_c0de00000003);

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
    let (suotar_course, suotar_instance, _) = CourseBuilder::new(
        "Credit registration via Suotar",
        "credit-registration-via-suotar",
    )
    .desc("Fixture course for the credit registration system tests. The Suotar flag is off.")
    .course_id(SUOTAR_COURSE_ID)
    .instance(instance_config(suotar_instance_id))
    .module(
        ModuleBuilder::new()
            .order(0)
            .ects(5.0)
            .uh_course_code("CRS-101".to_string())
            .chapter(
                // The in-course re-enrol banner spec needs a chapter page it can actually read.
                ChapterBuilder::new(1, "Registering credits")
                    .opens(Utc::now())
                    .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:front-page"))
                    .page(
                        PageBuilder::new("/chapter-1/page-1", "How registration works").block(
                            paragraph(
                                "Completing this module registers credits into Sisu.",
                                cx.v5(b"page:1:1:block"),
                            ),
                        ),
                    ),
            ),
    )
    .module(
        ModuleBuilder::new()
            .order(1)
            .name("Second module")
            .ects(3.0)
            .uh_course_code("CRS-102".to_string()),
    )
    .seed(&mut conn, app_config, &cx)
    .await?;

    let old_flow_cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: OLD_FLOW_COURSE_ID,
    };
    CourseBuilder::new(
        "Credit registration old flow",
        "credit-registration-old-flow",
    )
    .desc("Fixture course left on the legacy open university registration flow.")
    .course_id(OLD_FLOW_COURSE_ID)
    .instance(instance_config(old_flow_cx.v5(b"instance:old-flow")))
    .module(
        ModuleBuilder::new()
            .order(0)
            .ects(5.0)
            .uh_course_code("CRS-OLD-101".to_string())
            .register_to_open_university(true),
    )
    .seed(&mut conn, app_config, &old_flow_cx)
    .await?;

    seed_backfill_course(&mut conn, app_config, org, teacher_user_id).await?;

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

    for student in [
        &consented_linked,
        &consented_unlinked,
        &not_consented,
        &verified_email,
        &unverified_twin,
        &superseded_student,
    ] {
        course_instance_enrollments::insert(
            &mut conn,
            student.user_id,
            suotar_course.id,
            suotar_instance.id,
        )
        .await?;
    }

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
            student_number: "900000101".to_string(),
            sisu_person_id: "hy-hlo-900000101".to_string(),
            first_names: Some("Zzyzx".to_string()),
            last_name: Some("Happypath".to_string()),
            verified_via: StudentNumberVerificationMethod::EmailedLink,
            verified_via_email: Some("zzyzx.happypath@helsinki.example".to_string()),
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
            student_number: "900000901".to_string(),
            sisu_person_id: "hy-hlo-900000901".to_string(),
            first_names: Some("Zzyzx".to_string()),
            last_name: Some("Regraded".to_string()),
            verified_via: StudentNumberVerificationMethod::EmailedLink,
            verified_via_email: Some("zzyzx.regraded@helsinki.example".to_string()),
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

    info!("inserting credit registration linking tokens");
    seed_linking_tokens(&mut conn, &cx, suotar_course.id, unverified_twin.user_id).await?;

    info!("inserting credit registration ledger history");
    seed_superseded_attempt_pair(
        &mut conn,
        &cx,
        &superseded_student,
        suotar_course.id,
        suotar_instance.id,
    )
    .await?;

    info!("inserting credit registration admin actions");
    seed_admin_actions(&mut conn, &cx, suotar_course.id, teacher_user_id).await?;

    Ok(SUOTAR_COURSE_ID)
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
        .uh_course_code("CRS-BACKFILL-101".to_string())
        .default_registrar(registrar_id);

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
            .passed(true);
        if index == 1 {
            completion = completion.registered(
                CompletionRegisteredBuilder::new().real_student_number(format!("90000110{index}")),
            );
        }
        module = module.completion(completion);
    }

    let (course, instance, _) = CourseBuilder::new(
        "Credit registration backfill",
        "credit-registration-backfill",
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
        course_credit_registration_consents::upsert(conn, user_id, course.id, true).await?;
    }
    Ok(())
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
            student_number: "900000201".to_string(),
            sisu_person_id: "hy-hlo-900000201".to_string(),
            first_names: Some("Zzyzx".to_string()),
            last_name: Some("Linkvalid".to_string()),
            emailed_to: "zzyzx.linkvalid@helsinki.example".to_string(),
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
            student_number: "900000202".to_string(),
            sisu_person_id: "hy-hlo-900000202".to_string(),
            first_names: Some("Zzyzx".to_string()),
            last_name: Some("Linkexpired".to_string()),
            emailed_to: "zzyzx.linkexpired@helsinki.example".to_string(),
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
            student_number: "900000203".to_string(),
            sisu_person_id: "hy-hlo-900000203".to_string(),
            first_names: Some("Zzyzx".to_string()),
            last_name: Some("Linkused".to_string()),
            emailed_to: "zzyzx.linkused@helsinki.example".to_string(),
            course_id: Some(course_id),
            expires_at: now + Duration::days(14),
            used_at: Some(now - Duration::hours(1)),
            claimed_by_user_id: Some(claimed_by_user_id),
        },
    )
    .await?;
    Ok(())
}

/// A registered grade-3 attempt superseded by a grade-4 one, so the admin-detail and
/// grade-improvement specs get an attempt chain without driving a regrade first.
async fn seed_superseded_attempt_pair(
    conn: &mut PgConnection,
    cx: &SeedContext,
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
        cx.v5(b"credit-registration:superseded:attempt-1"),
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
        cx.v5(b"credit-registration:superseded:attempt-2"),
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
            student_number: "900000901".to_string(),
            sisu_person_id: "hy-hlo-900000901".to_string(),
            uh_course_code: "CRS-101".to_string(),
            selected_enrolment_id: Some("otm-900000901-degree".to_string()),
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
            action: CreditRegistrationAdminAction::TransitionItem,
            target_kind: CreditRegistrationAdminActionTarget::CreditRegistration,
            target_id: Some(cx.v5(b"credit-registration:superseded:attempt-1")),
            target_phase: None,
            actor_user_id: admin_user_id,
            actor_role: "global_admin".to_string(),
            actor_course_id: None,
            reason: Some("Seeded fixture: checked Sisu by hand and requeued".to_string()),
            before_state: Some(CreditRegistrationState::SubmissionUncertain),
            after_state: Some(CreditRegistrationState::Registered),
            details: None,
            affected_row_count: Some(1),
        },
    )
    .await?;
    credit_registration_admin_actions::record(
        conn,
        &NewCreditRegistrationAdminAction {
            action: CreditRegistrationAdminAction::ResendLinkEmail,
            target_kind: CreditRegistrationAdminActionTarget::StudentNumberVerificationToken,
            target_id: Some(cx.v5(b"linking-token:valid")),
            target_phase: None,
            actor_user_id: teacher_user_id,
            actor_role: "course_teacher".to_string(),
            actor_course_id: Some(course_id),
            reason: Some("Seeded fixture: student reported the mail never arrived".to_string()),
            before_state: None,
            after_state: None,
            details: None,
            affected_row_count: Some(1),
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
        ] {
            assert!(token.len() >= 128, "token too short: {}", token.len());
        }
    }
}
