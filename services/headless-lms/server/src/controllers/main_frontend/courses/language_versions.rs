//! Controllers for requests starting with `/api/v0/main-frontend/courses/{course_id}/language-versions`.

use std::collections::HashSet;

use models::{
    agent_changesets,
    courses::Course,
    library::language_versions::{
        counterpart, detection, dismissals, join_candidates,
        linking::{self, LinkedItemKind},
        membership::{self, MembershipChange},
        snapshot::{self, LanguageGroupSnapshot, StudentCounts},
        structure, suggestions,
        types::{
            CounterpartLinksRequest, CounterpartLinksResult, CreateCounterpartRequest,
            CreateCounterpartResult, ExerciseCounterparts, JoinCandidate,
            JoinLanguageVersionPreview, JoinLanguageVersionRequest, JoinLanguageVersionResult,
            LanguageVersionCourse, LanguageVersionReport, LanguageVersionStructure,
            LinkSuggestions, NewProblemDismissal, ProblemDismissal, RemoveLeftoverLinksRequest,
            RemoveLeftoverLinksResult, SplitLanguageVersionPreview, SplitLanguageVersionRequest,
            SplitLanguageVersionResult,
        },
    },
    roles::Role,
};
use utoipa::{IntoParams, OpenApi};

use super::stats;
use crate::{
    domain::{
        authorization::{
            AuthorizationToken, authorize_with_fetched_list_of_roles, fetch_user_roles,
            is_permitted,
        },
        models_requests::{self, JwtKey},
    },
    prelude::*,
};

