//! Controllers for requests starting with `/api/v0/main-frontend/courses/{course_id}/completion-overview`.
use std::collections::HashMap;

use crate::controllers::main_frontend::course_credit_registrations::stage_of;
use crate::domain::authorization::{authorize_with_fetched_list_of_roles, is_permitted};
use crate::prelude::*;

use headless_lms_models::course_modules::{
    CompletionMethod, CreditRegistrationRoute, ExamRequirement, is_non_blank,
};
use headless_lms_models::library::credit_registration::StudentFacingCreditRegistrationStatus;
use utoipa::{OpenApi, ToSchema};

#[derive(OpenApi)]
#[openapi(paths(get_completion_overview))]
pub(crate) struct MainFrontendCourseCompletionOverviewApiDoc;

/// How students complete a course and get its credits, for the course Overview tab.
#[derive(Debug, Serialize, ToSchema)]
pub struct CourseCompletionOverview {
    /// In module order.
    pub modules: Vec<CourseModuleCompletionOverview>,
    /// The exams linked to the course, which every module passed by an exam on this platform uses.
    pub exams: CourseExamsOverview,
    /// Whether the user can view the course's credit registrations; without it every module's
    /// `not_yet_registered_count` is 0 and `credit_registration_pause_reason` is `None`.
    pub can_view_registrations: bool,
}

/// One module's completion and credit settings with the facts that tell whether they work.
#[derive(Debug, Serialize, ToSchema)]
pub struct CourseModuleCompletionOverview {
    pub course_module_id: Uuid,
    /// `None` for the default module.
    pub name: Option<String>,
    pub order_number: i32,
    pub completion_method: CompletionMethod,
    /// By requirements, the points needed to pass; by an exam, to take the exam.
    pub points_threshold: Option<i32>,
    /// By requirements, the exercises attempted needed to pass; by an exam, to take the exam.
    pub exercises_attempted_threshold: Option<i32>,
    pub exam_requirement: ExamRequirement,
    pub credit_registration_route: CreditRegistrationRoute,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub certification_enabled: bool,
    pub has_registration_link: bool,
    pub has_completions: bool,
    /// Credit registrations neither in Sisu yet nor given up on.
    pub not_yet_registered_count: i64,
    /// `None` until Sisu has been asked about the course code.
    pub course_code_allowed: Option<bool>,
    pub credit_registration_paused_at: Option<DateTime<Utc>>,
    pub credit_registration_pause_reason: Option<String>,
}

/// When the course's linked exams are held and whether they can pass anyone automatically.
#[derive(Debug, Serialize, ToSchema)]
pub struct CourseExamsOverview {
    pub count: usize,
    /// The latest end of an exam that has ended.
    pub last_ended_at: Option<DateTime<Utc>>,
    /// The window of the exam that ends next among those not ended yet.
    pub next_starts_at: Option<DateTime<Utc>>,
    pub next_ends_at: Option<DateTime<Utc>>,
    /// Whether at least one exam completes the students who reach its pass mark; otherwise every
    /// exam is graded manually or has no pass mark, and the teacher adds the completions.
    pub any_has_pass_mark: bool,
}

/**
GET `/api/v0/main-frontend/courses/{course_id}/completion-overview`
*/
#[utoipa::path(
    get,
    path = "",
    operation_id = "getCourseCompletionOverview",
    tag = "courses",
    params(("course_id" = Uuid, Path, description = "Course id")),
    responses(
        (status = 200, description = "How students complete the course and get its credits", body = CourseCompletionOverview)
    )
)]
#[instrument(skip(pool))]
async fn get_completion_overview(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseCompletionOverview>> {
    let mut conn = pool.acquire().await?;
    let user_roles = models::roles::get_roles(&mut conn, user.id).await?;
    let token = authorize_with_fetched_list_of_roles(
        &mut conn,
        Act::ViewInternalCourseStructure,
        Res::Course(*course_id),
        &user_roles,
    )
    .await?;
    let can_view_registrations = is_permitted(
        &mut conn,
        Act::ViewAndManageCreditRegistrations,
        Res::Course(*course_id),
        &user_roles,
    )
    .await?;

    let setups =
        models::course_modules::get_completion_setups_by_course_id(&mut conn, *course_id).await?;
    let mut not_yet_registered_counts: HashMap<Uuid, i64> = HashMap::new();
    if can_view_registrations {
        let counts = models::credit_registrations::count_by_module_and_state_for_course(
            &mut conn, *course_id, None,
        )
        .await?;
        for group in &counts {
            if !matches!(
                stage_of(group),
                StudentFacingCreditRegistrationStatus::Registered
                    | StudentFacingCreditRegistrationStatus::NotRegistering
            ) {
                *not_yet_registered_counts
                    .entry(group.course_module_id)
                    .or_default() += group.count;
            }
        }
    }
    let exams = models::exams::get_summaries_by_course_id(&mut conn, *course_id).await?;

    let modules = setups
        .into_iter()
        .map(|setup| {
            let has_thresholds = matches!(
                setup.completion_method,
                CompletionMethod::ByRequirements | CompletionMethod::ByExam
            );
            CourseModuleCompletionOverview {
                course_module_id: setup.id,
                order_number: setup.order_number,
                completion_method: setup.completion_method,
                points_threshold: setup
                    .automatic_completion_number_of_points_treshold
                    .filter(|_| has_thresholds),
                exercises_attempted_threshold: setup
                    .automatic_completion_number_of_exercises_attempted_treshold
                    .filter(|_| has_thresholds),
                exam_requirement: setup.exam_requirement,
                credit_registration_route: setup.credit_registration_route,
                certification_enabled: setup.certification_enabled,
                has_registration_link: is_non_blank(
                    setup.completion_registration_link_override.as_deref(),
                ),
                has_completions: setup.has_completions,
                not_yet_registered_count: not_yet_registered_counts
                    .get(&setup.id)
                    .copied()
                    .unwrap_or(0),
                course_code_allowed: setup.credit_registration_course_code_allowed,
                credit_registration_paused_at: setup.credit_registration_paused_at,
                credit_registration_pause_reason: setup
                    .credit_registration_pause_reason
                    .filter(|_| can_view_registrations),
                name: setup.name,
                uh_course_code: setup.uh_course_code,
                ects_credits: setup.ects_credits,
            }
        })
        .collect();

    let now = Utc::now();
    let last_ended_at = exams
        .iter()
        .filter_map(|exam| exam.ends_at)
        .filter(|ends_at| *ends_at <= now)
        .max();
    let next = exams
        .iter()
        .filter(|exam| exam.ends_at.is_some_and(|ends_at| ends_at > now))
        .min_by_key(|exam| exam.ends_at);

    token.authorized_ok(web::Json(CourseCompletionOverview {
        modules,
        exams: CourseExamsOverview {
            count: exams.len(),
            last_ended_at,
            next_starts_at: next.and_then(|exam| exam.starts_at),
            next_ends_at: next.and_then(|exam| exam.ends_at),
            any_has_pass_mark: exams.iter().any(|exam| exam.pass_mark().is_some()),
        },
        can_view_registrations,
    }))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("", web::get().to(get_completion_overview));
}
