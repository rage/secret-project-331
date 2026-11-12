//! Controllers for requests starting with `/api/v0/main-frontend/courses/{course_id}/completion-overview`.
use std::collections::HashSet;

use crate::controllers::main_frontend::course_credit_registrations::stage_of;
use crate::prelude::*;

use headless_lms_models::course_modules::{
    CompletionMethod, CreditRegistrationRoute, ExamRequirement,
};
use headless_lms_models::library::credit_registration::StudentFacingCreditRegistrationStatus;
use utoipa::{OpenApi, ToSchema};

#[derive(OpenApi)]
#[openapi(paths(get_completion_overview))]
pub(crate) struct MainFrontendCourseCompletionOverviewApiDoc;

/// How students complete a course and get its credits, for the course Overview tab.
#[derive(Debug, Serialize, ToSchema)]
pub struct CourseCompletionOverview {
    pub modules: Vec<CourseModuleCompletionOverview>,
    /// The exams linked to the course, which every module passed by an exam on this platform uses.
    pub exams: CourseExamsOverview,
}

/// One module's completion and credit settings with the facts that tell whether they work.
#[derive(Debug, Serialize, ToSchema)]
pub struct CourseModuleCompletionOverview {
    pub course_module_id: Uuid,
    /// `None` for the default module.
    pub name: Option<String>,
    pub order_number: i32,
    pub completion_method: CompletionMethod,
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
    pub pass_marks: ExamPassMarks,
}

/// Whether the linked exams can complete anyone automatically.
#[derive(Debug, Serialize, ToSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExamPassMarks {
    NoExams,
    /// At least one exam completes the students who reach its pass mark.
    SomeHavePassMark,
    /// Every exam is graded manually or has no pass mark, so the teacher adds the completions.
    NoneHavePassMark,
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
    let token = authorize(
        &mut conn,
        Act::ViewInternalCourseStructure,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let mut modules = models::course_modules::get_by_course_id(&mut conn, *course_id).await?;
    modules.sort_by_key(|module| module.order_number);
    let configs =
        models::course_modules::get_credit_registration_configs_by_course_id(&mut conn, *course_id)
            .await?;
    let completed_module_ids: HashSet<Uuid> =
        models::course_module_completions::get_completed_module_ids_by_course_id(
            &mut conn, *course_id,
        )
        .await?
        .into_iter()
        .collect();
    let registration_counts = models::credit_registrations::count_by_module_and_state_for_course(
        &mut conn, *course_id, None,
    )
    .await?;
    let exam_ids = models::course_exams::get_exam_ids_by_course_id(&mut conn, *course_id).await?;
    let exams = models::exams::get_summaries_by_ids(&mut conn, &exam_ids).await?;

    let modules = modules
        .into_iter()
        .map(|module| {
            let config = configs.iter().find(|c| c.course_module_id == module.id);
            let not_yet_registered_count = registration_counts
                .iter()
                .filter(|group| group.course_module_id == module.id)
                .filter(|group| {
                    !matches!(
                        stage_of(group),
                        StudentFacingCreditRegistrationStatus::Registered
                            | StudentFacingCreditRegistrationStatus::NotRegistering
                    )
                })
                .map(|group| group.count)
                .sum();
            CourseModuleCompletionOverview {
                course_module_id: module.id,
                order_number: module.order_number,
                completion_method: module.completion_policy.method(),
                exam_requirement: module.exam_requirement,
                credit_registration_route: module.credit_registration_route,
                certification_enabled: module.certification_enabled,
                has_registration_link: module
                    .completion_registration_link_override
                    .as_deref()
                    .is_some_and(|link| !link.trim().is_empty()),
                has_completions: completed_module_ids.contains(&module.id),
                not_yet_registered_count,
                course_code_allowed: config.and_then(|c| c.credit_registration_course_code_allowed),
                credit_registration_paused_at: config.and_then(|c| c.credit_registration_paused_at),
                credit_registration_pause_reason: config
                    .and_then(|c| c.credit_registration_pause_reason.clone()),
                name: module.name,
                uh_course_code: module.uh_course_code,
                ects_credits: module.ects_credits,
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
    let pass_marks = if exams.is_empty() {
        ExamPassMarks::NoExams
    } else if exams
        .iter()
        .any(|exam| !exam.grade_manually && exam.minimum_points_treshold > 0)
    {
        ExamPassMarks::SomeHavePassMark
    } else {
        ExamPassMarks::NoneHavePassMark
    };

    token.authorized_ok(web::Json(CourseCompletionOverview {
        modules,
        exams: CourseExamsOverview {
            count: exams.len(),
            last_ended_at,
            next_starts_at: next.and_then(|exam| exam.starts_at),
            next_ends_at: next.and_then(|exam| exam.ends_at),
            pass_marks,
        },
    }))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("", web::get().to(get_completion_overview));
}