#[derive(OpenApi)]
#[openapi(paths(
    get_language_versions,
    get_report,
    get_structure,
    get_suggestions,
    post_page_links,
    post_exercise_links,
    post_remove_leftover_links,
    post_dismissal,
    delete_dismissal,
    get_join_candidates,
    get_join_preview,
    post_join,
    get_split_preview,
    post_split,
    post_counterpart,
    get_exercise_counterparts
))]
pub(crate) struct MainFrontendCourseLanguageVersionsApiDoc;

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
struct SuggestionsQuery {
    /// Only this chapter number; all chapters when absent.
    chapter_number: Option<i32>,
    /// Courses outside the language versions to include, for matching before a join.
    candidate_course_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
struct JoinCandidatesQuery {
    /// Name or slug; without it, only courses that look like translations are returned.
    search: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
struct DismissalQuery {
    problem_key: String,
}

/// Sets `can_edit` on each course for the user with `roles`. Returns whether the user can edit
/// all of them, which fixes across the language versions need.
pub(crate) async fn fill_can_edit<'a>(
    conn: &mut PgConnection,
    roles: &[Role],
    courses: impl IntoIterator<Item = &'a mut LanguageVersionCourse>,
) -> Result<bool, ControllerError> {
    let mut can_edit_all = true;
    for course in courses {
        course.can_edit = is_permitted(conn, Act::Edit, Res::Course(course.id), roles).await?;
        can_edit_all &= course.can_edit;
    }
    Ok(can_edit_all)
}

/// The group's join candidates the user can edit, with `can_edit` set.
async fn get_editable_join_candidates(
    conn: &mut PgConnection,
    roles: &[Role],
    snapshot: &LanguageGroupSnapshot,
    search: Option<&str>,
) -> Result<Vec<JoinCandidate>, ControllerError> {
    let mut candidates = join_candidates::get_join_candidates(conn, snapshot, search).await?;
    fill_can_edit(conn, roles, candidates.iter_mut().map(|c| &mut c.course)).await?;
    candidates.retain(|c| c.course.can_edit);
    Ok(candidates)
}

/// Requires `Edit` on every live course in `course_id`'s language group and on
/// `additional_course_id`: fixes change links or student data across all of them. Returns the
/// group's id.
pub(crate) async fn authorize_edit_on_language_versions(
    conn: &mut PgConnection,
    roles: &[Role],
    course_id: Uuid,
    additional_course_id: Option<Uuid>,
) -> Result<(AuthorizationToken, Uuid), ControllerError> {
    let token =
        authorize_with_fetched_list_of_roles(conn, Act::Edit, Res::Course(course_id), roles)
            .await?;
    let course_language_group_id =
        models::courses::get_course_language_group_id(conn, course_id).await?;
    let language_versions =
        models::courses::get_by_course_language_group_ids(conn, &[course_language_group_id])
            .await?;
    for other_course_id in language_versions
        .iter()
        .map(|c| c.id)
        .chain(additional_course_id)
        .filter(|id| *id != course_id)
    {
        authorize_with_fetched_list_of_roles(conn, Act::Edit, Res::Course(other_course_id), roles)
            .await?;
    }
    Ok((token, course_language_group_id))
}

/// An authorized request on a course's language versions.
struct LanguageVersionsRequest {
    token: AuthorizationToken,
    course_language_group_id: Uuid,
    roles: Vec<Role>,
}

/// Authorizes a read: `Edit` on the course is enough, as `can_edit` per course tells which fixes
/// the user may apply.
async fn authorize_read(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<LanguageVersionsRequest, ControllerError> {
    let roles = fetch_user_roles(conn, Some(user_id)).await?;
    let token =
        authorize_with_fetched_list_of_roles(conn, Act::Edit, Res::Course(course_id), &roles)
            .await?;
    let course_language_group_id =
        models::courses::get_course_language_group_id(conn, course_id).await?;
    Ok(LanguageVersionsRequest {
        token,
        course_language_group_id,
        roles,
    })
}

/// Authorizes a fix with [authorize_edit_on_language_versions].
async fn authorize_fix(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
    additional_course_id: Option<Uuid>,
) -> Result<LanguageVersionsRequest, ControllerError> {
    let roles = fetch_user_roles(conn, Some(user_id)).await?;
    let (token, course_language_group_id) =
        authorize_edit_on_language_versions(conn, &roles, course_id, additional_course_id).await?;
    Ok(LanguageVersionsRequest {
        token,
        course_language_group_id,
        roles,
    })
}

/// Loads the group with `can_edit` filled in for the user with `roles`; returns whether the user
/// can edit every course.
pub(crate) async fn load_snapshot(
    conn: &mut PgConnection,
    roles: &[Role],
    course_language_group_id: Uuid,
    candidate_course_ids: &[Uuid],
    student_counts: StudentCounts,
) -> Result<(LanguageGroupSnapshot, bool), ControllerError> {
    let mut snapshot = snapshot::load_with_candidates(
        conn,
        course_language_group_id,
        candidate_course_ids,
        student_counts,
    )
    .await?;
    let can_edit_all_courses = fill_can_edit(conn, roles, snapshot.courses.iter_mut()).await?;
    Ok((snapshot, can_edit_all_courses))
}

/// Drops what a join or split made stale.
async fn after_membership_change<T>(cache: &Cache, change: &MembershipChange<T>) {
    for course_language_group_id in change.changed_course_language_group_ids {
        stats::invalidate_all_language_versions_stats(cache, course_language_group_id).await;
    }
}

/**
GET `/api/v0/main-frontend/courses/:id/language-versions` - Returns all language versions of the same course.
*/
#[utoipa::path(
    get,
    path = "",
    operation_id = "getCourseLanguageVersions",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id")),
    responses((status = 200, description = "Course language versions", body = [Course]))
)]
#[instrument(skip(pool))]
async fn get_language_versions(
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
GET `/api/v0/main-frontend/courses/:id/language-versions/report` - Checks the language versions for problems.

Needs `Edit` on this course only; `can_edit` per course tells which fixes the user may apply.
*/
#[utoipa::path(
    get,
    path = "/report",
    operation_id = "getLanguageVersionReport",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id")),
    responses((status = 200, description = "Problems found in the language versions", body = LanguageVersionReport))
)]
#[instrument(skip(pool))]
async fn get_report(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<LanguageVersionReport>> {
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        roles,
    } = authorize_read(&mut conn, user.id, *course_id).await?;
    let (snapshot, can_edit_all_courses) = load_snapshot(
        &mut conn,
        &roles,
        course_language_group_id,
        &[],
        StudentCounts::Include,
    )
    .await?;
    let lineage = suggestions::get_copy_lineage(&mut conn, &snapshot).await?;
    let dismissals =
        dismissals::get_by_course_language_group_id(&mut conn, course_language_group_id).await?;
    let join_candidates = get_editable_join_candidates(&mut conn, &roles, &snapshot, None).await?;
    let problems = detection::detect_problems(&snapshot, &lineage, &dismissals, &join_candidates);

    let courses = snapshot.courses;
    let course_ids: Vec<Uuid> = courses.iter().map(|c| c.id).collect();
    let with_open_changesets: HashSet<Uuid> =
        agent_changesets::get_course_ids_with_open_changesets(&mut conn, &course_ids)
            .await?
            .into_iter()
            .collect();
    token.authorized_ok(web::Json(LanguageVersionReport {
        course_language_group_id,
        can_edit_all_courses,
        courses_with_open_agent_changesets: course_ids
            .into_iter()
            .filter(|id| with_open_changesets.contains(id))
            .collect(),
        courses,
        problems,
        checked_at: Utc::now(),
    }))
}

