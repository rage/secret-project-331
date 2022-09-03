use std::ops::Deref;

use models::{
    exercise_repositories::{ExerciseRepository, ExerciseRepositoryUpdate},
    CourseOrExamId,
};

use crate::{controllers::prelude::*, domain};

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewExerciseRepository {
    course_id: Option<Uuid>,
    exam_id: Option<Uuid>,
    git_url: String,
    deploy_key: Option<String>,
}

/**
POST `/api/v0/main-frontend/exercise-repositories/new
*/
#[generated_doc]
#[instrument(skip(pool, file_store, app_conf))]
async fn new(
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    repository: web::Json<NewExerciseRepository>,
    user: AuthUser,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let course_or_exam_id = CourseOrExamId::from(repository.course_id, repository.exam_id)?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::from_course_or_exam_id(course_or_exam_id),
    )
    .await?;
    // create pending repository
    let new_repository_id = Uuid::new_v4();
    models::exercise_repositories::new(
        &mut conn,
        new_repository_id,
        course_or_exam_id,
        &repository.git_url,
        repository.deploy_key.as_deref(),
    )
    .await?;
    // processing a repository may take a while, so this is done in the background
    actix_web::rt::spawn(async move {
        let file_store = file_store;
        if let Err(err) = domain::exercise_repositories::process(
            &mut conn,
            new_repository_id,
            &repository.git_url,
            repository.deploy_key.as_deref(),
            file_store.as_ref(),
            app_conf.as_ref(),
        )
        .await
        {
            tracing::error!(
                "Error while processing repository {new_repository_id} as a failure: {err}"
            );
        }
    });
    token.authorized_ok(web::Json(new_repository_id))
}

/**
GET `/api/v0/main-frontend/exercise-repositories/course/:id`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_for_course(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<ExerciseRepository>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        user.map(|u| u.id),
        Res::Course(*course_id),
    )
    .await?;
    let repos = models::exercise_repositories::get_for_course_or_exam(
        &mut conn,
        CourseOrExamId::Course(*course_id),
    )
    .await?;
    token.authorized_ok(web::Json(repos))
}

/**
GET `/api/v0/main-frontend/exercise-repositories/exam/:id`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_for_exam(
    pool: web::Data<PgPool>,
    exam_id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<ExerciseRepository>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::View,
        user.map(|u| u.id),
        Res::Exam(*exam_id),
    )
    .await?;
    let repos = models::exercise_repositories::get_for_course_or_exam(
        &mut conn,
        CourseOrExamId::Exam(*exam_id),
    )
    .await?;
    token.authorized_ok(web::Json(repos))
}

/**
DELETE `/api/v0/main-frontend/exercise-repositories/:id`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn delete(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let repository = models::exercise_repositories::get(&mut conn, *id).await?;
    let course_or_exam_id = CourseOrExamId::from(repository.course_id, repository.exam_id)?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        user.map(|u| u.id),
        Res::from_course_or_exam_id(course_or_exam_id),
    )
    .await?;

    let mut tx = conn.begin().await?;
    models::repository_exercises::delete_from_repository(&mut tx, *id).await?;
    models::exercise_repositories::delete(&mut tx, *id).await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(true))
}

/**
PUT `/api/v0/main-frontend/exercise-repositories/:id`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn update(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    user: Option<AuthUser>,
    update: web::Json<ExerciseRepositoryUpdate>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let repository = models::exercise_repositories::get(&mut conn, *id).await?;
    let course_or_exam_id = CourseOrExamId::from(repository.course_id, repository.exam_id)?;
    let token = authorize(
        &mut conn,
        Act::Edit,
        user.map(|u| u.id),
        Res::from_course_or_exam_id(course_or_exam_id),
    )
    .await?;

    models::exercise_repositories::update(&mut conn, *id, update.deref()).await?;
    token.authorized_ok(web::Json(true))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/new", web::post().to(new))
        .route("/course/{course_id}", web::get().to(get_for_course))
        .route("/exam/{exam_id}", web::get().to(get_for_exam))
        .route("/{id}", web::delete().to(delete))
        .route("/{id}", web::put().to(update));
}
