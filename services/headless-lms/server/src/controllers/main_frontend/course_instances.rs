//! Controllers for requests starting with `/api/v0/main-frontend/course-instances`.

use std::collections::HashMap;

use chrono::Utc;
use itertools::Itertools;
use models::{
    course_instances::{self, CourseInstance, CourseInstanceForm, Points},
    courses,
    email_templates::{EmailTemplate, EmailTemplateNew},
    exercises::ExerciseStatusSummaryForUser,
    library::{
        self,
        progressing::{
            CourseInstanceCompletionSummary, ManualCompletionPreview,
            TeacherManualCompletionRequest,
        },
    },
    user_exercise_states::{CourseInstanceOrExamId},
};

use crate::{
    domain::csv_export::{
        course_instance_export::CompletionsExportOperation, general_export,
        points::PointExportOperation,
    },
    prelude::*,
};

/**
GET /course-instances/:id
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_course_instance(
    course_instance_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<CourseInstance>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let course_instance =
        models::course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    token.authorized_ok(web::Json(course_instance))
}

#[generated_doc]
#[instrument(skip(payload, pool))]
async fn post_new_email_template(
    course_instance_id: web::Path<Uuid>,
    payload: web::Json<EmailTemplateNew>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<EmailTemplate>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let new_email_template = payload.0;
    let email_template = models::email_templates::insert_email_template(
        &mut conn,
        *course_instance_id,
        new_email_template,
        None,
    )
    .await?;
    token.authorized_ok(web::Json(email_template))
}

/**
POST `/api/v0/main-frontend/course-instances/{course_instance_id}/reprocess-completions`

Reprocesses all module completions for the given course instance. Only available to admins.
*/
#[generated_doc]
#[instrument(skip(pool, user))]
async fn post_reprocess_module_completions(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_instance_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;
    models::library::progressing::process_all_course_instance_completions(
        &mut conn,
        *course_instance_id,
    )
    .await?;
    token.authorized_ok(web::Json(true))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn get_email_templates_by_course_instance_id(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<EmailTemplate>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;

    let email_templates =
        models::email_templates::get_email_templates(&mut conn, *course_instance_id).await?;
    token.authorized_ok(web::Json(email_templates))
}

/**
GET `/api/v0/main-frontend/course-instances/${courseInstanceId}/export-points` - gets CSV of course instance points based on course_instance ID.
*/
#[instrument(skip(pool))]
pub async fn point_export(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;

    let course_instance =
        course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    let course = courses::get_course(&mut conn, course_instance.course_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"{} - {} - Point export {}.csv\"",
            course.name,
            course_instance.name.as_deref().unwrap_or("unnamed"),
            Utc::now().format("%Y-%m-%d")
        ),
        PointExportOperation {
            course_instance_id: *course_instance_id,
        },
        token,
    )
    .await
}

#[generated_doc]
#[instrument(skip(pool))]
async fn points(
    course_instance_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Points>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let points = course_instances::get_points(&mut conn, *course_instance_id, *pagination).await?;
    token.authorized_ok(web::Json(points))
}

/**
GET `/api/v0/main-frontend/course-instances/{course_instance_id}/completions`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn completions(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseInstanceCompletionSummary>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let course_instance =
        course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    let completions =
        library::progressing::get_course_instance_completion_summary(&mut conn, &course_instance)
            .await?;
    token.authorized_ok(web::Json(completions))
}

/**
POST `/api/v0/main-frontend/course-instances/{course_instance_id}/completions`
*/
#[instrument(skip(pool, payload))]
async fn post_completions(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<TeacherManualCompletionRequest>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let data = payload.0;
    let course_instance =
        course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    library::progressing::add_manual_completions(&mut conn, user.id, &course_instance, &data)
        .await?;
    token.authorized_ok(web::Json(()))
}

