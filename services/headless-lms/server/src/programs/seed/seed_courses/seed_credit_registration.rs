//! Database rows for the credit-registration (Suotar) system tests. The identities they are built
//! from, and the matching registry world, are in [`crate::controllers::mock_suotar::fixtures`].
//!
//! The workers tick every phase unscoped every few seconds in the test deployment, so a fixture row
//! nothing may move has to sit on a paused module — that is what the states course is for.

use std::collections::HashMap;

use anyhow::Result;
use chrono::{Duration, Utc};
use headless_lms_base::config::{
    ApplicationConfiguration, SuotarConfiguration, bool_env_false_by_default,
};
use headless_lms_models::{
    PKeyPolicy,
    course_instance_enrollments::{self, NewCourseInstanceEnrollment},
    course_module_completions::{self, NewCourseModuleCompletionSeed},
    course_modules,
    credit_registration_account_linking_emails::{self, NewAccountLinkingEmail},
    credit_registration_admin_actions::{
        self, COURSE_TEACHER_ROLE, CreditRegistrationAdminAction,
        CreditRegistrationAdminActionTarget, GLOBAL_ADMIN_ROLE, NewCreditRegistrationAdminAction,
    },
    credit_registrations::{
        self, CreditRegistrationErrorCode, CreditRegistrationState, NewCreditRegistration,
        PayloadSnapshot, Transition,
    },
    open_university_registration_links,
    roles::UserRole,
    secret::DbSecret,
    student_number_verification_tokens::{self, SeedStudentNumberVerificationToken},
    study_registry_registrars::{self, get_or_create_default_registrar},
    user_ai_usage_notice_acknowledgements, user_details,
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

/// The certificate detour's own course. Not in `mock_suotar::fixtures` with the others: this one
/// never reaches Suotar, so the mock registry knows nothing about it.
pub const CERTIFICATE_DETOUR_COURSE_ID: Uuid =
    Uuid::from_u128(0xc5ed17ea_0010_4a5e_9e6e_c0de00000010);
pub const CERTIFICATE_DETOUR_COURSE_SLUG: &str = "credit-registration-certificate-detour";
pub const CRS_DETOUR_101: &str = "CRS-DETOUR-101";

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

/// Enrolled on the general Suotar course and nothing else, for the studies page's empty state.
const PROFILE_EMPTY_EMAIL: &str = "student5@example.com";

/// A seeded student, with the deterministic id a spec navigates by.
struct SeededStudent {
    user_id: Uuid,
    email: String,
}

/// The accounts holding a linked number, by the fixture they were built from.
struct LinkedStudents {
    by_student_number: HashMap<&'static str, SeededStudent>,
}

impl LinkedStudents {
    fn get(&self, fixture: &MockPersonFixture) -> Result<&SeededStudent> {
        self.by_student_number
            .get(fixture.student_number)
            .ok_or_else(|| anyhow::anyhow!("{} was never seeded", fixture.student_number))
    }
}

/// A course with an instance, for enrolling students after the course itself exists.
#[derive(Clone, Copy)]
struct SeededCourse {
    course_id: Uuid,
    course_instance_id: Uuid,
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

    // Linked before any completion exists: a completion's registration path is decided at insert.
    info!("inserting credit registration students");
    let students = seed_linked_students(&mut conn, &cx).await?;

    info!("inserting credit registration courses");
    let suotar = seed_general_course(
        &mut conn,
        app_config,
        &cx,
        GeneralCourse {
            name: "Credit registration via Suotar",
            slug: SUOTAR_COURSE_SLUG,
            course_id: SUOTAR_COURSE_ID,
            course_code: CRS_101,
            // suotar-in-course-banner.spec.ts needs a chapter page it can actually read.
            has_chapter: true,
        },
    )
    .await?;
    let suotar_b = seed_general_course(
        &mut conn,
        app_config,
        &cx,
        GeneralCourse {
            name: "Credit registration via Suotar B",
            slug: SUOTAR_B_COURSE_SLUG,
            course_id: SUOTAR_B_COURSE_ID,
            course_code: CRS_B_101,
            has_chapter: false,
        },
    )
    .await?;
    let lanes = HashMap::from([(CRS_101, suotar), (CRS_B_101, suotar_b)]);

    seed_old_flow_course(&mut conn, app_config, org, teacher_user_id, &students).await?;
    seed_certificate_detour_course(
        &mut conn,
        app_config,
        org,
        teacher_user_id,
        students.get(&STUDENT_7)?,
        students.get(&STUDENT_8)?,
    )
    .await?;
    seed_import_outcomes_course(
        &mut conn,
        app_config,
        org,
        teacher_user_id,
        students.get(&STUDENT_8)?,
    )
    .await?;
    seed_grade_improvement_course(
        &mut conn,
        app_config,
        org,
        teacher_user_id,
        students.get(&CREDIT_REGISTRATION_STUDENT_2)?,
    )
    .await?;
    seed_admin_course(
        &mut conn,
        app_config,
        org,
        teacher_user_id,
        students.get(&CREDIT_REGISTRATION_STUDENT_1)?,
    )
    .await?;
    seed_states_course(&mut conn, app_config, org, teacher_user_id, &students).await?;
    seed_retry_course(&mut conn, app_config, org, teacher_user_id, &students).await?;

    info!("inserting credit registration completions");
    for lane in &LANE_COMPLETIONS {
        let course = lanes
            .get(lane.course_code)
            .ok_or_else(|| anyhow::anyhow!("no general course has code {}", lane.course_code))?;
        let student = students.get(lane.student)?;
        enroll(
            &mut conn,
            student.user_id,
            course.course_id,
            course.course_instance_id,
        )
        .await?;
        let module_id = default_module_id(&mut conn, course.course_id).await?;
        seed_eligible_completion(&mut conn, student, module_id, course.course_id, None).await?;
    }

    let link_claimer = insert_student(
        &mut conn,
        cx.v5(b"user:link-claimer"),
        LINK_CLAIMER_EMAIL,
        "Zzyzx",
        "Claimer",
    )
    .await?;
    let profile_empty_user_id = users::get_by_email(&mut conn, PROFILE_EMPTY_EMAIL)
        .await?
        .id;
    let replaced_attempts_holder = students.get(&STUDENT_6)?;
    for user_id in [
        link_claimer.user_id,
        profile_empty_user_id,
        replaced_attempts_holder.user_id,
    ] {
        enroll(
            &mut conn,
            user_id,
            suotar.course_id,
            suotar.course_instance_id,
        )
        .await?;
    }

    info!("inserting credit registration linking tokens");
    seed_linking_tokens(
        &mut conn,
        &cx,
        suotar.course_id,
        replaced_attempts_holder.user_id,
    )
    .await?;

    info!("inserting credit registration ledger history");
    seed_superseded_attempt_pair(&mut conn, replaced_attempts_holder, suotar).await?;

    study_registry_registrars::insert(
        &mut conn,
        PKeyPolicy::Fixed(PULL_REGISTRAR_ID),
        "Credit registration system tests (pull)",
        PULL_REGISTRAR_SECRET_KEY,
    )
    .await?;

    info!("inserting credit registration admin actions");
    seed_admin_actions(&mut conn, &cx, suotar.course_id, teacher_user_id).await?;

    push_mock_suotar_world(&base_url).await?;

    Ok(SUOTAR_COURSE_ID)
}

/// Creates the credit-registration accounts and links every seeded student to its fixture's number.
/// `student6`–`student8` already exist: the general user seed creates them.
async fn seed_linked_students(conn: &mut PgConnection, cx: &SeedContext) -> Result<LinkedStudents> {
    let mut by_student_number = HashMap::new();
    for fixture in [&STUDENT_6, &STUDENT_7, &STUDENT_8] {
        let email = account_email(fixture)?;
        let user_id = users::get_by_email(conn, email).await?.id;
        link_student_number(
            conn,
            cx,
            fixture,
            user_id,
            StudentNumberVerificationMethod::EmailedLink,
        )
        .await?;
        by_student_number.insert(
            fixture.student_number,
            SeededStudent {
                user_id,
                email: email.to_string(),
            },
        );
    }
    for fixture in [
        &CREDIT_REGISTRATION_STUDENT_1,
        &CREDIT_REGISTRATION_STUDENT_2,
        &CREDIT_REGISTRATION_STUDENT_3,
        &CREDIT_REGISTRATION_STUDENT_4,
        &CREDIT_REGISTRATION_STUDENT_5,
        &CREDIT_REGISTRATION_STUDENT_6,
    ] {
        let email = account_email(fixture)?;
        let student = insert_student(
            conn,
            cx.v5(email.as_bytes()),
            email,
            fixture.first_names,
            fixture.last_name,
        )
        .await?;
        let verified_via = if fixture.student_number == CREDIT_REGISTRATION_STUDENT_2.student_number
        {
            StudentNumberVerificationMethod::AdminManual
        } else {
            StudentNumberVerificationMethod::EmailedLink
        };
        link_student_number(conn, cx, fixture, student.user_id, verified_via).await?;
        by_student_number.insert(fixture.student_number, student);
    }
    Ok(LinkedStudents { by_student_number })
}

fn account_email(fixture: &MockPersonFixture) -> Result<&'static str> {
    fixture
        .account_email
        .ok_or_else(|| anyhow::anyhow!("{} has no account", fixture.student_number))
}

