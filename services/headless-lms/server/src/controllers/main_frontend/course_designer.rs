/*!
Handlers for HTTP requests to `/api/v0/main-frontend/course-plans`.
*/

use std::sync::Arc;

use actix_web::HttpResponse;
use chrono::NaiveDate;
use models::course_designer_plans::{
    CourseDesignerCourseSize, CourseDesignerPlan, CourseDesignerPlanDetails,
    CourseDesignerPlanMember, CourseDesignerPlanStageTask, CourseDesignerPlanSummary,
    CourseDesignerScheduleStageInput, CourseDesignerStage, CourseDesignerSupportPlan,
    PlanMemberWithDetails,
};
use models::course_designer_section_statuses::{
    CourseDesignerPlanSectionStatus, CourseDesignerSectionStatus,
};
use models::course_designer_stage_workspace::CourseDesignerStageWorkspace;
use models::courses::Course;
use models::library::course_designer::CourseFromPlanOptions;
use utoipa::{OpenApi, ToSchema};

use crate::domain::models_requests::{self, JwtKey};
use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(
    post_new_plan,
    get_plans,
    get_plan,
    post_schedule_suggestion,
    put_schedule,
    post_finalize_schedule,
    post_stage_task,
    patch_task,
    delete_task,
    post_extend_stage,
    post_advance_stage,
    patch_stage_workspace,
    get_plan_members,
    post_plan_member,
    delete_plan_member,
    put_great_mooc_vision,
    get_section_statuses,
    put_section_status,
    get_support_plans,
    put_task_assignee,
    put_schedule_adjustment,
    post_archive_plan,
    post_unarchive_plan,
    put_weekly_digest_subscription,
    post_create_course_from_plan
))]
pub(crate) struct MainFrontendCourseDesignerApiDoc;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct CreateCourseDesignerPlanRequest {
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct CourseDesignerScheduleSuggestionRequest {
    pub course_size: CourseDesignerCourseSize,
    pub starts_on: NaiveDate,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct CourseDesignerScheduleSuggestionResponse {
    pub stages: Vec<CourseDesignerScheduleStageInput>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct SaveCourseDesignerScheduleRequest {
    pub name: Option<String>,
    pub stages: Vec<CourseDesignerScheduleStageInput>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct CreateCourseDesignerStageTaskRequest {
    pub title: String,
    pub description: Option<String>,
}

/// Fields left out stay unchanged. An empty `description` clears it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct UpdateCourseDesignerStageTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub is_completed: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct UpdateCourseDesignerStageWorkspaceRequest {
    pub workspace: CourseDesignerStageWorkspace,
    /// The stage's `workspace_revision` the edit started from. A save based on an older revision
    /// is refused with `stale_version`.
    pub base_revision: i32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct SetCourseDesignerTaskAssigneeRequest {
    /// A current plan member, or `null` to unassign.
    pub assignee_user_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct SetGreatMoocVisionRequest {
    /// Blank or `null` clears the vision.
    pub great_mooc_vision: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct SetCourseDesignerSectionStatusRequest {
    pub stage: CourseDesignerStage,
    /// Stable key defined by the frontend form, e.g. `design.learning_goals`. At most 255 characters.
    pub section_key: String,
    pub status: CourseDesignerSectionStatus,
    /// Blank or `null` stores no comment.
    pub comment: Option<String>,
}

/// The whole schedule in stage order. Completed stages must keep their dates, and later stages
/// must already be shifted so there are no gaps or overlaps.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct AdjustCourseDesignerScheduleRequest {
    pub stages: Vec<CourseDesignerScheduleStageInput>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct SetWeeklyDigestSubscriptionRequest {
    pub receives_weekly_digest: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct CreateCourseFromPlanRequest {
    /// An organization the user may create courses in.
    pub organization_id: Uuid,
    /// Defaults to the Analysis form's course title, then the plan name.
    pub name: Option<String>,
    /// Defaults to the Analysis form's language when it reads as one, else English.
    pub language_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct ExtendStageRequest {
    /// 1 to 24.
    pub months: u32,
}

fn sanitize_optional_name(name: Option<String>) -> Option<String> {
    name.and_then(|n| {
        let trimmed = n.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "",
    operation_id = "createCourseDesignerPlan",
    tag = "course-plans",
    request_body = CreateCourseDesignerPlanRequest,
    responses((status = 200, description = "Created plan", body = CourseDesignerPlan))
)]
async fn post_new_plan(
    payload: web::Json<CreateCourseDesignerPlanRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlan>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::CreateCoursesOrExams,
        Some(user.id),
        Res::AnyCourse,
    )
    .await?;
    let plan = models::course_designer_plans::create_plan(
        &mut conn,
        user.id,
        sanitize_optional_name(payload.name.clone()),
    )
    .await?;
    token.authorized_ok(web::Json(plan))
}

#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "",
    operation_id = "getCourseDesignerPlans",
    tag = "course-plans",
    responses((status = 200, description = "Plans", body = [CourseDesignerPlanSummary]))
)]
async fn get_plans(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseDesignerPlanSummary>>> {
    let mut conn = pool.acquire().await?;
    let plans =
        models::course_designer_plan_members::list_plans_for_user(&mut conn, user.id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(plans))
}

#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{plan_id}",
    operation_id = "getCourseDesignerPlan",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    responses((status = 200, description = "Plan details", body = CourseDesignerPlanDetails))
)]
async fn get_plan(
    plan_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanDetails>> {
    let mut conn = pool.acquire().await?;
    let plan =
        models::course_designer_plans::get_plan_details_for_user(&mut conn, *plan_id, user.id)
            .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(plan))
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/{plan_id}/schedule/suggestions",
    operation_id = "createCourseDesignerScheduleSuggestion",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    request_body = CourseDesignerScheduleSuggestionRequest,
    responses((status = 200, description = "Suggested schedule", body = CourseDesignerScheduleSuggestionResponse))
)]
async fn post_schedule_suggestion(
    plan_id: web::Path<Uuid>,
    payload: web::Json<CourseDesignerScheduleSuggestionRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerScheduleSuggestionResponse>> {
    let mut conn = pool.acquire().await?;
    // Membership check by fetching the plan; suggestions are only available to plan members.
    models::course_designer_plan_members::get_plan_for_user(&mut conn, *plan_id, user.id).await?;
    let stages = models::course_designer_plans::build_schedule_suggestion(
        payload.course_size,
        payload.starts_on,
    )?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(CourseDesignerScheduleSuggestionResponse {
        stages,
    }))
}

#[instrument(skip(pool))]
#[utoipa::path(
    put,
    path = "/{plan_id}/schedule",
    operation_id = "saveCourseDesignerSchedule",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    request_body = SaveCourseDesignerScheduleRequest,
    responses((status = 200, description = "Updated plan details", body = CourseDesignerPlanDetails))
)]
async fn put_schedule(
    plan_id: web::Path<Uuid>,
    payload: web::Json<SaveCourseDesignerScheduleRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanDetails>> {
    models::course_designer_plans::validate_schedule_input(&payload.stages)?;
    let mut conn = pool.acquire().await?;
    let details = models::course_designer_plan_members::replace_schedule_for_user(
        &mut conn,
        *plan_id,
        user.id,
        sanitize_optional_name(payload.name.clone()),
        &payload.stages,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(details))
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/{plan_id}/schedule/finalize",
    operation_id = "finalizeCourseDesignerSchedule",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    responses((status = 200, description = "Finalized plan", body = CourseDesignerPlan))
)]
async fn post_finalize_schedule(
    plan_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlan>> {
    let mut conn = pool.acquire().await?;
    let plan = models::course_designer_plan_members::finalize_schedule_for_user(
        &mut conn, *plan_id, user.id,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(plan))
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/{plan_id}/stages/{stage_id}/tasks",
    operation_id = "createCourseDesignerStageTask",
    tag = "course-plans",
    params(
        ("plan_id" = Uuid, Path, description = "Plan id"),
        ("stage_id" = Uuid, Path, description = "Stage id")
    ),
    request_body = CreateCourseDesignerStageTaskRequest,
    responses((status = 200, description = "Created task", body = CourseDesignerPlanStageTask))
)]
async fn post_stage_task(
    path: web::Path<(Uuid, Uuid)>,
    payload: web::Json<CreateCourseDesignerStageTaskRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanStageTask>> {
    let (plan_id, stage_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let task = models::course_designer_plan_members::create_stage_task_for_user(
        &mut conn,
        plan_id,
        stage_id,
        user.id,
        payload.title.clone(),
        payload.description.clone(),
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(task))
}

#[instrument(skip(pool))]
#[utoipa::path(
    patch,
    path = "/{plan_id}/tasks/{task_id}",
    operation_id = "updateCourseDesignerStageTask",
    tag = "course-plans",
    params(
        ("plan_id" = Uuid, Path, description = "Plan id"),
        ("task_id" = Uuid, Path, description = "Task id")
    ),
    request_body = UpdateCourseDesignerStageTaskRequest,
    responses((status = 200, description = "Updated task", body = CourseDesignerPlanStageTask))
)]
async fn patch_task(
    path: web::Path<(Uuid, Uuid)>,
    payload: web::Json<UpdateCourseDesignerStageTaskRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanStageTask>> {
    let (plan_id, task_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let task = models::course_designer_plan_members::update_stage_task_for_user(
        &mut conn,
        plan_id,
        task_id,
        user.id,
        payload.title.clone(),
        payload.description.clone(),
        payload.is_completed,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(task))
}

#[instrument(skip(pool))]
#[utoipa::path(
    delete,
    path = "/{plan_id}/tasks/{task_id}",
    operation_id = "deleteCourseDesignerStageTask",
    tag = "course-plans",
    params(
        ("plan_id" = Uuid, Path, description = "Plan id"),
        ("task_id" = Uuid, Path, description = "Task id")
    ),
    responses((status = 204, description = "Task deleted"))
)]
async fn delete_task(
    path: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let (plan_id, task_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    models::course_designer_plan_members::delete_stage_task_for_user(
        &mut conn, plan_id, task_id, user.id,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(HttpResponse::NoContent().finish())
}

fn parse_stage(path_stage: &str) -> Result<CourseDesignerStage, ControllerError> {
    path_stage.to_lowercase().parse().map_err(|_| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "Invalid stage name.".to_string(),
            None,
        )
    })
}
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/{plan_id}/stages/{stage}/extend",
    operation_id = "extendCourseDesignerStage",
    tag = "course-plans",
    params(
        ("plan_id" = Uuid, Path, description = "Plan id"),
        ("stage" = String, Path, description = "Stage name")
    ),
    request_body = ExtendStageRequest,
    responses((status = 200, description = "Updated plan details", body = CourseDesignerPlanDetails))
)]
async fn post_extend_stage(
    path: web::Path<(Uuid, String)>,
    payload: web::Json<ExtendStageRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanDetails>> {
    let (plan_id, stage_str) = path.into_inner();
    let stage = parse_stage(&stage_str)?;
    let mut conn = pool.acquire().await?;
    let details = models::course_designer_plan_members::extend_stage_for_user(
        &mut conn,
        plan_id,
        stage,
        payload.months,
        user.id,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(details))
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/{plan_id}/stages/advance",
    operation_id = "advanceCourseDesignerStage",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    responses((status = 200, description = "Updated plan details", body = CourseDesignerPlanDetails))
)]
async fn post_advance_stage(
    plan_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanDetails>> {
    let mut conn = pool.acquire().await?;
    let details = models::course_designer_plan_members::advance_to_next_stage_for_user(
        &mut conn, *plan_id, user.id,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(details))
}

#[instrument(skip(pool))]
#[utoipa::path(
    patch,
    path = "/{plan_id}/stages/{stage}/workspace",
    operation_id = "updateCourseDesignerStageWorkspace",
    tag = "course-plans",
    params(
        ("plan_id" = Uuid, Path, description = "Plan id"),
        ("stage" = String, Path, description = "Stage name")
    ),
    request_body = UpdateCourseDesignerStageWorkspaceRequest,
    responses((status = 200, description = "Updated plan details", body = CourseDesignerPlanDetails))
)]
async fn patch_stage_workspace(
    path: web::Path<(Uuid, String)>,
    payload: web::Json<UpdateCourseDesignerStageWorkspaceRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanDetails>> {
    let (plan_id, stage_str) = path.into_inner();
    let stage = parse_stage(&stage_str)?;
    let UpdateCourseDesignerStageWorkspaceRequest {
        workspace,
        base_revision,
    } = payload.into_inner();
    let mut conn = pool.acquire().await?;
    let details = models::course_designer_plans::update_stage_workspace_for_user(
        &mut conn,
        plan_id,
        user.id,
        stage,
        workspace,
        base_revision,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(details))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct AddPlanMemberRequest {
    #[schema(value_type = String, format = Email)]
    pub email: String,
}

#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{plan_id}/members",
    operation_id = "getCoursePlanMembers",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    responses((status = 200, description = "Plan members", body = [PlanMemberWithDetails]))
)]
async fn get_plan_members(
    plan_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PlanMemberWithDetails>>> {
    let mut conn = pool.acquire().await?;
    let members = models::course_designer_plan_members::get_plan_members_with_details(
        &mut conn, *plan_id, user.id,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(members))
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/{plan_id}/members",
    operation_id = "addCoursePlanMember",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    request_body = AddPlanMemberRequest,
    responses((status = 200, description = "Added member", body = PlanMemberWithDetails))
)]
async fn post_plan_member(
    plan_id: web::Path<Uuid>,
    payload: web::Json<AddPlanMemberRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<PlanMemberWithDetails>> {
    let mut conn = pool.acquire().await?;
    let member = models::course_designer_plan_members::add_plan_member_by_email(
        &mut conn,
        *plan_id,
        user.id,
        &payload.email,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(member))
}

#[instrument(skip(pool))]
#[utoipa::path(
    delete,
    path = "/{plan_id}/members/{user_id}",
    operation_id = "removeCoursePlanMember",
    tag = "course-plans",
    params(
        ("plan_id" = Uuid, Path, description = "Plan id"),
        ("user_id" = Uuid, Path, description = "User id to remove")
    ),
    responses((status = 204, description = "Member removed"))
)]
async fn delete_plan_member(
    path: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let (plan_id, target_user_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    models::course_designer_plan_members::remove_plan_member(
        &mut conn,
        plan_id,
        user.id,
        target_user_id,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(HttpResponse::NoContent().finish())
}

#[instrument(skip(pool))]
#[utoipa::path(
    put,
    path = "/{plan_id}/vision",
    operation_id = "setCourseDesignerGreatMoocVision",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    request_body = SetGreatMoocVisionRequest,
    responses((status = 200, description = "Updated plan", body = CourseDesignerPlan))
)]
async fn put_great_mooc_vision(
    plan_id: web::Path<Uuid>,
    payload: web::Json<SetGreatMoocVisionRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlan>> {
    let mut conn = pool.acquire().await?;
    let plan = models::course_designer_plans::set_great_mooc_vision_for_user(
        &mut conn,
        *plan_id,
        user.id,
        payload.into_inner().great_mooc_vision,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(plan))
}

#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/{plan_id}/section-statuses",
    operation_id = "getCourseDesignerSectionStatuses",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    responses((status = 200, description = "Section statuses", body = [CourseDesignerPlanSectionStatus]))
)]
async fn get_section_statuses(
    plan_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseDesignerPlanSectionStatus>>> {
    let mut conn = pool.acquire().await?;
    models::course_designer_plan_members::get_plan_for_user(&mut conn, *plan_id, user.id).await?;
    let statuses =
        models::course_designer_section_statuses::get_for_plan(&mut conn, *plan_id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(statuses))
}

#[instrument(skip(pool))]
#[utoipa::path(
    put,
    path = "/{plan_id}/section-statuses",
    operation_id = "setCourseDesignerSectionStatus",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    request_body = SetCourseDesignerSectionStatusRequest,
    responses((status = 200, description = "Saved section status", body = CourseDesignerPlanSectionStatus))
)]
async fn put_section_status(
    plan_id: web::Path<Uuid>,
    payload: web::Json<SetCourseDesignerSectionStatusRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanSectionStatus>> {
    let mut conn = pool.acquire().await?;
    let payload = payload.into_inner();
    let status = models::course_designer_section_statuses::upsert_for_user(
        &mut conn,
        *plan_id,
        user.id,
        payload.stage,
        &payload.section_key,
        payload.status,
        payload.comment,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(status))
}

/// Read-only overview of every plan for global admins doing MOOC support.
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/support/plans",
    operation_id = "getCourseDesignerSupportPlans",
    tag = "course-plans",
    responses((status = 200, description = "All plans", body = [CourseDesignerSupportPlan]))
)]
async fn get_support_plans(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseDesignerSupportPlan>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;
    let plans = models::course_designer_plans::list_plans_for_support(&mut conn).await?;
    token.authorized_ok(web::Json(plans))
}

