//! Controllers for requests starting with `/api/v0/main-frontend/courses`.
use crate::{
    controllers::ApplicationResult,
    domain::authorization::AuthUser,
    models::{
        courses::{Course, CourseUpdate, NewCourse},
        pages::{ContentBlock, NewPage},
        submissions::{SubmissionCount, SubmissionCountByExercise, SubmissionCountByWeekAndHour},
    },
};
use actix_web::web::ServiceConfig;
use actix_web::web::{self, Json};
use sqlx::PgPool;
use uuid::Uuid;

/**
GET `/api/v0/main-frontend/courses/:course_id` - Get course.
# Example

Response:
```json
{
  "id": "ab4541d8-6db4-4561-bdb2-45f35b2544a1",
  "slug": "introduction-to-introduction",
  "created_at": "2021-04-21T18:34:21.795388",
  "updated_at": "2021-04-21T18:49:21.398638",
  "name": "Introduction to Introduction",
  "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
  "deleted_at": null
}
```
*/
#[instrument(skip(pool))]
async fn get_course(
    request_course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ApplicationResult<Json<Course>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::get_course(&mut conn, *request_course_id).await?;
    Ok(Json(course))
}

/**
POST `/api/v0/main-frontend/courses` - Create a new course.
# Example

Request:
```http
POST /api/v0/main-frontend/courses HTTP/1.1
Content-Type: application/json

{
  "name": "Introduction to introduction",
  "slug": "introduction-to-introduction",
  "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec"
}
```

Response:
```json
{
  "id": "ab4541d8-6db4-4561-bdb2-45f35b2544a1",
  "slug": "introduction-to-introduction",
  "created_at": "2021-04-21T18:34:21.795388",
  "updated_at": "2021-04-21T18:34:21.795388",
  "name": "Introduction to introduction",
  "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
  "deleted_at": null
}
```
*/
#[instrument(skip(pool))]
async fn post_new_course(
    pool: web::Data<PgPool>,
    payload: web::Json<NewCourse>,
    user: AuthUser,
) -> ApplicationResult<Json<Course>> {
    let mut conn = pool.acquire().await?;
    let new_course = payload.0;
    let course = crate::models::courses::insert_course(&mut conn, new_course).await?;
    let initial_content = serde_json::to_value(vec![
        ContentBlock::new_primitive("moocfi/course-grid".to_owned()),
        ContentBlock::new_primitive("moocfi/course-progress".to_owned()),
    ])
    .expect("Initial data serialization should succeed.");
    let front_page = NewPage {
        chapter_id: None,
        content: initial_content,
        course_id: course.id,
        front_page_of_chapter_id: None,
        title: course.name.clone(),
        url_path: String::from("/"),
    };
    let _page = crate::models::pages::insert_page(&mut conn, front_page).await?;
    Ok(Json(course))
}

/**
POST `/api/v0/main-frontend/courses/:course_id` - Update course.
# Example

Request:
```http
PUT /api/v0/main-frontend/courses/ab4541d8-6db4-4561-bdb2-45f35b2544a1 HTTP/1.1
Content-Type: application/json

{
  "name": "Introduction to Introduction"
}

```

Response:
```json
{
  "id": "ab4541d8-6db4-4561-bdb2-45f35b2544a1",
  "slug": "introduction-to-introduction",
  "created_at": "2021-04-21T18:34:21.795388",
  "updated_at": "2021-04-21T18:49:21.398638",
  "name": "Introduction to Introduction",
  "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
  "deleted_at": null
}
```
*/
#[instrument(skip(pool))]
async fn update_course(
    payload: web::Json<CourseUpdate>,
    request_course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<Course>> {
    let mut conn = pool.acquire().await?;
    let course_update = payload.0;
    let course =
        crate::models::courses::update_course(&mut conn, *request_course_id, course_update).await?;
    Ok(Json(course))
}

/**
DELETE `/api/v0/main-frontend/courses/:course_id` - Delete a course.
# Example

```json
{
  "id": "ab4541d8-6db4-4561-bdb2-45f35b2544a1",
  "slug": "introduction-to-introduction",
  "created_at": "2021-04-21T18:34:21.795388",
  "updated_at": "2021-04-21T18:49:21.398638",
  "name": "Introduction to Introduction",
  "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
  "deleted_at": "2021-04-28T16:33:42.670935"
}
```
*/
#[instrument(skip(pool))]
async fn delete_course(
    request_course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ApplicationResult<Json<Course>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::delete_course(&mut conn, *request_course_id).await?;
    Ok(Json(course))
}

/**
GET `/api/v0/main-frontend/courses/:id/daily-submission-counts` - Returns submission counts grouped by day.

# Example
```json
[
  {
      "date": "2021-01-01",
      "count": 23
  },
  {
      "date": "2021-01-02",
      "count": 57
  }
]
```
*/
#[instrument(skip(pool))]
async fn get_daily_submission_counts(
    pool: web::Data<PgPool>,
    request_course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ApplicationResult<Json<Vec<SubmissionCount>>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::get_course(&mut conn, *request_course_id).await?;
    let res =
        crate::models::submissions::get_course_daily_submission_counts(&mut conn, &course).await?;
    Ok(Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/weekday-hour-submission-counts` - Returns submission counts grouped by weekday and hour.

# Example
```json
[
  {
      "isodow": 1,
      "hour": 23
      "count": 23
  },
  {
      "isodow": 2,
      "hour": 5
      "count": 55
  }
]
```
*/
#[instrument(skip(pool))]
async fn get_weekday_hour_submission_counts(
    pool: web::Data<PgPool>,
    request_course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ApplicationResult<Json<Vec<SubmissionCountByWeekAndHour>>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::get_course(&mut conn, *request_course_id).await?;
    let res = crate::models::submissions::get_course_submission_counts_by_weekday_and_hour(
        &mut conn, &course,
    )
    .await?;
    Ok(Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/submission-counts-by-exercise` - Returns submission counts grouped by weekday and hour.

# Example
```json
[
  {
      "exercise_id": "34e47a8e-d573-43be-8f23-79128cbb29b8",
      "count": 23,
      "exercise_name": "Best exercise"
  }
```
*/
#[instrument(skip(pool))]
async fn get_submission_counts_by_exercise(
    pool: web::Data<PgPool>,
    request_course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ApplicationResult<Json<Vec<SubmissionCountByExercise>>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::get_course(&mut conn, *request_course_id).await?;
    let res =
        crate::models::submissions::get_course_submission_counts_by_exercise(&mut conn, &course)
            .await?;
    Ok(Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_courses_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id}", web::get().to(get_course))
        .route("", web::post().to(post_new_course))
        .route("/{course_id}", web::put().to(update_course))
        .route("/{course_id}", web::delete().to(delete_course))
        .route(
            "/{course_id}/daily-submission-counts",
            web::get().to(get_daily_submission_counts),
        )
        .route(
            "/{course_id}/weekday-hour-submission-counts",
            web::get().to(get_weekday_hour_submission_counts),
        )
        .route(
            "/{course_id}/submission-counts-by-exercise",
            web::get().to(get_submission_counts_by_exercise),
        );
}