struct GeneralCourse {
    name: &'static str,
    slug: &'static str,
    course_id: Uuid,
    course_code: &'static str,
    has_chapter: bool,
}

/// One of the courses [`LANE_COMPLETIONS`] allocates: a single working Suotar module.
async fn seed_general_course(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    cx: &SeedContext,
    general: GeneralCourse,
) -> Result<SeededCourse> {
    let cx = SeedContext {
        teacher: cx.teacher,
        org: cx.org,
        base_course_ns: general.course_id,
    };
    let mut module = ModuleBuilder::new()
        .order(0)
        .ects(5.0)
        .uh_course_code(general.course_code.to_string())
        .credit_registration(credit_registration_config(general.course_code));
    if general.has_chapter {
        module = module.chapter(
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
        );
    }
    let (course, instance, _) = CourseBuilder::new(general.name, general.slug)
        .desc("Fixture course for the credit registration system tests.")
        .course_id(general.course_id)
        .role(cx.teacher, UserRole::Teacher)
        .instance(instance_config(cx.v5(b"instance:suotar")))
        .module(module)
        .seed(conn, app_config, &cx)
        .await?;
    Ok(SeededCourse {
        course_id: course.id,
        course_instance_id: instance.id,
    })
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

/// Turns the module on with an enrolment link unique to its course code, without which the config
/// check flags the module, and opts its linked students' completions in.
fn credit_registration_config(course_code: &str) -> CreditRegistrationSeed {
    CreditRegistrationSeed {
        enrolment_link: Some(format!(
            "https://www.avoin.helsinki.fi/palvelut/esittely.aspx?s=seed-{course_code}"
        )),
        paused_reason: None,
        register_eligible_new_completions: true,
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

/// Owned by `suotar-old-flow-coexistence.spec.ts`.
///
/// Module 0 stays on the legacy pull path outright. Module 1 is opted into Suotar, but its one
/// completion predates the opt-in and was already registered through the legacy pull path, so it
/// must stay there and never get a Suotar registration. The two completions belong to different
/// students because the spec tells them apart in the pull stream by address.
async fn seed_old_flow_course(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    org: Uuid,
    teacher_user_id: Uuid,
    students: &LinkedStudents,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: OLD_FLOW_COURSE_ID,
    };
    let registrar_id = get_or_create_default_registrar(conn).await?;
    let still_legacy = students.get(&STUDENT_7)?;
    let predates_opt_in = students.get(&STUDENT_8)?;

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
                    .name("Opted into Suotar")
                    .ects(5.0)
                    .uh_course_code(CRS_OLD_102.to_string())
                    .credit_registration(CreditRegistrationSeed {
                        register_eligible_new_completions: false,
                        ..credit_registration_config(CRS_OLD_102)
                    })
                    .default_registrar(registrar_id)
                    .completion(
                        CompletionBuilder::new(predates_opt_in.user_id)
                            .email(predates_opt_in.email.clone())
                            .grade(3)
                            .passed(true)
                            .prerequisite_modules_completed(true)
                            .registered(
                                CompletionRegisteredBuilder::new()
                                    .real_student_number(STUDENT_8.student_number),
                            ),
                    ),
            )
            .seed(conn, app_config, &cx)
            .await?;

    for student in [still_legacy, predates_opt_in] {
        enroll(conn, student.user_id, course.id, instance.id).await?;
    }
    Ok(())
}

/// Owned by `completion-registration-certificate-detour.spec.ts`.
///
/// The one combination that draws the certificate detour on the old registration page: open
/// university registration and a certificate the student can generate instead. No sample course has
/// both, and the courses that come closest must keep the plain page they already test.
///
/// `failed_save_student` gets a completion of its own on the same module, so the spec's failed-save
/// test can run independently of the test that saves a reason for `student` permanently.
async fn seed_certificate_detour_course(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    org: Uuid,
    teacher_user_id: Uuid,
    student: &SeededStudent,
    failed_save_student: &SeededStudent,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: CERTIFICATE_DETOUR_COURSE_ID,
    };

    let (course, instance, module) = CourseBuilder::new(
        "Credit registration certificate detour",
        CERTIFICATE_DETOUR_COURSE_SLUG,
    )
    .desc("Fixture course whose open university module also offers a certificate.")
    .course_id(CERTIFICATE_DETOUR_COURSE_ID)
    .instance(instance_config(cx.v5(b"instance:certificate-detour")))
    .module(
        ModuleBuilder::new()
            .order(0)
            .ects(5.0)
            .uh_course_code(CRS_DETOUR_101.to_string())
            .register_to_open_university(true)
            .completion(
                CompletionBuilder::new(student.user_id)
                    .email(student.email.clone())
                    .grade(3)
                    .passed(true)
                    .prerequisite_modules_completed(true),
            )
            .completion(
                CompletionBuilder::new(failed_save_student.user_id)
                    .email(failed_save_student.email.clone())
                    .grade(3)
                    .passed(true)
                    .prerequisite_modules_completed(true),
            ),
    )
    .certificate_config("svgs/certificate-background.svg", None)
    .seed(conn, app_config, &cx)
    .await?;

    course_modules::update_certification_enabled(conn, module.id, true).await?;
    open_university_registration_links::upsert(conn, CRS_DETOUR_101, "https://www.example.com")
        .await?;
    for enrolled_student in [student, failed_save_student] {
        enroll(conn, enrolled_student.user_id, course.id, instance.id).await?;
    }
    Ok(())
}

