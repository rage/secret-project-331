//! Controllers for requests starting with `/api/v0/main-frontend/courses`.
use crate::{
    controllers::{helpers::media::upload_media_for_course, ControllerResult, UploadResult},
    domain::authorization::AuthUser,
    models::{
        course_instances::CourseInstance,
        courses::{Course, CourseStructure, CourseUpdate, NewCourse},
        exercises::Exercise,
        submissions::{SubmissionCount, SubmissionCountByExercise, SubmissionCountByWeekAndHour},
    },
    utils::file_store::FileStore,
    ApplicationConfiguration,
};
use actix_multipart as mp;
use actix_web::web::{self, Json};
use actix_web::{web::ServiceConfig, HttpRequest};
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
) -> ControllerResult<Json<Course>> {
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
) -> ControllerResult<Json<Course>> {
    let mut conn = pool.acquire().await?;
    let new_course = payload.0;
    let (course, ..) = crate::models::courses::insert_course(&mut conn, new_course).await?;
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
) -> ControllerResult<Json<Course>> {
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
) -> ControllerResult<Json<Course>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::delete_course(&mut conn, *request_course_id).await?;
    Ok(Json(course))
}

/**
GET `/api/v0/main-frontend/courses/:course_id/structure` - Returns the structure of a course.
# Example
```json
{
  "course": {
    "id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
    "slug": "introduction-to-everything",
    "created_at": "2021-04-28T10:40:54.503917",
    "updated_at": "2021-04-28T10:40:54.503917",
    "name": "Introduction to everything",
    "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
    "deleted_at": null
  },
  "pages": [
    {
      "id": "f3b0d699-c9be-4d56-bd0a-9d40e5547e4d",
      "created_at": "2021-04-28T13:51:51.024118",
      "updated_at": "2021-04-28T14:36:18.179490",
      "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
      "content": [],
      "url_path": "/",
      "title": "Welcome to Introduction to Everything",
      "deleted_at": null,
      "chapter_id": "d332f3d9-39a5-4a18-80f4-251727693c37"
    }
  ],
  "chapters": [
    {
      "id": "d332f3d9-39a5-4a18-80f4-251727693c37",
      "created_at": "2021-04-28T16:11:47.477850",
      "updated_at": "2021-04-28T16:11:47.477850",
      "name": "The Basics",
      "course_id": "d86cf910-4d26-40e9-8c9c-1cc35294fdbb",
      "deleted_at": null,
      "chapter_image_url": "http://project-331.local/api/v0/files/uploads/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/mbPQh8th96TdUwX96Y0ch1fjbJLRFr.png",
      "chapter_number": 1,
      "front_page_id": null
    }
  ]
}
```
*/
#[instrument(skip(pool, file_store, app_conf))]
async fn get_course_structure<T: FileStore>(
    request_course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<T>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<Json<CourseStructure>> {
    let mut conn = pool.acquire().await?;
    let course_structure = crate::models::courses::get_course_structure(
        &mut conn,
        *request_course_id,
        file_store.as_ref(),
        app_conf.as_ref(),
    )
    .await?;
    Ok(Json(course_structure))
}

/**
POST `/api/v0/main-frontend/courses/:course_id/upload` - Uploads a media (image, audio, file) for the course from Gutenberg page edit.

Put the the contents of the media in a form and add a content type header multipart/form-data.
# Example

Request:
```http
POST /api/v0/main-frontend/pages/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/upload HTTP/1.1
Content-Type: multipart/form-data

BINARY_DATA
```

Response:
```json
{
    "url": "http://project-331.local/api/v0/files/organizations/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/iHZMHdvsazy43ZtP0Ea01sy8AOpUiZ.png"
}

```
*/
#[instrument(skip(payload, request, pool, file_store, app_conf))]
async fn add_media_for_course<T: FileStore>(
    request_course_id: web::Path<Uuid>,
    payload: mp::Multipart,
    request: HttpRequest,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<T>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<Json<UploadResult>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::get_course(&mut conn, *request_course_id).await?;

    let media_path =
        upload_media_for_course(request.headers(), payload, &course, file_store.as_ref()).await?;
    let download_url = file_store.get_download_url(&media_path.as_path(), app_conf.as_ref());

    Ok(Json(UploadResult { url: download_url }))
}

/**
GET `/api/v0/main-frontend/courses/:id/exercises` + Returns all exercises for the course.

# Example
```json
[
  {
    "id": "ab4541d8-6db4-4561-bdb2-45f35b2544a1",
    "slug": "introduction-to-introduction",
    "created_at": "2021-04-21T18:34:21.795388",
    "updated_at": "2021-04-21T18:49:21.398638",
    "name": "Introduction to Introduction",
    "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
    "deleted_at": null
  }
]
```
*/
#[instrument(skip(pool))]
async fn get_all_exercises(
    pool: web::Data<PgPool>,
    request_course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<Json<Vec<Exercise>>> {
    let mut conn = pool.acquire().await?;
    let exercises =
        crate::models::exercises::get_exercises_by_course_id(&mut conn, *request_course_id).await?;
    Ok(Json(exercises))
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
) -> ControllerResult<Json<Vec<SubmissionCount>>> {
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
) -> ControllerResult<Json<Vec<SubmissionCountByWeekAndHour>>> {
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
) -> ControllerResult<Json<Vec<SubmissionCountByExercise>>> {
    let mut conn = pool.acquire().await?;
    let course = crate::models::courses::get_course(&mut conn, *request_course_id).await?;
    let res =
        crate::models::submissions::get_course_submission_counts_by_exercise(&mut conn, &course)
            .await?;
    Ok(Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/course-instances` - Returns all course instances for given course id.

# Example
```json
[
  {
    "id": "e051ddb5-2128-4215-adda-ebd74a0ea46b",
    "created_at": "2021-06-28T00:21:11.780420Z",
    "updated_at": "2021-06-28T00:21:11.780420Z",
    "deleted_at": null,
    "course_id": "b8077bc2-0816-4c05-a651-d2d75d697fdf",
    "starts_at": null,
    "ends_at": null,
    "name": null,
    "description": null,
    "variant_status": "Active"
  }
]
```
*/
#[instrument(skip(pool))]
async fn get_course_instances(
    pool: web::Data<PgPool>,
    request_course_id: web::Path<Uuid>,
) -> ControllerResult<Json<Vec<CourseInstance>>> {
    let mut conn = pool.acquire().await?;
    let course_instances = crate::models::course_instances::get_course_instances_for_course(
        &mut conn,
        *request_course_id,
    )
    .await?;
    Ok(Json(course_instances))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_courses_routes<T: 'static + FileStore>(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id}", web::get().to(get_course))
        .route("", web::post().to(post_new_course))
        .route("/{course_id}", web::put().to(update_course))
        .route("/{course_id}", web::delete().to(delete_course))
        .route(
            "/{course_id}/daily-submission-counts",
            web::get().to(get_daily_submission_counts),
        )
        .route("/{course_id}/exercises", web::get().to(get_all_exercises))
        .route(
            "/{course_id}/structure",
            web::get().to(get_course_structure::<T>),
        )
        .route(
            "/{course_id}/upload",
            web::post().to(add_media_for_course::<T>),
        )
        .route(
            "/{course_id}/weekday-hour-submission-counts",
            web::get().to(get_weekday_hour_submission_counts),
        )
        .route(
            "/{course_id}/submission-counts-by-exercise",
            web::get().to(get_submission_counts_by_exercise),
        )
        .route(
            "/{course_id}/course-instances",
            web::get().to(get_course_instances),
        );
}