/**
GET `/api/v0/main-frontend/courses/:id/language-versions/structure` - The language versions' chapters, pages and exercises side by side.
*/
#[utoipa::path(
    get,
    path = "/structure",
    operation_id = "getLanguageVersionStructure",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id")),
    responses((status = 200, description = "Structure comparison", body = LanguageVersionStructure))
)]
#[instrument(skip(pool))]
async fn get_structure(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<LanguageVersionStructure>> {
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        roles,
    } = authorize_read(&mut conn, user.id, *course_id).await?;
    let (snapshot, _) = load_snapshot(
        &mut conn,
        &roles,
        course_language_group_id,
        &[],
        StudentCounts::Omit,
    )
    .await?;
    token.authorized_ok(web::Json(structure::build_structure(&snapshot, *course_id)))
}

/**
GET `/api/v0/main-frontend/courses/:id/language-versions/suggestions` - Suggested counterparts for this course's pages and exercises.

Candidate courses outside the language versions need `Edit` too.
*/
#[utoipa::path(
    get,
    path = "/suggestions",
    operation_id = "getLanguageVersionSuggestions",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id"), SuggestionsQuery),
    responses((status = 200, description = "Suggested links", body = LinkSuggestions))
)]
#[instrument(skip(pool))]
async fn get_suggestions(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    query: MultiQuery<SuggestionsQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<LinkSuggestions>> {
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        roles,
    } = authorize_read(&mut conn, user.id, *course_id).await?;
    let candidate_course_ids = query.candidate_course_ids.clone().unwrap_or_default();
    for candidate_course_id in &candidate_course_ids {
        authorize_with_fetched_list_of_roles(
            &mut conn,
            Act::Edit,
            Res::Course(*candidate_course_id),
            &roles,
        )
        .await?;
    }
    let (snapshot, _) = load_snapshot(
        &mut conn,
        &roles,
        course_language_group_id,
        &candidate_course_ids,
        StudentCounts::Omit,
    )
    .await?;
    let lineage = suggestions::get_copy_lineage(&mut conn, &snapshot).await?;
    let res = suggestions::suggest_links(&snapshot, &lineage, *course_id, query.chapter_number)?;
    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/main-frontend/courses/:id/language-versions/page-links` - Links or unlinks pages across the language versions.
*/
#[utoipa::path(
    post,
    path = "/page-links",
    operation_id = "postLanguageVersionPageLinks",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id")),
    request_body = CounterpartLinksRequest,
    responses((status = 200, description = "Links changed", body = CounterpartLinksResult))
)]
#[instrument(skip(pool))]
async fn post_page_links(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<CounterpartLinksRequest>,
    user: AuthUser,
) -> ControllerResult<web::Json<CounterpartLinksResult>> {
    post_links(pool, *course_id, &payload, user, LinkedItemKind::Page).await
}

/**
POST `/api/v0/main-frontend/courses/:id/language-versions/exercise-links` - Links or unlinks exercises across the language versions.
*/
#[utoipa::path(
    post,
    path = "/exercise-links",
    operation_id = "postLanguageVersionExerciseLinks",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id")),
    request_body = CounterpartLinksRequest,
    responses((status = 200, description = "Links changed", body = CounterpartLinksResult))
)]
#[instrument(skip(pool))]
async fn post_exercise_links(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<CounterpartLinksRequest>,
    user: AuthUser,
) -> ControllerResult<web::Json<CounterpartLinksResult>> {
    post_links(pool, *course_id, &payload, user, LinkedItemKind::Exercise).await
}

async fn post_links(
    pool: web::Data<PgPool>,
    course_id: Uuid,
    payload: &CounterpartLinksRequest,
    user: AuthUser,
    kind: LinkedItemKind,
) -> ControllerResult<web::Json<CounterpartLinksResult>> {
    let mut conn = pool.acquire().await?;
    let request = authorize_fix(&mut conn, user.id, course_id, None).await?;
    let res = linking::apply_link_changes(
        &mut conn,
        kind,
        request.course_language_group_id,
        user.id,
        &payload.changes,
    )
    .await?;
    request.token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/main-frontend/courses/:id/language-versions/remove-leftover-links` - Removes links to deleted pages and exercises.
*/
#[utoipa::path(
    post,
    path = "/remove-leftover-links",
    operation_id = "postLanguageVersionRemoveLeftoverLinks",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id")),
    request_body = RemoveLeftoverLinksRequest,
    responses((status = 200, description = "Leftover links removed", body = RemoveLeftoverLinksResult))
)]
#[instrument(skip(pool))]
async fn post_remove_leftover_links(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<RemoveLeftoverLinksRequest>,
    user: AuthUser,
) -> ControllerResult<web::Json<RemoveLeftoverLinksResult>> {
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        ..
    } = authorize_fix(&mut conn, user.id, *course_id, None).await?;
    let res =
        linking::remove_leftover_links(&mut conn, course_language_group_id, user.id, &payload)
            .await?;
    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/main-frontend/courses/:id/language-versions/dismissals` - Marks a problem as intended.
*/
#[utoipa::path(
    post,
    path = "/dismissals",
    operation_id = "postLanguageVersionProblemDismissal",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id")),
    request_body = NewProblemDismissal,
    responses((status = 200, description = "Problem marked as intended", body = ProblemDismissal))
)]
#[instrument(skip(pool))]
async fn post_dismissal(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<NewProblemDismissal>,
    user: AuthUser,
) -> ControllerResult<web::Json<ProblemDismissal>> {
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        ..
    } = authorize_fix(&mut conn, user.id, *course_id, None).await?;
    let res = dismissals::upsert(&mut conn, course_language_group_id, user.id, &payload).await?;
    token.authorized_ok(web::Json(res))
}

/**
DELETE `/api/v0/main-frontend/courses/:id/language-versions/dismissals?problem_key=...` - Reports a dismissed problem again.
*/
#[utoipa::path(
    delete,
    path = "/dismissals",
    operation_id = "deleteLanguageVersionProblemDismissal",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id"), DismissalQuery),
    responses((status = 200, description = "Dismissal removed"))
)]
#[instrument(skip(pool))]
async fn delete_dismissal(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    query: web::Query<DismissalQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        ..
    } = authorize_fix(&mut conn, user.id, *course_id, None).await?;
    dismissals::delete(&mut conn, course_language_group_id, &query.problem_key).await?;
    token.authorized_ok(web::Json(()))
}

/**
GET `/api/v0/main-frontend/courses/:id/language-versions/join-candidates` - Courses that could join the language versions.

Only courses the user can edit are returned.
*/
#[utoipa::path(
    get,
    path = "/join-candidates",
    operation_id = "getLanguageVersionJoinCandidates",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id"), JoinCandidatesQuery),
    responses((status = 200, description = "Join candidates", body = [JoinCandidate]))
)]
#[instrument(skip(pool))]
async fn get_join_candidates(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    query: web::Query<JoinCandidatesQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<JoinCandidate>>> {
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        roles,
    } = authorize_read(&mut conn, user.id, *course_id).await?;
    let snapshot = snapshot::load(&mut conn, course_language_group_id, StudentCounts::Omit).await?;
    let res =
        get_editable_join_candidates(&mut conn, &roles, &snapshot, query.search.as_deref()).await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/language-versions/join-preview/:joined_course_id` - What joining the course would change.
