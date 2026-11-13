use crate::{domain::models_requests, prelude::*};
use headless_lms_models::exercise_slide_submission_shares::{
    ExerciseSlideSubmissionShare, SharedSubmissionInfo,
};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(
    get_shared_submission_info,
    list_own_shares,
    revoke_share,
    revoke_shares_of_submission
))]
pub(crate) struct MainFrontendSharedSubmissionsApiDoc;

/**
GET `/api/v0/main-frontend/shared-submissions/{token}` - Returns the data needed to
render a shared submission or ungraded snapshot.

The `token` is the unguessable share id minted by the client share endpoint. Login is
required, but holding the token is the only capability needed to view the submission —
no teacher or course role.
*/
#[utoipa::path(
    get,
    path = "/{token}",
    operation_id = "getSharedSubmissionInfo",
    tag = "shared_submissions",
    params(
        ("token" = Uuid, Path, description = "Submission share token")
    ),
    responses(
        (status = 200, description = "Data needed to render the shared submission or snapshot", body = SharedSubmissionInfo)
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_shared_submission_info(
    token: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    _user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<SharedSubmissionInfo>> {
    let mut conn = pool.acquire().await?;
    // Possession of the share token is the capability; any logged-in user may view it.
    let auth_token = skip_authorize();

    let share = models::exercise_slide_submission_shares::get_by_id(&mut conn, *token).await?;
    let res = match (
        share.exercise_slide_submission_id,
        share.exercise_answer_snapshot_id,
    ) {
        (Some(submission_id), _) => {
            let submission =
                models::exercise_slide_submissions::get_by_id(&mut conn, submission_id).await?;
            let mut info = models::exercise_slide_submissions::get_exercise_slide_submission_info(
                &mut conn,
                submission_id,
                submission.user_id,
                models_requests::fetch_service_info,
                true,
                file_store.as_ref(),
                app_conf.as_ref(),
            )
            .await?;
            // A forwardable share link must never leak the model solution or the submitter's
            // user id; see `strip_for_shared_view`.
            info.strip_for_shared_view();
            SharedSubmissionInfo {
                exercise_page_url: exercise_page_url(&mut conn, &info.exercise, &app_conf.base_url)
                    .await?,
                exercise: info.exercise,
                tasks: info.tasks,
                created_at: info.exercise_slide_submission.created_at,
                is_graded: true,
            }
        }
        (None, Some(snapshot_id)) => {
            let snapshot =
                models::exercise_answer_snapshots::get_by_id(&mut conn, snapshot_id).await?;
            let task = models::exercise_answer_snapshots::get_shared_view_task(
                &mut conn,
                &snapshot,
                models_requests::fetch_service_info,
                file_store.as_ref(),
                app_conf.as_ref(),
            )
            .await?;
            let exercise = models::exercises::get_by_id(&mut conn, snapshot.exercise_id).await?;
            SharedSubmissionInfo {
                exercise_page_url: exercise_page_url(&mut conn, &exercise, &app_conf.base_url)
                    .await?,
                exercise,
                tasks: vec![task],
                created_at: snapshot.created_at,
                is_graded: false,
            }
        }
        (None, None) => {
            return Err(controller_err!(
                InternalServerError,
                "The share links to nothing".to_string()
            ));
        }
    };

    auth_token.authorized_ok(web::Json(res))
}

/// The course material page the exercise is on, or `None` for an exam exercise.
async fn exercise_page_url(
    conn: &mut PgConnection,
    exercise: &models::exercises::Exercise,
    base_url: &str,
) -> ModelResult<Option<String>> {
    let Some(course_id) = exercise.course_id else {
        return Ok(None);
    };
    let course = models::courses::get_course(conn, course_id).await?;
    let organization =
        models::organizations::get_organization(conn, course.organization_id).await?;
    let page = models::pages::get_page(conn, exercise.page_id).await?;
    Ok(headless_lms_utils::course_url::course_page_url(
        base_url,
        &organization.slug,
        &course.slug,
        &page.url_path,
    ))
}

/**
GET `/api/v0/main-frontend/shared-submissions` - Lists the shares the current user has minted,
newest first, so they can be reviewed and withdrawn.
*/
#[utoipa::path(
    get,
    path = "",
    operation_id = "listOwnSubmissionShares",
    tag = "shared_submissions",
    responses(
        (status = 200, description = "The caller's live shares, newest first", body = Vec<ExerciseSlideSubmissionShare>)
    )
)]
#[instrument(skip(pool))]
async fn list_own_shares(
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseSlideSubmissionShare>>> {
    let mut conn = pool.acquire().await?;
    // Scoped to the caller's own shares, so no further authorization is needed.
    let auth_token = skip_authorize();
    let shares =
        models::exercise_slide_submission_shares::list_by_creator(&mut conn, user.id).await?;
    auth_token.authorized_ok(web::Json(shares))
}

/**
DELETE `/api/v0/main-frontend/shared-submissions/{token}` - Withdraws one share, after which the
link stops resolving.

Only the share's creator may revoke it: holding the token is authority to view, not to withdraw.
Revoking an unknown or already-revoked share is a no-op, reported as `false`.
*/
#[utoipa::path(
    delete,
    path = "/{token}",
    operation_id = "revokeSubmissionShare",
    tag = "shared_submissions",
    params(
        ("token" = Uuid, Path, description = "Submission share token")
    ),
    responses(
        (status = 200, description = "Whether a live share was withdrawn", body = bool)
    )
)]
#[instrument(skip(pool))]
async fn revoke_share(
    token: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    // The `created_by` filter in the query is the authorization check.
    let auth_token = skip_authorize();
    let revoked =
        models::exercise_slide_submission_shares::revoke(&mut conn, *token, user.id).await?;
    auth_token.authorized_ok(web::Json(revoked))
}

