//! Controllers for requests starting with `/api/v0/main-frontend/courses`.

use chrono::Utc;
use std::sync::Arc;

use headless_lms_utils::strings::is_ietf_language_code_like;
use models::{
    chapters::Chapter,
    course_instances::{CourseInstance, CourseInstanceForm, NewCourseInstance},
    course_modules::ModuleUpdates,
    courses::{Course, CourseBreadcrumbInfo, CourseStructure, CourseUpdate, NewCourse},
    exercise_slide_submissions::{
        self, ExerciseAnswersInCourseRequiringAttentionCount, ExerciseSlideSubmissionCount,
        ExerciseSlideSubmissionCountByExercise, ExerciseSlideSubmissionCountByWeekAndHour,
    },
    exercises::Exercise,
    feedback::{self, Feedback, FeedbackCount},
    glossary::{Term, TermUpdate},
    library,
    material_references::{MaterialReference, NewMaterialReference},
    page_visit_datum_summary_by_courses::PageVisitDatumSummaryByCourse,
    page_visit_datum_summary_by_courses_device_types::PageVisitDatumSummaryByCourseDeviceTypes,
    page_visit_datum_summary_by_pages::PageVisitDatumSummaryByPages,
    pages::Page,
    peer_review_configs::PeerReviewConfig,
    peer_review_questions::PeerReviewQuestion,
    user_exercise_states::ExerciseUserCounts,
};

use crate::{
    domain::{
        csv_export::{
            course_instance_export::CourseInstancesExportOperation,
            exercise_tasks_export::CourseExerciseTasksExportOperation, general_export,
            submissions::CourseSubmissionExportOperation, users_export::UsersExportOperation,
        },
        models_requests::{self, JwtKey},
        request_id::RequestId,
    },
    prelude::*,
};

