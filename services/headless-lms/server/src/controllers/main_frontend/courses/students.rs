//! Controllers for requests starting with `/api/v0/main-frontend/courses/{course_id}/students`.
use crate::prelude::*;

use headless_lms_models::chapter_lock_action_logs;
use headless_lms_models::library::students_view::{
    CertificateGridRow, CompletionGridRow, CourseStudentsProgress, StudentsListPage,
};
use headless_lms_models::user_chapter_locking_statuses::{
    ChapterLockingStatus, UserChapterLockingStatus,
};
use serde::Deserialize;
use utoipa::OpenApi;
use utoipa::ToSchema;

#[derive(OpenApi)]
#[openapi(paths(
    get_progress,
    get_user_chapter_locking_statuses,
    get_course_users,
    get_completions,
    get_certificates,
    teacher_lock_student_chapter,
    teacher_unlock_student_chapter,
    teacher_set_student_chapter_status
))]
pub(crate) struct MainFrontendCourseStudentsApiDoc;

#[derive(Debug, Deserialize, ToSchema)]
struct ChapterLockStatusActionPayload {
    status: ChapterLockingStatus,
}

/// Body for the batch detail endpoints: the users of the current identity-list page.
#[derive(Debug, Deserialize, ToSchema)]
struct UserIdsPayload {
    user_ids: Vec<Uuid>,
}

/// Query parameters for the paginated student identity list.
#[derive(Debug, Deserialize)]
struct GetStudentsQuery {
    page: Option<u32>,
    limit: Option<u32>,
    search: Option<String>,
    sort_column: Option<String>,
    sort_direction: Option<String>,
    course_instance_id: Option<Uuid>,
}

/// POST `/api/v0/main-frontend/courses/{course_id}/students/progress`
#[utoipa::path(
    post,
    path = "/progress",
    operation_id = "getCourseStudentsProgress",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    request_body = UserIdsPayload,
    responses(
        (status = 200, description = "Course student progress overview", body = CourseStudentsProgress)
    )
)]
#[instrument(skip(pool))]
async fn get_progress(
    course_id: web::Path<Uuid>,
    payload: web::Json<UserIdsPayload>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<CourseStudentsProgress>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let res = headless_lms_models::library::students_view::get_progress_for_users(
        &mut conn,
        *course_id,
        &payload.user_ids,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// GET `/api/v0/main-frontend/courses/{course_id}/students/{user_id}/chapter-locking-statuses`
#[utoipa::path(
    get,
    path = "/{user_id}/chapter-locking-statuses",
    operation_id = "getCourseStudentChapterLockingStatuses",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("user_id" = Uuid, Path, description = "Target student id")
    ),
    responses(
        (status = 200, description = "Student chapter locking statuses", body = [UserChapterLockingStatus])
    )
)]
#[instrument(skip(pool))]
async fn get_user_chapter_locking_statuses(
    path: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<UserChapterLockingStatus>>> {
    let (course_id, target_user_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::ViewUserProgressOrDetails,
        Some(user.id),
        Res::Course(course_id),
    )
    .await?;

    models::user_details::get_user_details_by_user_id_for_course(
        &mut conn,
        target_user_id,
        course_id,
    )
    .await?;

    let statuses = models::user_chapter_locking_statuses::get_or_init_all_for_course(
        &mut conn,
        target_user_id,
        course_id,
    )
    .await?;

    token.authorized_ok(web::Json(statuses))
}

/// GET `/api/v0/main-frontend/courses/{course_id}/students/users`
#[utoipa::path(
    get,
    path = "/users",
    operation_id = "getCourseStudentsUsers",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("page" = Option<u32>, Query, description = "Page number (1-based)"),
        ("limit" = Option<u32>, Query, description = "Page size (1-10000)"),
        ("search" = Option<String>, Query, description = "Filter by name/email substring or exact user id"),
        ("sort_column" = Option<String>, Query, description = "last_name | first_name | email"),
        ("sort_direction" = Option<String>, Query, description = "asc | desc"),
        ("course_instance_id" = Option<Uuid>, Query, description = "Filter to a single course instance")
    ),
    responses(
        (status = 200, description = "A page of enrolled students", body = StudentsListPage)
    )
)]
#[instrument(skip(pool))]
async fn get_course_users(
    course_id: web::Path<Uuid>,
    query: web::Query<GetStudentsQuery>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<StudentsListPage>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let pagination = Pagination::new(query.page.unwrap_or(1), query.limit.unwrap_or(100))
        .map_err(|e| ControllerError::new(ControllerErrorType::BadRequest, e.to_string(), None))?;
    let res = headless_lms_models::library::students_view::get_course_students_page(
        &mut conn,
        *course_id,
        pagination,
        query.search.as_deref(),
        query.sort_column.as_deref(),
        query.sort_direction.as_deref(),
        query.course_instance_id,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/// POST `/api/v0/main-frontend/courses/{course_id}/students/completions`
#[utoipa::path(
    post,
    path = "/completions",
    operation_id = "getCourseStudentsCompletions",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    request_body = UserIdsPayload,
    responses(
        (status = 200, description = "Course completions for the given users", body = [CompletionGridRow])
    )
)]
#[instrument(skip(pool))]
async fn get_completions(
    course_id: web::Path<Uuid>,
    payload: web::Json<UserIdsPayload>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CompletionGridRow>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let rows = headless_lms_models::library::students_view::get_completions_grid_for_users(
        &mut conn,
        *course_id,
        &payload.user_ids,
    )
    .await?;

    token.authorized_ok(web::Json(rows))
}

