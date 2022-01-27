//! Controllers for requests starting with `/api/v0/main-frontend/exercises`.

use futures::future;
use models::exercise_slide_submissions::ExerciseSlideSubmission;

use crate::controllers::prelude::*;

#[derive(Debug, Serialize, TS)]
pub struct ExerciseSubmissions {
    pub data: Vec<ExerciseSlideSubmission>,
    pub total_pages: u32,
}

/**
GET `/api/v0/main-frontend/exercises/:exercise_id/submissions` - Returns an exercise's submissions.
 */
#[generated_doc(ExerciseSubmissions)]
#[instrument(skip(pool))]
async fn get_exercise_submissions(
    pool: web::Data<PgPool>,
    exercise_id: web::Path<Uuid>,
    pagination: web::Query<Pagination>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExerciseSubmissions>> {
    let mut conn = pool.acquire().await?;
    let submission_count =
        models::exercise_task_submissions::exercise_submission_count(&mut conn, *exercise_id);
    let mut conn = pool.acquire().await?;
    let course_id = models::exercises::get_course_id(&mut conn, *exercise_id).await?;
    authorize(&mut conn, Act::View, user.id, Res::Course(course_id)).await?;
    let submissions = models::exercise_slide_submissions::get_by_exercise_id(
        &mut conn,
        *exercise_id,
        *pagination,
    );
    let (submission_count, submissions) = future::try_join(submission_count, submissions).await?;

    let total_pages = pagination.total_pages(submission_count);

    Ok(web::Json(ExerciseSubmissions {
        data: submissions,
        total_pages,
    }))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route(
        "/{exercise_id}/submissions",
        web::get().to(get_exercise_submissions),
    );
}