*/
#[utoipa::path(
    get,
    path = "/join-preview/{joined_course_id}",
    operation_id = "getLanguageVersionJoinPreview",
    tag = "course-language-versions",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("joined_course_id" = Uuid, Path, description = "Course to join into the language versions")
    ),
    responses((status = 200, description = "Join preview", body = JoinLanguageVersionPreview))
)]
#[instrument(skip(pool))]
async fn get_join_preview(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    user: AuthUser,
) -> ControllerResult<web::Json<JoinLanguageVersionPreview>> {
    let (course_id, joined_course_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        roles,
    } = authorize_fix(&mut conn, user.id, course_id, Some(joined_course_id)).await?;
    let mut res =
        membership::join_preview(&mut conn, course_language_group_id, joined_course_id).await?;
    fill_can_edit(
        &mut conn,
        &roles,
        std::iter::once(&mut res.course)
            .chain(res.language_versions.iter_mut())
            .chain(res.left_language_versions.iter_mut()),
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/main-frontend/courses/:id/language-versions/join` - Joins a course into the language versions, moving its students' data.
*/
#[utoipa::path(
    post,
    path = "/join",
    operation_id = "postLanguageVersionJoin",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id")),
    request_body = JoinLanguageVersionRequest,
    responses((status = 200, description = "Course joined", body = JoinLanguageVersionResult))
)]
#[instrument(skip(pool, cache))]
async fn post_join(
    pool: web::Data<PgPool>,
    cache: web::Data<Cache>,
    course_id: web::Path<Uuid>,
    payload: web::Json<JoinLanguageVersionRequest>,
    user: AuthUser,
) -> ControllerResult<web::Json<JoinLanguageVersionResult>> {
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        ..
    } = authorize_fix(&mut conn, user.id, *course_id, Some(payload.course_id)).await?;
    let change =
        membership::join_course(&mut conn, course_language_group_id, user.id, &payload).await?;
    after_membership_change(&cache, &change).await;
    token.authorized_ok(web::Json(change.result))
}

/**
GET `/api/v0/main-frontend/courses/:id/language-versions/split-preview/:split_course_id` - What removing the course from the language versions would change.
*/
#[utoipa::path(
    get,
    path = "/split-preview/{split_course_id}",
    operation_id = "getLanguageVersionSplitPreview",
    tag = "course-language-versions",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("split_course_id" = Uuid, Path, description = "Course to remove from the language versions")
    ),
    responses((status = 200, description = "Split preview", body = SplitLanguageVersionPreview))
)]
#[instrument(skip(pool))]
async fn get_split_preview(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    user: AuthUser,
) -> ControllerResult<web::Json<SplitLanguageVersionPreview>> {
    let (course_id, split_course_id) = path.into_inner();
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        roles,
    } = authorize_fix(&mut conn, user.id, course_id, Some(split_course_id)).await?;
    let mut res =
        membership::split_preview(&mut conn, course_language_group_id, split_course_id).await?;
    fill_can_edit(
        &mut conn,
        &roles,
        std::iter::once(&mut res.course).chain(res.remaining_courses.iter_mut()),
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/main-frontend/courses/:id/language-versions/split` - Removes a course from the language versions, moving its students' data with it.
*/
#[utoipa::path(
    post,
    path = "/split",
    operation_id = "postLanguageVersionSplit",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id")),
    request_body = SplitLanguageVersionRequest,
    responses((status = 200, description = "Course split off", body = SplitLanguageVersionResult))
)]
#[instrument(skip(pool, cache))]
async fn post_split(
    pool: web::Data<PgPool>,
    cache: web::Data<Cache>,
    course_id: web::Path<Uuid>,
    payload: web::Json<SplitLanguageVersionRequest>,
    user: AuthUser,
) -> ControllerResult<web::Json<SplitLanguageVersionResult>> {
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        ..
    } = authorize_fix(&mut conn, user.id, *course_id, Some(payload.course_id)).await?;
    let change =
        membership::split_course(&mut conn, course_language_group_id, user.id, &payload).await?;
    after_membership_change(&cache, &change).await;
    token.authorized_ok(web::Json(change.result))
}