/// The account-linking fixtures, on a course of their own, and one linked student a tick can
/// register.
///
/// The stale-address list only renders a (person, course) mailed to the cap and never claimed, which
/// takes three mails at three addresses because the dedup key is the address.
async fn seed_admin_course(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    org: Uuid,
    teacher_user_id: Uuid,
    linked: &SeededStudent,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: ADMIN_COURSE_ID,
    };
    let (course, instance, module) =
        CourseBuilder::new("Credit registration admin", ADMIN_COURSE_SLUG)
            .desc("Fixture course for the admin dashboard's account linking views.")
            .course_id(ADMIN_COURSE_ID)
            .role(teacher_user_id, UserRole::Teacher)
            .instance(instance_config(cx.v5(b"instance:admin")))
            .module(
                ModuleBuilder::new()
                    .order(0)
                    .ects(5.0)
                    .uh_course_code(CRS_ADMIN_101.to_string())
                    .credit_registration(credit_registration_config(CRS_ADMIN_101)),
            )
            .seed(conn, app_config, &cx)
            .await?;

    enroll(conn, linked.user_id, course.id, instance.id).await?;
    seed_eligible_completion(conn, linked, module.id, course.id, None).await?;

    for fixture in [&ADMIN_STALE, &TEACHER_RESEND_CAPPED] {
        for suffix in MAILED_ADDRESS_SUFFIXES {
            let address = format!("{suffix}{}", fixture.sisu_email);
            let claimed = credit_registration_account_linking_emails::claim_send_slot(
                conn,
                &NewAccountLinkingEmail {
                    student_number: DbSecret::new(fixture.student_number),
                    sisu_person_id: DbSecret::new(fixture.sisu_person_id()),
                    course_id: course.id,
                    emailed_to: DbSecret::new(address.clone()),
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
/// An account holds one completion per module, so the rows are spread over a grid of holders and
/// modules. The modules are paused because every phase's claim query skips paused modules;
/// otherwise the workers in the test deployment would walk these onwards seconds after the seed
/// finished.
async fn seed_states_course(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    org: Uuid,
    teacher_user_id: Uuid,
    students: &LinkedStudents,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: STATES_COURSE_ID,
    };
    let mut course = CourseBuilder::new("Credit registration states", STATES_COURSE_SLUG)
        .desc("Fixture course holding one frozen registration per state and per error code.")
        .course_id(STATES_COURSE_ID)
        .role(teacher_user_id, UserRole::Teacher)
        .instance(instance_config(cx.v5(b"instance:states")));
    for (order, course_code) in STATES_COURSE_CODES.iter().enumerate() {
        let mut module = ModuleBuilder::new()
            .order(order as i32)
            .ects(5.0)
            .uh_course_code(course_code.to_string())
            .credit_registration(CreditRegistrationSeed {
                paused_reason: Some(
                    "Seeded fixture: these rows are read by the teacher and admin views and must not move."
                        .to_string(),
                ),
                ..credit_registration_config(course_code)
            });
        if order > 0 {
            module = module.name(format!("Module {course_code}"));
        }
        course = course.module(module);
    }
    let (course, instance, _) = course.seed(conn, app_config, &cx).await?;
    let seeded = SeededCourse {
        course_id: course.id,
        course_instance_id: instance.id,
    };

    let holders = [
        students.get(&STUDENT_7)?,
        students.get(&STUDENT_8)?,
        students.get(&CREDIT_REGISTRATION_STUDENT_1)?,
        students.get(&CREDIT_REGISTRATION_STUDENT_2)?,
        students.get(&CREDIT_REGISTRATION_STUDENT_3)?,
        students.get(&CREDIT_REGISTRATION_STUDENT_4)?,
        students.get(&CREDIT_REGISTRATION_STUDENT_5)?,
    ];
    for holder in holders {
        enroll(conn, holder.user_id, course.id, instance.id).await?;
    }
    let module_ids = module_ids_by_course_code(conn, course.id).await?;

    // Every code on the same state, so the explorer's error-code filter can be exercised alone.
    let rows = CreditRegistrationState::ALL
        .iter()
        .map(|state| (*state, None))
        .chain(
            CreditRegistrationErrorCode::ALL
                .iter()
                .map(|code| (CreditRegistrationState::FailedPermanent, Some(*code))),
        );
    for (index, (state, error_code)) in rows.enumerate() {
        let holder = holders[index % holders.len()];
        let course_code = STATES_COURSE_CODES
            .get(index / holders.len())
            .ok_or_else(|| anyhow::anyhow!("the states grid has too few modules"))?;
        let module_id = *module_ids
            .get(*course_code)
            .ok_or_else(|| anyhow::anyhow!("no states module has code {course_code}"))?;
        seed_frozen_registration(conn, &cx, seeded, module_id, holder, state, error_code).await?;
    }
    Ok(())
}

async fn module_ids_by_course_code(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> Result<HashMap<String, Uuid>> {
    Ok(course_modules::get_by_course_id(conn, course_id)
        .await?
        .into_iter()
        .filter_map(|module| module.uh_course_code.map(|code| (code, module.id)))
        .collect())
}

/// Rows a teacher may put back on the queue and rows they may not, one per holder so a spec finds
/// each by the holder's last name.
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
    students: &LinkedStudents,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: RETRY_COURSE_ID,
    };
    let (course, instance, module) =
        CourseBuilder::new("Credit registration retry", RETRY_COURSE_SLUG)
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
                        ..credit_registration_config(CRS_RETRY_101)
                    }),
            )
            .seed(conn, app_config, &cx)
            .await?;
    let seeded = SeededCourse {
        course_id: course.id,
        course_instance_id: instance.id,
    };

    // The cancelled row is not a failure, so no retry of any shape moves it:
    // `suotar-teacher-views.spec.ts` reads it both as the refusal and as the row whose state it
    // asserts is unchanged.
    for (fixture, state) in [
        (
            &CREDIT_REGISTRATION_STUDENT_1,
            CreditRegistrationState::FailedPermanent,
        ),
        (
            &CREDIT_REGISTRATION_STUDENT_2,
            CreditRegistrationState::FailedPermanent,
        ),
        (
            &CREDIT_REGISTRATION_STUDENT_3,
            CreditRegistrationState::SubmissionUncertain,
        ),
        (
            &CREDIT_REGISTRATION_STUDENT_4,
            CreditRegistrationState::Cancelled,
        ),
    ] {
        let holder = students.get(fixture)?;
        enroll(conn, holder.user_id, course.id, instance.id).await?;
        seed_frozen_registration(conn, &cx, seeded, module.id, holder, state, None).await?;
    }
    Ok(())
}