/**
DELETE `/api/v0/main-frontend/shared-submissions/of-submission/{submission_id}` - Withdraws every
share the current user has minted for one submission or snapshot.
*/
#[utoipa::path(
    delete,
    path = "/of-submission/{submission_id}",
    operation_id = "revokeSubmissionSharesOfSubmission",
    tag = "shared_submissions",
    params(
        ("submission_id" = Uuid, Path, description = "Exercise slide submission or snapshot id")
    ),
    responses(
        (status = 200, description = "How many shares were withdrawn", body = i64)
    )
)]
#[instrument(skip(pool))]
async fn revoke_shares_of_submission(
    submission_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<i64>> {
    let mut conn = pool.acquire().await?;
    // The `created_by` filter in the query is the authorization check.
    let auth_token = skip_authorize();
    let revoked = models::exercise_slide_submission_shares::revoke_all_for_submission(
        &mut conn,
        *submission_id,
        user.id,
    )
    .await?;
    auth_token.authorized_ok(web::Json(revoked as i64))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(list_own_shares))
        .route(
            "/of-submission/{submission_id}",
            web::delete().to(revoke_shares_of_submission),
        )
        .route("/{token}", web::get().to(get_shared_submission_info))
        .route("/{token}", web::delete().to(revoke_share));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;

    #[actix_web::test]
    async fn the_page_url_names_the_exercises_material_page() {
        insert_data!(:tx, :user, org: org, course: course, instance: _instance, :course_module, :chapter, page: page, exercise: exercise);
        let exercise = models::exercises::get_by_id(tx.as_mut(), exercise)
            .await
            .unwrap();
        let organization = models::organizations::get_organization(tx.as_mut(), org)
            .await
            .unwrap();
        let course = models::courses::get_course(tx.as_mut(), course)
            .await
            .unwrap();
        let page = models::pages::get_page(tx.as_mut(), page).await.unwrap();
        let url = exercise_page_url(tx.as_mut(), &exercise, "http://project-331.local")
            .await
            .unwrap();
        assert_eq!(
            url,
            Some(format!(
                "http://project-331.local/org/{}/courses/{}{}",
                organization.slug, course.slug, page.url_path
            ))
        );
    }
}