/**
POST `/api/v0/main-frontend/courses/:id/language-versions/counterparts` - Copies a page into another language version and links the copy.
*/
#[utoipa::path(
    post,
    path = "/counterparts",
    operation_id = "postLanguageVersionCounterpart",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id")),
    request_body = CreateCounterpartRequest,
    responses((status = 200, description = "Counterpart created and linked", body = CreateCounterpartResult))
)]
#[instrument(skip(pool, app_conf, jwt_key))]
async fn post_counterpart(
    request_id: RequestId,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    payload: web::Json<CreateCounterpartRequest>,
    jwt_key: web::Data<JwtKey>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: AuthUser,
) -> ControllerResult<web::Json<CreateCounterpartResult>> {
    let mut conn = pool.acquire().await?;
    let LanguageVersionsRequest {
        token,
        course_language_group_id,
        ..
    } = authorize_fix(&mut conn, user.id, *course_id, None).await?;
    let res = counterpart::create_counterpart(
        &mut conn,
        course_language_group_id,
        user.id,
        &payload,
        models_requests::make_spec_fetcher(
            app_conf.base_url.clone(),
            request_id.0,
            jwt_key.into_inner(),
        ),
        models_requests::fetch_service_info,
    )
    .await?;
    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/courses/:id/language-versions/exercise-counterparts` - Which exercises of this course lack counterparts.
*/
#[utoipa::path(
    get,
    path = "/exercise-counterparts",
    operation_id = "getLanguageVersionExerciseCounterparts",
    tag = "course-language-versions",
    params(("course_id" = Uuid, Path, description = "Course id")),
    responses((status = 200, description = "Missing exercise counterparts", body = ExerciseCounterparts))
)]
#[instrument(skip(pool))]
async fn get_exercise_counterparts(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<ExerciseCounterparts>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;
    let res = counterpart::get_exercise_counterparts(&mut conn, *course_id).await?;
    token.authorized_ok(web::Json(res))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_language_versions))
        .route("/report", web::get().to(get_report))
        .route("/structure", web::get().to(get_structure))
        .route("/suggestions", web::get().to(get_suggestions))
        .route("/page-links", web::post().to(post_page_links))
        .route("/exercise-links", web::post().to(post_exercise_links))
        .route(
            "/remove-leftover-links",
            web::post().to(post_remove_leftover_links),
        )
        .route("/dismissals", web::post().to(post_dismissal))
        .route("/dismissals", web::delete().to(delete_dismissal))
        .route("/join-candidates", web::get().to(get_join_candidates))
        .route(
            "/join-preview/{joined_course_id}",
            web::get().to(get_join_preview),
        )
        .route("/join", web::post().to(post_join))
        .route(
            "/split-preview/{split_course_id}",
            web::get().to(get_split_preview),
        )
        .route("/split", web::post().to(post_split))
        .route("/counterparts", web::post().to(post_counterpart))
        .route(
            "/exercise-counterparts",
            web::get().to(get_exercise_counterparts),
        );
}