/// One completion and one ledger row parked in `state`, for `student` on `course_module_id`.
async fn seed_frozen_registration(
    conn: &mut PgConnection,
    cx: &SeedContext,
    course: SeededCourse,
    course_module_id: Uuid,
    student: &SeededStudent,
    state: CreditRegistrationState,
    error_code: Option<CreditRegistrationErrorCode>,
) -> Result<()> {
    let completion_id =
        seed_eligible_completion(conn, student, course_module_id, course.course_id, None).await?;
    let id = credit_registrations::insert(
        conn,
        PKeyPolicy::Fixed(
            cx.v5(format!("credit-registration:{}:{course_module_id}", student.email).as_bytes()),
        ),
        &NewCreditRegistration {
            course_module_completion_id: completion_id,
            user_id: student.user_id,
            course_id: course.course_id,
            course_module_id,
            course_instance_id: course.course_instance_id,
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
    student: &SeededStudent,
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
            .credit_registration(credit_registration_config(course_code));
        if order > 0 {
            module = module.name(format!("Module {course_code}"));
        }
        course = course.module(module);
    }
    let (course, instance, _) = course.seed(conn, app_config, &cx).await?;
    enroll(conn, student.user_id, course.id, instance.id).await?;
    for module in course_modules::get_by_course_id(conn, course.id).await? {
        seed_eligible_completion(conn, student, module.id, course.id, None).await?;
    }
    Ok(())
}

async fn seed_grade_improvement_course(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    org: Uuid,
    teacher_user_id: Uuid,
    student: &SeededStudent,
) -> Result<()> {
    let cx = SeedContext {
        teacher: teacher_user_id,
        org,
        base_course_ns: GRADE_IMPROVEMENT_COURSE_ID,
    };
    let (course, instance, module) = CourseBuilder::new(
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
            .credit_registration(credit_registration_config(CRS_GRADED_101)),
    )
    .seed(conn, app_config, &cx)
    .await?;
    enroll(conn, student.user_id, course.id, instance.id).await?;
    seed_eligible_completion(conn, student, module.id, course.id, Some(3)).await?;
    Ok(())
}

async fn link_student_number(
    conn: &mut PgConnection,
    cx: &SeedContext,
    fixture: &MockPersonFixture,
    user_id: Uuid,
    verified_via: StudentNumberVerificationMethod,
) -> Result<()> {
    let is_admin_manual = verified_via == StudentNumberVerificationMethod::AdminManual;
    verified_student_numbers::insert(
        conn,
        PKeyPolicy::Fixed(cx.v5(format!("verified:{}", fixture.student_number).as_bytes())),
        &NewVerifiedStudentNumber {
            user_id,
            student_number: DbSecret::new(fixture.student_number),
            sisu_person_id: DbSecret::new(fixture.sisu_person_id()),
            first_names: Some(DbSecret::new(fixture.first_names)),
            last_name: Some(DbSecret::new(fixture.last_name)),
            verified_via,
            verified_via_email: (!is_admin_manual).then(|| DbSecret::new(fixture.sisu_email)),
            linked_by_user_id: is_admin_manual.then_some(cx.teacher),
            link_reason: is_admin_manual
                .then(|| "Seeded fixture: the address Sisu holds rejects our mail.".to_string()),
            verified_from_course_id: None,
        },
    )
    .await?;
    Ok(())
}

/// Enrols the way a student who has been through the course's opening dialogs is: without
/// `user_course_settings` and the AI notice acknowledgement, the course pages open on a dialog.
async fn enroll(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    course_instance_id: Uuid,
) -> Result<()> {
    course_instance_enrollments::insert_enrollment_and_set_as_current(
        conn,
        NewCourseInstanceEnrollment {
            user_id,
            course_id,
            course_instance_id,
        },
    )
    .await?;
    user_ai_usage_notice_acknowledgements::acknowledge(conn, user_id, course_id).await?;
    Ok(())
}

async fn default_module_id(conn: &mut PgConnection, course_id: Uuid) -> Result<Uuid> {
    Ok(course_modules::get_default_by_course_id(conn, course_id)
        .await?
        .id)
}

/// A completion the pipeline will pick up. `prerequisite_modules_completed` is the trap: the builder
/// defaults it to false, and such a completion never leaves `pending`.
async fn seed_eligible_completion(
    conn: &mut PgConnection,
    student: &SeededStudent,
    course_module_id: Uuid,
    course_id: Uuid,
    grade: Option<i32>,
) -> Result<Uuid> {
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
            student_number: STUDENT_6.student_number.to_string(),
            sisu_person_id: STUDENT_6.sisu_person_id(),
            first_names: Some(STUDENT_6.first_names.to_string()),
            last_name: Some(STUDENT_6.last_name.to_string()),
            emailed_to: STUDENT_6.sisu_email.to_string(),
            course_id: Some(course_id),
            expires_at: now + Duration::days(14),
            used_at: None,
            claimed_by_user_id: None,
        },
    )
    .await?;
    Ok(())
}