/// POST `/api/v0/main-frontend/courses/{course_id}/students/certificates`
#[utoipa::path(
    post,
    path = "/certificates",
    operation_id = "getCourseStudentsCertificates",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    request_body = UserIdsPayload,
    responses(
        (status = 200, description = "Course certificates for the given users", body = [CertificateGridRow])
    )
)]
#[instrument(skip(pool))]
async fn get_certificates(
    course_id: web::Path<Uuid>,
    payload: web::Json<UserIdsPayload>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<CertificateGridRow>>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    let rows = headless_lms_models::library::students_view::get_certificates_grid_for_users(
        &mut conn,
        *course_id,
        &payload.user_ids,
    )
    .await?;

    token.authorized_ok(web::Json(rows))
}

/// POST `/api/v0/main-frontend/courses/{course_id}/students/{user_id}/chapters/{chapter_id}/lock`
#[utoipa::path(
    post,
    path = "/{user_id}/chapters/{chapter_id}/lock",
    operation_id = "teacherLockStudentChapter",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("user_id" = Uuid, Path, description = "Target student id"),
        ("chapter_id" = Uuid, Path, description = "Chapter id")
    ),
    responses(
        (status = 200, description = "Updated chapter locking status", body = UserChapterLockingStatus)
    )
)]
#[instrument(skip(pool))]
async fn teacher_lock_student_chapter(
    path: web::Path<(Uuid, Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<UserChapterLockingStatus>> {
    let (course_id, target_user_id, chapter_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;

    let chapter = models::chapters::get_chapter(&mut conn, chapter_id).await?;
    if chapter.course_id != course_id {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Chapter does not belong to the course.".to_string(),
            None,
        ));
    }
    let course = models::courses::get_course(&mut conn, course_id).await?;
    if !course.chapter_locking_enabled {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Chapter locking is not enabled for this course.".to_string(),
            None,
        ));
    }

    models::user_details::get_user_details_by_user_id_for_course(
        &mut conn,
        target_user_id,
        course_id,
    )
    .await?;

    let mut tx = conn.begin().await?;
    let status = models::user_chapter_locking_statuses::complete_and_lock_chapter(
        &mut tx,
        target_user_id,
        chapter_id,
        course_id,
    )
    .await?;
    chapter_lock_action_logs::insert(
        &mut tx,
        Some(user.id),
        target_user_id,
        course_id,
        chapter_id,
        status.status,
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(status))
}

