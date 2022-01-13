//! Controllers for requests starting with `/api/v0/main-frontend/courses`.

use headless_lms_utils::strings::is_ietf_language_code_like;
use models::{
    course_instances::{CourseInstance, CourseInstanceForm, NewCourseInstance},
    courses::{Course, CourseStructure, CourseUpdate, NewCourse},
    exercises::Exercise,
    feedback::{self, Feedback, FeedbackCount},
    submissions::{SubmissionCount, SubmissionCountByExercise, SubmissionCountByWeekAndHour},
};

use crate::controllers::prelude::*;

/**
GET `/api/v0/main-frontend/courses/:course_id` - Get course.
*/
#[generated_doc(Course)]
#[instrument(skip(pool))]
async fn get_course(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Course(*course_id)).await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    Ok(web::Json(course))
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
*/
#[generated_doc(Course)]
#[instrument(skip(pool))]
async fn post_new_course(
    pool: web::Data<PgPool>,
    payload: web::Json<NewCourse>,
    user: AuthUser,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    let new_course = payload.0;
    if !is_ietf_language_code_like(&new_course.language_code) {
        return Err(ControllerError::BadRequest(
            "Malformed language code.".to_string(),
        ));
    }
    authorize(
        &mut conn,
        Act::Teach,
        user.id,
        Res::Organization(new_course.organization_id),
    )
    .await?;
    let (course, ..) = models::courses::insert_course(
        &mut conn,
        Uuid::new_v4(),
        Uuid::new_v4(),
        new_course,
        user.id,
    )
    .await?;
    Ok(web::Json(course))
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
*/
#[generated_doc(Course)]
#[instrument(skip(pool))]
async fn update_course(
    payload: web::Json<CourseUpdate>,
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Course(*course_id)).await?;
    let course_update = payload.0;
    let course = models::courses::update_course(&mut conn, *course_id, course_update).await?;
    Ok(web::Json(course))
}

/**
DELETE `/api/v0/main-frontend/courses/:course_id` - Delete a course.
*/
#[generated_doc(Course)]
#[instrument(skip(pool))]
async fn delete_course(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Course(*course_id)).await?;
    let course = models::courses::delete_course(&mut conn, *course_id).await?;
    Ok(web::Json(course))
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
    "deleted_at": null,
    "language_code": "en-US",
    "copied_from": null,
    "language_version_of_course_id": null
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
#[generated_doc(CourseStructure)]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_course_structure(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<CourseStructure>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::View, user.id, Res::Course(*course_id)).await?;
    let course_structure = models::courses::get_course_structure(
        &mut conn,
        *course_id,
        file_store.as_ref(),
        app_conf.as_ref(),
    )
    .await?;
    Ok(web::Json(course_structure))
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
*/
#[generated_doc(UploadResult)]
#[instrument(skip(payload, request, pool, file_store, app_conf))]
async fn add_media_for_course(
    course_id: web::Path<Uuid>,
    payload: Multipart,
    request: HttpRequest,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<UploadResult>> {
    let mut conn = pool.acquire().await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Course(*course_id)).await?;
    let media_path = upload_media(
        request.headers(),
        payload,
        StoreKind::Course(course.id),
        &file_store,
    )
    .await?;
    let download_url = file_store.get_download_url(media_path.as_path(), app_conf.as_ref());

    Ok(web::Json(UploadResult { url: download_url }))
}

/**
GET `/api/v0/main-frontend/courses/:id/exercises` - Returns all exercises for the course.
*/
#[generated_doc(Vec<Exercise>)]
#[instrument(skip(pool))]
async fn get_all_exercises(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Exercise>>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Course(*course_id)).await?;
    let exercises = models::exercises::get_exercises_by_course_id(&mut conn, *course_id).await?;
    Ok(web::Json(exercises))
}

/**
GET `/api/v0/main-frontend/courses/:id/language-versions` - Returns all language versions of the same course.

# Example

Request:
```http
GET /api/v0/main-frontend/courses/fd484707-25b6-4c51-a4ff-32d8259e3e47/language-versions HTTP/1.1
Content-Type: application/json
```
*/
#[generated_doc(Vec<Exercise>)]
#[instrument(skip(pool))]
async fn get_all_course_language_versions(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<Course>>> {
    let mut conn = pool.acquire().await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let language_versions =
        models::courses::get_all_language_versions_of_course(&mut conn, &course).await?;
    Ok(web::Json(language_versions))
}

/**
POST `/api/v0/main-frontend/courses/:id/language-versions` - Post new course as a new language version of existing one.

# Example

Request:
```http
POST /api/v0/main-frontend/courses/fd484707-25b6-4c51-a4ff-32d8259e3e47/language-versions HTTP/1.1
Content-Type: application/json

{
  "name": "Johdatus kaikkeen",
  "slug": "johdatus-kaikkeen",
  "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
  "language_code": "fi-FI"
}
```
*/
#[generated_doc(Course)]
pub async fn post_new_course_language_version(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<NewCourse>,
    user: AuthUser,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Duplicate, user.id, Res::Course(*course_id)).await?;
    let copied_course = models::courses::copy_course_as_language_version_of_course(
        &mut conn, *course_id, &payload.0,
    )
    .await?;
    Ok(web::Json(copied_course))
}