/**
GET `/api/v0/main-frontend/courses/:course_id` - Get course.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_course(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course_id)).await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    token.authorized_ok(web::Json(course))
}

/**
GET `/api/v0/main-frontend/courses/:course_id/breadcrumb-info` - Get information to display breadcrumbs on the manage course pages.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_course_breadcrumb_info(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseBreadcrumbInfo>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let info = models::courses::get_course_breadcrumb_info(&mut conn, *course_id).await?;
    token.authorized_ok(web::Json(info))
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
#[generated_doc]
#[instrument(skip(pool))]
async fn post_new_course(
    request_id: RequestId,
    pool: web::Data<PgPool>,
    payload: web::Json<NewCourse>,
    user: AuthUser,
    jwt_key: web::Data<JwtKey>,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    let new_course = payload.0;
    if !is_ietf_language_code_like(&new_course.language_code) {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Malformed language code.".to_string(),
            None,
        ));
    }
    let token = authorize(
        &mut conn,
        Act::CreateCoursesOrExams,
        Some(user.id),
        Res::Organization(new_course.organization_id),
    )
    .await?;

    let mut tx = conn.begin().await?;
    let (course, ..) = library::content_management::create_new_course(
        &mut tx,
        PKeyPolicy::Generate,
        new_course,
        user.id,
        models_requests::make_spec_fetcher(request_id.0, Arc::clone(&jwt_key)),
        models_requests::fetch_service_info,
    )
    .await?;
    models::roles::insert(
        &mut tx,
        user.id,
        models::roles::UserRole::Teacher,
        models::roles::RoleDomain::Course(course.id),
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(course))
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
#[generated_doc]
#[instrument(skip(pool))]
async fn update_course(
    payload: web::Json<CourseUpdate>,
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let course_update = payload.0;
    let course = models::courses::update_course(&mut conn, *course_id, course_update).await?;
    token.authorized_ok(web::Json(course))
}

/**
DELETE `/api/v0/main-frontend/courses/:course_id` - Delete a course.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn delete_course(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::UsuallyUnacceptableDeletion,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let course = models::courses::delete_course(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(course))
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
#[generated_doc]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_course_structure(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<CourseStructure>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewInternalCourseStructure,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let course_structure = models::courses::get_course_structure(
        &mut conn,
        *course_id,
        file_store.as_ref(),
        app_conf.as_ref(),
    )
    .await?;

    token.authorized_ok(web::Json(course_structure))
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
#[generated_doc]
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
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let media_path = upload_file_from_cms(
        request.headers(),
        payload,
        StoreKind::Course(course.id),
        file_store.as_ref(),
        &mut conn,
        user,
    )
    .await?;
    let download_url = file_store.get_download_url(media_path.as_path(), app_conf.as_ref());

    token.authorized_ok(web::Json(UploadResult { url: download_url }))
}

/**
GET `/api/v0/main-frontend/courses/:id/exercises` - Returns all exercises for the course.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_all_exercises(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Exercise>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let exercises = models::exercises::get_exercises_by_course_id(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(exercises))
}

/**
GET `/api/v0/main-frontend/courses/:id/exercises-and-count-of-answers-requiring-attention` - Returns all exercises for the course and count of answers requiring attention in them.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_all_exercises_and_count_of_answers_requiring_attention(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseAnswersInCourseRequiringAttentionCount>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let _exercises = models::exercises::get_exercises_by_course_id(&mut conn, *course_id).await?;
    let count_of_answers_requiring_attention = models::exercise_slide_submissions::get_count_of_answers_requiring_attention_in_exercise_by_course_id(&mut conn, *course_id).await?;
    token.authorized_ok(web::Json(count_of_answers_requiring_attention))
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
#[generated_doc]
#[instrument(skip(pool))]
async fn get_all_course_language_versions(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Course>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let language_versions =
        models::courses::get_all_language_versions_of_course(&mut conn, &course).await?;

    token.authorized_ok(web::Json(language_versions))
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
#[generated_doc]
#[instrument(skip(pool))]
pub async fn post_new_course_language_version(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<NewCourse>,
    user: AuthUser,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Duplicate,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let copied_course =
        models::library::copying::copy_course(&mut conn, *course_id, &payload.0, true, user.id)
            .await?;
    models::roles::insert(
        &mut conn,
        user.id,
        models::roles::UserRole::Teacher,
        models::roles::RoleDomain::Course(copied_course.id),
    )
    .await?;

    token.authorized_ok(web::Json(copied_course))
}

/**
POST `/api/v0/main-frontend/courses/:id/duplicate` - Post new course as a copy from existing one.

# Example

Request:
```http
POST /api/v0/main-frontend/courses/fd484707-25b6-4c51-a4ff-32d8259e3e47/duplicate HTTP/1.1
Content-Type: application/json

{
  "name": "Johdatus kaikkeen",
  "slug": "johdatus-kaikkeen",
  "organization_id": "1b89e57e-8b57-42f2-9fed-c7a6736e3eec",
  "language_code": "fi-FI"
}
```
*/

#[generated_doc]
#[instrument(skip(pool))]
pub async fn post_new_course_duplicate(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<NewCourse>,
    user: AuthUser,
) -> ControllerResult<web::Json<Course>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Duplicate,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let copied_course =
        models::library::copying::copy_course(&mut conn, *course_id, &payload.0, false, user.id)
            .await?;

    models::roles::insert(
        &mut conn,
        user.id,
        models::roles::UserRole::Teacher,
        models::roles::RoleDomain::Course(copied_course.id),
    )
    .await?;
    token.authorized_ok(web::Json(copied_course))
}