#[instrument(skip(pool))]
#[utoipa::path(
    put,
    path = "/{plan_id}/tasks/{task_id}/assignee",
    operation_id = "setCourseDesignerTaskAssignee",
    tag = "course-plans",
    params(
        ("plan_id" = Uuid, Path, description = "Plan id"),
        ("task_id" = Uuid, Path, description = "Task id")
    ),
    request_body = SetCourseDesignerTaskAssigneeRequest,
    responses((status = 200, description = "Updated task", body = CourseDesignerPlanStageTask))
)]
async fn put_task_assignee(
    path: web::Path<(Uuid, Uuid)>,
    payload: web::Json<SetCourseDesignerTaskAssigneeRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanStageTask>> {
    let (plan_id, task_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let task = models::course_designer_plan_members::set_task_assignee_for_user(
        &mut conn,
        plan_id,
        task_id,
        user.id,
        payload.assignee_user_id,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(task))
}

/// Changes the dates of stages that are not completed while the plan is in progress.
#[instrument(skip(pool))]
#[utoipa::path(
    put,
    path = "/{plan_id}/schedule/adjustment",
    operation_id = "adjustCourseDesignerSchedule",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    request_body = AdjustCourseDesignerScheduleRequest,
    responses((status = 200, description = "Updated plan details", body = CourseDesignerPlanDetails))
)]
async fn put_schedule_adjustment(
    plan_id: web::Path<Uuid>,
    payload: web::Json<AdjustCourseDesignerScheduleRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanDetails>> {
    let mut conn = pool.acquire().await?;
    let details = models::course_designer_plan_members::adjust_schedule_for_user(
        &mut conn,
        *plan_id,
        user.id,
        &payload.stages,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(details))
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/{plan_id}/archive",
    operation_id = "archiveCourseDesignerPlan",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    responses((status = 200, description = "Archived plan", body = CourseDesignerPlan))
)]
async fn post_archive_plan(
    plan_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlan>> {
    let mut conn = pool.acquire().await?;
    let plan =
        models::course_designer_plans::set_archived_for_user(&mut conn, *plan_id, user.id, true)
            .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(plan))
}