#[instrument(skip(pool, payload))]
async fn preview_post_completions(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<TeacherManualCompletionRequest>,
) -> ControllerResult<web::Json<ManualCompletionPreview>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    let data = payload.0;
    let instance = course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    let preview =
        library::progressing::get_manual_completion_result_preview(&mut conn, &instance, &data)
            .await?;
    token.authorized_ok(web::Json(preview))
}

/**
POST /course-instances/:id/edit
*/
#[instrument(skip(pool))]
pub async fn edit(
    update: web::Json<CourseInstanceForm>,
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;
    course_instances::edit(&mut conn, *course_instance_id, update.into_inner()).await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
POST /course-instances/:id/delete
*/
#[instrument(skip(pool))]
async fn delete(
    id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*id),
    )
    .await?;
    models::course_instances::delete(&mut conn, *id).await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
GET /course-instances/:id/export-completions - gets CSV of course completion based on course_instance ID.
*/
#[instrument(skip(pool))]
pub async fn completions_export(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(*course_instance_id),
    )
    .await?;

    let course_instance =
        course_instances::get_course_instance(&mut conn, *course_instance_id).await?;
    let course = courses::get_course(&mut conn, course_instance.course_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"{} - {} - Completions export {}.csv\"",
            course.name,
            course_instance.name.as_deref().unwrap_or("unnamed"),
            Utc::now().format("%Y-%m-%d")
        ),
        CompletionsExportOperation {
            course_instance_id: *course_instance_id,
        },
        token,
    )
    .await
}