/**
GET `/api/v0/main-frontend/courses/:id/daily-submission-counts` - Returns submission counts grouped by day.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_daily_submission_counts(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseSlideSubmissionCount>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let res =
        exercise_slide_submissions::get_course_daily_slide_submission_counts(&mut conn, &course)
            .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/daily-users-who-have-submitted-something` - Returns a count of users who have submitted something grouped by day.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_daily_user_counts_with_submissions(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseSlideSubmissionCount>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let res = exercise_slide_submissions::get_course_daily_user_counts_with_submissions(
        &mut conn, &course,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/weekday-hour-submission-counts` - Returns submission counts grouped by weekday and hour.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_weekday_hour_submission_counts(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseSlideSubmissionCountByWeekAndHour>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let res = exercise_slide_submissions::get_course_exercise_slide_submission_counts_by_weekday_and_hour(
        &mut conn, &course,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/submission-counts-by-exercise` - Returns submission counts grouped by weekday and hour.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_submission_counts_by_exercise(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseSlideSubmissionCountByExercise>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    let res = exercise_slide_submissions::get_course_exercise_slide_submission_counts_by_exercise(
        &mut conn, &course,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/course-instances` - Returns all course instances for given course id.
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn get_course_instances(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CourseInstance>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let course_instances =
        models::course_instances::get_course_instances_for_course(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(course_instances))
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GetFeedbackQuery {
    read: bool,
    #[serde(flatten)]
    pagination: Pagination,
}

/**
GET `/api/v0/main-frontend/courses/:id/feedback?read=true` - Returns feedback for the given course.
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn get_feedback(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    read: web::Query<GetFeedbackQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Feedback>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let feedback =
        feedback::get_feedback_for_course(&mut conn, *course_id, read.read, read.pagination)
            .await?;

    token.authorized_ok(web::Json(feedback))
}

/**
GET `/api/v0/main-frontend/courses/:id/feedback-count` - Returns the amount of feedback for the given course.
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn get_feedback_count(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<FeedbackCount>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let feedback_count = feedback::get_feedback_count_for_course(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(feedback_count))
}

/**
POST `/api/v0/main-frontend/courses/:id/new-course-instance`
*/
#[generated_doc]
#[instrument(skip(pool))]
async fn new_course_instance(
    form: web::Json<CourseInstanceForm>,
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let form = form.into_inner();
    let new = NewCourseInstance {
        course_id: *course_id,
        name: form.name.as_deref(),
        description: form.description.as_deref(),
        support_email: form.support_email.as_deref(),
        teacher_in_charge_name: &form.teacher_in_charge_name,
        teacher_in_charge_email: &form.teacher_in_charge_email,
        opening_time: form.opening_time,
        closing_time: form.closing_time,
    };
    let ci = models::course_instances::insert(&mut conn, PKeyPolicy::Generate, new).await?;

    token.authorized_ok(web::Json(ci.id))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn glossary(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Term>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let glossary = models::glossary::fetch_for_course(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(glossary))
}

// unused?
#[generated_doc]
#[instrument(skip(pool))]
async fn _new_term(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<Term>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let glossary = models::glossary::fetch_for_course(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(glossary))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn new_glossary_term(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    new_term: web::Json<TermUpdate>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let TermUpdate { term, definition } = new_term.into_inner();
    let term = models::glossary::insert(&mut conn, &term, &definition, *course_id).await?;

    token.authorized_ok(web::Json(term))
}

/**
GET `/api/v0/main-frontend/courses/:id/course-users-counts-by-exercise` - Returns the amount of users for each exercise.
*/
#[instrument(skip(pool))]
pub async fn get_course_users_counts_by_exercise(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<ExerciseUserCounts>>> {
    let mut conn = pool.acquire().await?;
    let course_id = course_id.into_inner();
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;

    let res =
        models::user_exercise_states::get_course_users_counts_by_exercise(&mut conn, course_id)
            .await?;

    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/main-frontend/courses/:id/new-page-ordering` - Reorders pages to the given order numbers and given chapters.#

Creates redirects if url_path changes.
*/
#[instrument(skip(pool))]
pub async fn post_new_page_ordering(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<Vec<Page>>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let course_id = course_id.into_inner();
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;

    models::pages::reorder_pages(&mut conn, &payload, course_id).await?;

    token.authorized_ok(web::Json(()))
}

/**
POST `/api/v0/main-frontend/courses/:id/new-chapter-ordering` - Reorders chapters based on modified chapter number.#

Creates redirects if url_path changes.
*/
#[instrument(skip(pool))]
pub async fn post_new_chapter_ordering(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<Vec<Chapter>>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let course_id = course_id.into_inner();
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;

    models::pages::reorder_chapters(&mut conn, &payload, course_id).await?;

    token.authorized_ok(web::Json(()))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn get_material_references_by_course_id(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<MaterialReference>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    let res =
        models::material_references::get_references_by_course_id(&mut conn, *course_id).await?;
    token.authorized_ok(web::Json(res))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn insert_material_references(
    course_id: web::Path<Uuid>,
    payload: web::Json<Vec<NewMaterialReference>>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    models::material_references::insert_reference(&mut conn, *course_id, payload.0).await?;

    token.authorized_ok(web::Json(()))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn update_material_reference(
    path: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<NewMaterialReference>,
) -> ControllerResult<web::Json<()>> {
    let (course_id, reference_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?;

    models::material_references::update_material_reference_by_id(
        &mut conn,
        reference_id,
        payload.0,
    )
    .await?;
    token.authorized_ok(web::Json(()))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn delete_material_reference_by_id(
    path: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let (course_id, reference_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(course_id)).await?;

    models::material_references::delete_reference(&mut conn, reference_id).await?;
    token.authorized_ok(web::Json(()))
}

#[generated_doc]
#[instrument(skip(pool))]
pub async fn update_modules(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
    payload: web::Json<ModuleUpdates>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    models::course_modules::update_modules(&mut conn, *course_id, payload.into_inner()).await?;
    token.authorized_ok(web::Json(()))
}

async fn get_course_default_peer_review(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<(PeerReviewConfig, Vec<PeerReviewQuestion>)>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::View, Some(user.id), Res::Course(*course_id)).await?;

    let peer_review =
        models::peer_review_configs::get_default_for_course_by_course_id(&mut conn, *course_id)
            .await?;
    let peer_review_questions =
        models::peer_review_questions::get_all_by_peer_review_config_id(&mut conn, peer_review.id)
            .await?;
    token.authorized_ok(web::Json((peer_review, peer_review_questions)))
}

/**
POST `/api/v0/main-frontend/courses/{course_id}/update-peer-review-queue-reviews-received`

Updates reviews received for all the students in the peer review queue for a specific course. Updates only entries that have not received enough peer reviews in the table. Only available to admins.
*/
#[generated_doc]
#[instrument(skip(pool, user))]
async fn post_update_peer_review_queue_reviews_received(
    pool: web::Data<PgPool>,
    user: AuthUser,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<bool>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::GlobalPermissions).await?;
    models::library::peer_reviewing::update_peer_review_queue_reviews_received(
        &mut conn, *course_id,
    )
    .await?;
    token.authorized_ok(web::Json(true))
}

/**
GET `/api/v0/main-frontend/courses/${courseId}/export-submissions`

gets SCV of course exercise submissions
*/
#[instrument(skip(pool))]
pub async fn submission_export(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let course = models::courses::get_course(&mut conn, *course_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"Course: {} - Submissions {}.csv\"",
            course.name,
            Utc::now().format("%Y-%m-%d")
        ),
        CourseSubmissionExportOperation {
            course_id: *course_id,
        },
        token,
    )
    .await
}

/**
GET `/api/v0/main-frontend/courses/${course.id}/export-user-details`

gets SCV of user details for all users having submitted an exercise in the course
*/
#[instrument(skip(pool))]
pub async fn user_details_export(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let course = models::courses::get_course(&mut conn, *course_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"Course: {} - User Details {}.csv\"",
            course.name,
            Utc::now().format("%Y-%m-%d")
        ),
        UsersExportOperation {
            course_id: *course_id,
        },
        token,
    )
    .await
}

/**
GET `/api/v0/main-frontend/courses/${course.id}/export-exercise-tasks`

gets SCV all exercise-tasks' private specs in course
*/
#[instrument(skip(pool))]
pub async fn exercise_tasks_export(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let course = models::courses::get_course(&mut conn, *course_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"Course: {} - Exercise tasks {}.csv\"",
            course.name,
            Utc::now().format("%Y-%m-%d")
        ),
        CourseExerciseTasksExportOperation {
            course_id: *course_id,
        },
        token,
    )
    .await
}

/**
GET `/api/v0/main-frontend/courses/${course.id}/export-course-instances`

gets SCV course instances for course
*/
#[instrument(skip(pool))]
pub async fn course_instances_export(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;

    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;

    let course = models::courses::get_course(&mut conn, *course_id).await?;

    general_export(
        pool,
        &format!(
            "attachment; filename=\"Course: {} - Instances {}.csv\"",
            course.name,
            Utc::now().format("%Y-%m-%d")
        ),
        CourseInstancesExportOperation {
            course_id: *course_id,
        },
        token,
    )
    .await
}

/**
GET `/api/v0/main-frontend/courses/${course.id}/page-visit-datum-summary` - Gets aggregated statistics for page visits for the course.
*/
#[generated_doc]
pub async fn get_page_visit_datum_summary(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PageVisitDatumSummaryByCourse>>> {
    let mut conn = pool.acquire().await?;
    let course_id = course_id.into_inner();
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;

    let res = models::page_visit_datum_summary_by_courses::get_all_for_course(&mut conn, course_id)
        .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/courses/${course.id}/page-visit-datum-summary-by-pages` - Gets aggregated statistics for page visits for the course.
*/
#[generated_doc]
pub async fn get_page_visit_datum_summary_by_pages(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PageVisitDatumSummaryByPages>>> {
    let mut conn = pool.acquire().await?;
    let course_id = course_id.into_inner();
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;

    let res =
        models::page_visit_datum_summary_by_pages::get_all_for_course(&mut conn, course_id).await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/courses/${course.id}/page-visit-datum-summary-by-device-types` - Gets aggregated statistics for page visits for the course.
*/
#[generated_doc]
pub async fn get_page_visit_datum_summary_by_device_types(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PageVisitDatumSummaryByCourseDeviceTypes>>> {
    let mut conn = pool.acquire().await?;
    let course_id = course_id.into_inner();
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;

    let res = models::page_visit_datum_summary_by_courses_device_types::get_all_for_course(
        &mut conn, course_id,
    )
    .await?;

    token.authorized_ok(web::Json(res))
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
        .route(
            "/{course_id}/daily-users-who-have-submitted-something",
            web::get().to(get_daily_user_counts_with_submissions),
        )
        .route("/{course_id}/exercises", web::get().to(get_all_exercises))
        .route(
            "/{course_id}/exercises-and-count-of-answers-requiring-attention",
            web::get().to(get_all_exercises_and_count_of_answers_requiring_attention),
        )
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
        .route(
            "/{course_id}/duplicate",
            web::post().to(post_new_course_duplicate),
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
        )
        .route("/{course_id}/glossary", web::get().to(glossary))
        .route("/{course_id}/glossary", web::post().to(new_glossary_term))
        .route(
            "/{course_id}/course-users-counts-by-exercise",
            web::get().to(get_course_users_counts_by_exercise),
        )
        .route(
            "/{course_id}/new-page-ordering",
            web::post().to(post_new_page_ordering),
        )
        .route(
            "/{course_id}/new-chapter-ordering",
            web::post().to(post_new_chapter_ordering),
        )
        .route(
            "/{course_id}/references",
            web::get().to(get_material_references_by_course_id),
        )
        .route(
            "/{course_id}/references",
            web::post().to(insert_material_references),
        )
        .route(
            "/{course_id}/references/{reference_id}",
            web::post().to(update_material_reference),
        )
        .route(
            "/{course_id}/references/{reference_id}",
            web::delete().to(delete_material_reference_by_id),
        )
        .route(
            "/{course_id}/course-modules",
            web::post().to(update_modules),
        )
        .route(
            "/{course_id}/default-peer-review",
            web::get().to(get_course_default_peer_review),
        )
        .route(
            "/{course_id}/update-peer-review-queue-reviews-received",
            web::post().to(post_update_peer_review_queue_reviews_received),
        )
        .route(
            "/{course_id}/breadcrumb-info",
            web::get().to(get_course_breadcrumb_info),
        )
        .route(
            "/{course_id}/export-submissions",
            web::get().to(submission_export),
        )
        .route(
            "/{course_id}/export-user-details",
            web::get().to(user_details_export),
        )
        .route(
            "/{course_id}/export-exercise-tasks",
            web::get().to(exercise_tasks_export),
        )
        .route(
            "/{course_id}/export-course-instances",
            web::get().to(course_instances_export),
        )
        .route(
            "/{course_id}/page-visit-datum-summary",
            web::get().to(get_page_visit_datum_summary),
        )
        .route(
            "/{course_id}/page-visit-datum-summary-by-pages",
            web::get().to(get_page_visit_datum_summary_by_pages),
        )
        .route(
            "/{course_id}/page-visit-datum-summary-by-device-types",
            web::get().to(get_page_visit_datum_summary_by_device_types),
        );
}
