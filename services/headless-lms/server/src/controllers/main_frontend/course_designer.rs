/*!
Handlers for HTTP requests to `/api/v0/main-frontend/course-plans`.
*/

use chrono::NaiveDate;
use models::course_designer_plans::{
    CourseDesignerCourseSize, CourseDesignerPlan, CourseDesignerPlanDetails,
    CourseDesignerPlanSummary, CourseDesignerScheduleStageInput,
};

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CreateCourseDesignerPlanRequest {
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseDesignerScheduleSuggestionRequest {
    pub course_size: CourseDesignerCourseSize,
    pub starts_on: NaiveDate,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CourseDesignerScheduleSuggestionResponse {
    pub stages: Vec<CourseDesignerScheduleStageInput>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct SaveCourseDesignerScheduleRequest {
    pub name: Option<String>,
    pub stages: Vec<CourseDesignerScheduleStageInput>,
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
async fn post_new_plan(
    payload: web::Json<CreateCourseDesignerPlanRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlan>> {
    let mut conn = pool.acquire().await?;
    let plan = models::course_designer_plans::create_plan(
        &mut conn,
        user.id,
        sanitize_optional_name(payload.name.clone()),
    )
    .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(plan))
}

#[instrument(skip(pool))]
async fn get_plans(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseDesignerPlanSummary>>> {
    let mut conn = pool.acquire().await?;
    let plans = models::course_designer_plans::list_plans_for_user(&mut conn, user.id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(plans))
}

#[instrument(skip(pool))]
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
async fn post_schedule_suggestion(
    plan_id: web::Path<Uuid>,
    payload: web::Json<CourseDesignerScheduleSuggestionRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerScheduleSuggestionResponse>> {
    let mut conn = pool.acquire().await?;
    // Membership check by fetching the plan; suggestions are only available to plan members.
    models::course_designer_plans::get_plan_for_user(&mut conn, *plan_id, user.id).await?;
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
async fn put_schedule(
    plan_id: web::Path<Uuid>,
    payload: web::Json<SaveCourseDesignerScheduleRequest>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlanDetails>> {
    models::course_designer_plans::validate_schedule_input(&payload.stages)?;
    let mut conn = pool.acquire().await?;
    let details = models::course_designer_plans::replace_schedule_for_user(
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
async fn post_finalize_schedule(
    plan_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseDesignerPlan>> {
    let mut conn = pool.acquire().await?;
    let plan =
        models::course_designer_plans::finalize_schedule_for_user(&mut conn, *plan_id, user.id)
            .await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(plan))
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
        );
}