/**
GET `/api/v0/main-frontend/courses/:id/daily-submission-counts` - Returns submission counts grouped by day.
*/
#[generated_doc(Vec<SubmissionCount>)]
#[instrument(skip(pool))]
async fn get_daily_submission_counts(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<SubmissionCount>>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::View, user.id, Res::Course(*course_id)).await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let res = models::submissions::get_course_daily_submission_counts(&mut conn, &course).await?;
    Ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/weekday-hour-submission-counts` - Returns submission counts grouped by weekday and hour.
*/
#[generated_doc(Vec<SubmissionCountByWeekAndHour>)]
#[instrument(skip(pool))]
async fn get_weekday_hour_submission_counts(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<SubmissionCountByWeekAndHour>>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::View, user.id, Res::Course(*course_id)).await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let res =
        models::submissions::get_course_submission_counts_by_weekday_and_hour(&mut conn, &course)
            .await?;
    Ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/submission-counts-by-exercise` - Returns submission counts grouped by weekday and hour.
*/
#[generated_doc(Vec<SubmissionCountByExercise>)]
#[instrument(skip(pool))]
async fn get_submission_counts_by_exercise(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<SubmissionCountByExercise>>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::View, user.id, Res::Course(*course_id)).await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let res =
        models::submissions::get_course_submission_counts_by_exercise(&mut conn, &course).await?;
    Ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/course-instances` - Returns all course instances for given course id.
*/
#[generated_doc(Vec<CourseInstance>)]
#[instrument(skip(pool))]
async fn get_course_instances(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseInstance>>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::View, user.id, Res::Course(*course_id)).await?;
    let course_instances =
        models::course_instances::get_course_instances_for_course(&mut conn, *course_id).await?;
    Ok(web::Json(course_instances))
}

#[derive(Debug, Deserialize, TS)]
pub struct GetFeedbackQuery {
    read: bool,
    #[serde(flatten)]
    pagination: Pagination,
}

/**
GET `/api/v0/main-frontend/courses/:id/feedback?read=true` - Returns feedback for the given course.
*/
#[generated_doc(Vec<Feedback>)]
#[instrument(skip(pool))]
pub async fn get_feedback(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    read: web::Query<GetFeedbackQuery>,
) -> ControllerResult<web::Json<Vec<Feedback>>> {
    let mut conn = pool.acquire().await?;

    let feedback =
        feedback::get_feedback_for_course(&mut conn, *course_id, read.read, read.pagination)
            .await?;
    Ok(web::Json(feedback))
}

/**
GET `/api/v0/main-frontend/courses/:id/feedback-count` - Returns the amount of feedback for the given course.
*/
#[generated_doc(FeedbackCount)]
#[instrument(skip(pool))]
pub async fn get_feedback_count(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<FeedbackCount>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::View, user.id, Res::Course(*course_id)).await?;

    let feedback_count = feedback::get_feedback_count_for_course(&mut conn, *course_id).await?;
    Ok(web::Json(feedback_count))
}

/**
POST `/api/v0/main-frontend/courses/:id/new-course-instance`
*/
#[generated_doc(Uuid)]
async fn new_course_instance(
    form: web::Json<CourseInstanceForm>,
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, user.id, Res::Course(*course_id)).await?;
    let form = form.into_inner();
    let new = NewCourseInstance {
        id: Uuid::new_v4(),
        course_id: *course_id,
        name: form.name.as_deref(),
        description: form.description.as_deref(),
        variant_status: None,
        support_email: form.support_email.as_deref(),
        teacher_in_charge_name: &form.teacher_in_charge_name,
        teacher_in_charge_email: &form.teacher_in_charge_email,
        opening_time: form.opening_time,
        closing_time: form.closing_time,
    };
    let ci = models::course_instances::insert(&mut conn, new).await?;
    Ok(web::Json(ci.id))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
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
            web::get().to(get_course_structure),
        )
        .route(
            "/{course_id}/language-versions",
            web::get().to(get_all_course_language_versions),
        )
        .route(
            "/{course_id}/language-versions",
            web::post().to(post_new_course_language_version),
        )
        .route("/{course_id}/upload", web::post().to(add_media_for_course))
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
        )
        .route("/{course_id}/feedback", web::get().to(get_feedback))
        .route(
            "/{course_id}/feedback-count",
            web::get().to(get_feedback_count),
        )
        .route(
            "/{course_id}/new-course-instance",
            web::post().to(new_course_instance),
        );
}