/// A registered grade-3 attempt superseded by a grade-4 one, so the admin-detail and profile specs
/// get an attempt chain without driving a regrade first.
async fn seed_superseded_attempt_pair(
    conn: &mut PgConnection,
    student: &SeededStudent,
    course: SeededCourse,
) -> Result<()> {
    let course_module_id = default_module_id(conn, course.course_id).await?;
    let completion_id = course_module_completions::insert_seed_row(
        conn,
        &NewCourseModuleCompletionSeed {
            course_id: course.course_id,
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
        course,
        course_module_id,
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
        course,
        course_module_id,
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
    course: SeededCourse,
    course_module_id: Uuid,
    attempt_number: i32,
    grade_id: &str,
) -> Result<Uuid> {
    let id = credit_registrations::insert(
        conn,
        PKeyPolicy::Fixed(id),
        &NewCreditRegistration {
            course_module_completion_id,
            user_id,
            course_id: course.course_id,
            course_module_id,
            course_instance_id: course.course_instance_id,
            attempt_number,
        },
        Some("Seeded fixture"),
    )
    .await?;
    credit_registrations::set_payload_snapshot(
        conn,
        id,
        &PayloadSnapshot {
            student_number: DbSecret::new(STUDENT_6.student_number),
            sisu_person_id: Some(DbSecret::new(STUDENT_6.sisu_person_id())),
            uh_course_code: CRS_101.to_string(),
            selected_enrolment_id: Some(format!("otm-{}-degree", STUDENT_6.student_number)),
            selected_enrolment_kind: Some("degree".to_string()),
            selected_enrolment_realisation_id: Some("hy-opt-cur-900000901".to_string()),
            selected_enrolment_realisation_name: Some(serde_json::json!({
                "fi": "Rekisteröinnin testitoteutus",
                "en": "Registration test realisation",
                "sv": null,
            })),
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
