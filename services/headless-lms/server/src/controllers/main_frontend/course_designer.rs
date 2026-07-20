/*!
Handlers for HTTP requests to `/api/v0/main-frontend/course-plans`.
*/

use actix_web::HttpResponse;
use chrono::NaiveDate;
use models::course_designer_analysis_workspace::CourseDesignerStageWorkspace;
use models::course_designer_plans::{
    CourseDesignerCourseSize, CourseDesignerPlan, CourseDesignerPlanDetails,
    CourseDesignerPlanStageTask, CourseDesignerPlanSummary, CourseDesignerScheduleStageInput,
    CourseDesignerStage, PlanMemberWithDetails,
};
use utoipa::{OpenApi, ToSchema};

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
    delete_plan_member
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct UpdateCourseDesignerStageTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub is_completed: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
pub struct ExtendStageRequest {
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

fn parse_stage(path_stage: &str) -> Option<CourseDesignerStage> {
    match path_stage.to_lowercase().as_str() {
        "analysis" => Some(CourseDesignerStage::Analysis),
        "design" => Some(CourseDesignerStage::Design),
        "development" => Some(CourseDesignerStage::Development),
        "implementation" => Some(CourseDesignerStage::Implementation),
        "evaluation" => Some(CourseDesignerStage::Evaluation),
        _ => None,
    }
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
    let stage = parse_stage(&stage_str).ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "Invalid stage name.".to_string(),
            None,
        )
    })?;
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
    request_body = CourseDesignerStageWorkspace,
    responses((status = 200, description = "Updated plan details", body = CourseDesignerPlanDetails))
)]
async fn patch_stage_workspace(
    path: web::Path<(Uuid, String)>,
    payload: web::Json<CourseDesignerStageWorkspace>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanDetails>> {
    let (plan_id, stage_str) = path.into_inner();
    let stage = parse_stage(&stage_str).ok_or_else(|| {
        ControllerError::new(
            ControllerErrorType::BadRequest,
            "Invalid stage name.".to_string(),
            None,
        )
    })?;
    let mut conn = pool.acquire().await?;
    let details = models::course_designer_plans::update_stage_workspace_for_user(
        &mut conn,
        plan_id,
        user.id,
        stage,
        payload.into_inner(),
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

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::post().to(post_new_plan))
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
        );
}