#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/{plan_id}/unarchive",
    operation_id = "unarchiveCourseDesignerPlan",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    responses((status = 200, description = "Restored plan", body = CourseDesignerPlan))
)]
async fn post_unarchive_plan(
    plan_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlan>> {
    let mut conn = pool.acquire().await?;
    let plan =
        models::course_designer_plans::set_archived_for_user(&mut conn, *plan_id, user.id, false)
            .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(plan))
}

/// Opts the current user in or out of the plan's weekly progress email.
#[instrument(skip(pool))]
#[utoipa::path(
    put,
    path = "/{plan_id}/weekly-digest-subscription",
    operation_id = "setCourseDesignerWeeklyDigestSubscription",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    request_body = SetWeeklyDigestSubscriptionRequest,
    responses((status = 200, description = "Updated membership", body = CourseDesignerPlanMember))
)]
async fn put_weekly_digest_subscription(
    plan_id: web::Path<Uuid>,
    payload: web::Json<SetWeeklyDigestSubscriptionRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanMember>> {
    let mut conn = pool.acquire().await?;
    let member = models::course_designer_plan_members::set_receives_weekly_digest_for_user(
        &mut conn,
        *plan_id,
        user.id,
        payload.receives_weekly_digest,
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(member))
}

/// Creates a draft course from the plan's course structure. A plan creates at most one course.
#[instrument(skip(pool, app_conf, jwt_key))]
#[utoipa::path(
    post,
    path = "/{plan_id}/course",
    operation_id = "createCourseFromCourseDesignerPlan",
    tag = "course-plans",
    params(("plan_id" = Uuid, Path, description = "Plan id")),
    request_body = CreateCourseFromPlanRequest,
    responses((status = 200, description = "Created course", body = Course))
)]
async fn post_create_course_from_plan(
    request_id: RequestId,
    plan_id: web::Path<Uuid>,
    payload: web::Json<CreateCourseFromPlanRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    let payload = payload.into_inner();
    let token = authorize(
        &mut conn,
        Act::CreateCoursesOrExams,
        Some(user.id),
        Res::Organization(payload.organization_id),
    )
    .await?;
    let course = models::library::course_designer::create_course_from_plan(
        &mut conn,
        app_conf.as_ref(),
        *plan_id,
        user.id,
        CourseFromPlanOptions {
            organization_id: payload.organization_id,
            name: payload.name,
            language_code: payload.language_code,
        },
        models_requests::make_spec_fetcher(
            app_conf.base_url.clone(),
            request_id.0,
            Arc::clone(&jwt_key),
        ),
        models_requests::fetch_service_info,
    )
    .await?;
    token.authorized_ok(web::Json(course))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/support/plans", web::get().to(get_support_plans))
        .route("", web::post().to(post_new_plan))
        .route("", web::get().to(get_plans))
        .route("/{plan_id}", web::get().to(get_plan))
        .route(
            "/{plan_id}/schedule/suggestions",
            web::post().to(post_schedule_suggestion),
        )
        .route("/{plan_id}/schedule", web::put().to(put_schedule))
        .route(
            "/{plan_id}/schedule/finalize",
            web::post().to(post_finalize_schedule),
        )
        .route(
            "/{plan_id}/stages/advance",
            web::post().to(post_advance_stage),
        )
        .route(
            "/{plan_id}/stages/{stage}/extend",
            web::post().to(post_extend_stage),
        )
        .route(
            "/{plan_id}/stages/{stage}/workspace",
            web::patch().to(patch_stage_workspace),
        )
        .route(
            "/{plan_id}/stages/{stage_id}/tasks",
            web::post().to(post_stage_task),
        )
        .route("/{plan_id}/tasks/{task_id}", web::patch().to(patch_task))
        .route("/{plan_id}/tasks/{task_id}", web::delete().to(delete_task))
        .route("/{plan_id}/members", web::get().to(get_plan_members))
        .route("/{plan_id}/members", web::post().to(post_plan_member))
        .route(
            "/{plan_id}/members/{user_id}",
            web::delete().to(delete_plan_member),
        )
        .route("/{plan_id}/vision", web::put().to(put_great_mooc_vision))
        .route(
            "/{plan_id}/section-statuses",
            web::get().to(get_section_statuses),
        )
        .route(
            "/{plan_id}/section-statuses",
            web::put().to(put_section_status),
        )
        .route(
            "/{plan_id}/tasks/{task_id}/assignee",
            web::put().to(put_task_assignee),
        )
        .route(
            "/{plan_id}/schedule/adjustment",
            web::put().to(put_schedule_adjustment),
        )
        .route("/{plan_id}/archive", web::post().to(post_archive_plan))
        .route("/{plan_id}/unarchive", web::post().to(post_unarchive_plan))
        .route(
            "/{plan_id}/weekly-digest-subscription",
            web::put().to(put_weekly_digest_subscription),
        )
        .route(
            "/{plan_id}/course",
            web::post().to(post_create_course_from_plan),
        );
}