/**
GET /course-instances/:id/status-for-all-exercises/:user_id - Returns a status for all exercises in a course instance for a given user.
*/
#[instrument(skip(pool))]
#[generated_doc]
async fn get_all_exercise_statuses_by_course_instance_id(
    params: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseStatusSummaryForUser>>> {
    let (course_instance_id, user_id) = params.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::CourseInstance(course_instance_id),
    )
    .await?;
    let course_instance_or_exam_id =
        CourseInstanceOrExamId::from_instance_and_exam_ids(Some(course_instance_id), None)?;

    // Load all the data for this user from all the exercises to memory, and group most of them to HashMaps by exercise id
    let exercises =
        models::exercises::get_exercises_by_course_instance_id(&mut conn, course_instance_id)
            .await?;
    let mut user_exercise_states =
        models::user_exercise_states::get_all_for_user_and_course_instance_or_exam(
            &mut conn,
            user_id,
            course_instance_or_exam_id,
        )
        .await?
        .into_iter()
        .map(|ues| (ues.exercise_id, ues))
        .collect::<HashMap<_, _>>();
    let mut exercise_slide_submissions =
        models::exercise_slide_submissions::get_users_all_submissions_for_course_instance_or_exam(
            &mut conn,
            user_id,
            course_instance_or_exam_id,
        )
        .await?
        .into_iter()
        .into_group_map_by(|o| o.exercise_id);
    let mut given_peer_review_submissions = models::peer_review_submissions::get_all_given_peer_review_submissions_for_user_and_course_instance(&mut conn, user_id, course_instance_id).await?.into_iter()
        .into_group_map_by(|o| o.exercise_id);
    let mut received_peer_review_submissions = models::peer_review_submissions::get_all_received_peer_review_submissions_for_user_and_course_instance(&mut conn, user_id, course_instance_id).await?.into_iter()
        .into_group_map_by(|o| o.exercise_id);
    let given_peer_review_submission_ids = given_peer_review_submissions
        .values()
        .flatten()
        .map(|x| x.id)
        .collect::<Vec<_>>();
    let mut given_peer_review_question_submissions = models::peer_review_question_submissions::get_question_submissions_from_from_peer_review_submission_ids(&mut conn, &given_peer_review_submission_ids).await?
        .into_iter()
        .into_group_map_by(|o| {
            let peer_review_submission = given_peer_review_submissions.clone().into_iter()
                .find(|(_exercise_id, prs)| prs.iter().any(|p| p.id == o.peer_review_submission_id))
                .unwrap_or_else(|| (Uuid::nil(), vec![]));
            peer_review_submission.0
    });
    let received_peer_review_submission_ids = received_peer_review_submissions
        .values()
        .flatten()
        .map(|x| x.id)
        .collect::<Vec<_>>();
    let mut received_peer_review_question_submissions = models::peer_review_question_submissions::get_question_submissions_from_from_peer_review_submission_ids(&mut conn, &received_peer_review_submission_ids).await?.into_iter()
    .into_group_map_by(|o| {
        let peer_review_submission = received_peer_review_submissions.clone().into_iter()
            .find(|(_exercise_id, prs)| prs.iter().any(|p| p.id == o.peer_review_submission_id))
            .unwrap_or_else(|| (Uuid::nil(), vec![]));
        peer_review_submission.0
    });
    let mut peer_review_queue_entries =
        models::peer_review_queue_entries::get_all_by_user_and_course_instance_ids(
            &mut conn,
            course_instance_id,
            user_id,
        )
        .await?
        .into_iter()
        .map(|x| (x.exercise_id, x))
        .collect::<HashMap<_, _>>();

    // Map all the data for all the exercises to be summaries of the data for each exercise.
    //
    // Since all data is in hashmaps grouped by exercise id, and we iterate though every
    // exercise id exactly once, we can just remove the data for the exercise from the
    // hashmaps and avoid extra copying.
    let res = exercises
        .into_iter()
        .map(|exercise| {
            let user_exercise_state = user_exercise_states.remove(&exercise.id);
            let exercise_slide_submissions = exercise_slide_submissions
                .remove(&exercise.id)
                .unwrap_or_default();
            let given_peer_review_submissions = given_peer_review_submissions
                .remove(&exercise.id)
                .unwrap_or_default();
            let received_peer_review_submissions = received_peer_review_submissions
                .remove(&exercise.id)
                .unwrap_or_default();
            let given_peer_review_question_submissions = given_peer_review_question_submissions
                .remove(&exercise.id)
                .unwrap_or_default();
            let received_peer_review_question_submissions =
                received_peer_review_question_submissions
                    .remove(&exercise.id)
                    .unwrap_or_default();
            let peer_review_queue_entry = peer_review_queue_entries.remove(&exercise.id);
            ExerciseStatusSummaryForUser {
                exercise,
                user_exercise_state,
                exercise_slide_submissions,
                given_peer_review_submissions,
                received_peer_review_submissions,
                given_peer_review_question_submissions,
                received_peer_review_question_submissions,
                peer_review_queue_entry,
            }
        })
        .collect::<Vec<_>>();
    token.authorized_ok(web::Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_instance_id}", web::get().to(get_course_instance))
        .route(
            "/{course_instance_id}/email-templates",
            web::post().to(post_new_email_template),
        )
        .route(
            "/{course_instance_id}/email-templates",
            web::get().to(get_email_templates_by_course_instance_id),
        )
        .route(
            "/{course_instance_id}/export-points",
            web::get().to(point_export),
        )
        .route("/{course_instance_id}/edit", web::post().to(edit))
        .route("/{course_instance_id}/delete", web::post().to(delete))
        .route(
            "/{course_instance_id}/completions",
            web::get().to(completions),
        )
        .route(
            "/{course_instance_id}/export-completions",
            web::get().to(completions_export),
        )
        .route(
            "/{course_instance_id}/completions",
            web::post().to(post_completions),
        )
        .route(
            "/{course_instance_id}/completions/preview",
            web::post().to(preview_post_completions),
        )
        .route("/{course_instance_id}/points", web::get().to(points))
        .route(
            "/{course_instance_id}/status-for-all-exercises/{user_id}",
            web::get().to(get_all_exercise_statuses_by_course_instance_id),
        )
        .route(
            "/{course_instance_id}/reprocess-completions",
            web::post().to(post_reprocess_module_completions),
        );
}