/// POST `/api/v0/main-frontend/courses/{course_id}/students/{user_id}/chapters/{chapter_id}/unlock`
#[utoipa::path(
    post,
    path = "/{user_id}/chapters/{chapter_id}/unlock",
    operation_id = "teacherUnlockStudentChapter",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("user_id" = Uuid, Path, description = "Target student id"),
        ("chapter_id" = Uuid, Path, description = "Chapter id")
    ),
    responses(
        (status = 200, description = "Updated chapter locking status", body = UserChapterLockingStatus)
    )
)]
#[instrument(skip(pool))]
async fn teacher_unlock_student_chapter(
    path: web::Path<(Uuid, Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<UserChapterLockingStatus>> {
    let (course_id, target_user_id, chapter_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;

    let chapter = models::chapters::get_chapter(&mut conn, chapter_id).await?;
    if chapter.course_id != course_id {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Chapter does not belong to the course.".to_string(),
            None,
        ));
    }
    let course = models::courses::get_course(&mut conn, course_id).await?;
    if !course.chapter_locking_enabled {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Chapter locking is not enabled for this course.".to_string(),
            None,
        ));
    }

    models::user_details::get_user_details_by_user_id_for_course(
        &mut conn,
        target_user_id,
        course_id,
    )
    .await?;

    let mut tx = conn.begin().await?;
    let status = models::user_chapter_locking_statuses::unlock_chapter(
        &mut tx,
        target_user_id,
        chapter_id,
        course_id,
    )
    .await?;
    chapter_lock_action_logs::insert(
        &mut tx,
        Some(user.id),
        target_user_id,
        course_id,
        chapter_id,
        status.status,
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(status))
}

/// POST `/api/v0/main-frontend/courses/{course_id}/students/{user_id}/chapters/{chapter_id}/status`
#[utoipa::path(
    post,
    path = "/{user_id}/chapters/{chapter_id}/status",
    operation_id = "teacherSetStudentChapterStatus",
    tag = "course-students",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("user_id" = Uuid, Path, description = "Target student id"),
        ("chapter_id" = Uuid, Path, description = "Chapter id")
    ),
    request_body = ChapterLockStatusActionPayload,
    responses(
        (status = 200, description = "Updated chapter locking status", body = UserChapterLockingStatus)
    )
)]
#[instrument(skip(pool))]
async fn teacher_set_student_chapter_status(
    path: web::Path<(Uuid, Uuid, Uuid)>,
    payload: web::Json<ChapterLockStatusActionPayload>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<UserChapterLockingStatus>> {
    let (course_id, target_user_id, chapter_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;

    let chapter = models::chapters::get_chapter(&mut conn, chapter_id).await?;
    if chapter.course_id != course_id {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Chapter does not belong to the course.".to_string(),
            None,
        ));
    }
    let course = models::courses::get_course(&mut conn, course_id).await?;
    if !course.chapter_locking_enabled {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Chapter locking is not enabled for this course.".to_string(),
            None,
        ));
    }

    models::user_details::get_user_details_by_user_id_for_course(
        &mut conn,
        target_user_id,
        course_id,
    )
    .await?;

    let mut tx = conn.begin().await?;
    let status = models::user_chapter_locking_statuses::set_chapter_status(
        &mut tx,
        target_user_id,
        chapter_id,
        course_id,
        payload.status,
    )
    .await?;
    chapter_lock_action_logs::insert(
        &mut tx,
        Some(user.id),
        target_user_id,
        course_id,
        chapter_id,
        status.status,
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(status))
}

pub fn _add_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/progress", web::post().to(get_progress));
    cfg.route(
        "/{user_id}/chapter-locking-statuses",
        web::get().to(get_user_chapter_locking_statuses),
    );
    cfg.route("/users", web::get().to(get_course_users));
    cfg.route("/completions", web::post().to(get_completions));
    cfg.route("/certificates", web::post().to(get_certificates));
    cfg.route(
        "/{user_id}/chapters/{chapter_id}/lock",
        web::post().to(teacher_lock_student_chapter),
    );
    cfg.route(
        "/{user_id}/chapters/{chapter_id}/unlock",
        web::post().to(teacher_unlock_student_chapter),
    );
    cfg.route(
        "/{user_id}/chapters/{chapter_id}/status",
        web::post().to(teacher_set_student_chapter_status),
    );
}
