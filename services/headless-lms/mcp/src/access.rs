//! Who may use a tool on a course: the token's scopes are checked by dispatch, the teacher's live
//! roles here, with the course-edit rule the web UI uses.

use headless_lms_authorization::{Action, fetch_user_roles, is_permitted_on_course};
use headless_lms_models::{courses, courses::Course, error::TryToOptional, page_language_groups};
use sqlx::{PgConnection, Postgres, pool::PoolConnection};
use uuid::Uuid;

use crate::engine::PageDocument;
use crate::snapshots::{self, PageFacts};
use crate::state::McpState;
use crate::tools::{RequestContext, ToolError};
use headless_lms_models::library::agent_changesets::course_state::{
    CourseParts, CourseState, CourseView, load_student_activity, load_view,
};

/// The course, if it exists and the user may edit it.
pub async fn authorize_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<Course, ToolError> {
    let course = courses::get_course(conn, course_id)
        .await
        .optional()?
        .ok_or_else(|| ToolError::NotFound {
            message: format!("no course {course_id}; list_courses shows the courses you can edit"),
        })?;
    let roles = fetch_user_roles(conn, Some(user_id)).await?;
    if !is_permitted_on_course(&roles, Action::Edit, course.id, course.organization_id) {
        return Err(ToolError::no_edit_rights());
    }
    Ok(course)
}

/// A pooled connection; a busy pool is a retryable error.
pub async fn connection(state: &McpState) -> Result<PoolConnection<Postgres>, ToolError> {
    state
        .pool
        .acquire()
        .await
        .map_err(|e| ToolError::Retryable {
            message: format!("the database is busy ({e}); the same call can be retried"),
            retry_after_seconds: 1,
        })
}

/// Authorizes the course argument and loads the course as the user sees it. The connection goes
/// back to the pool before the tool's own work; handlers that query again take one with
/// [`connection`].
pub async fn open_course(
    state: &McpState,
    ctx: &RequestContext,
    course_id: Uuid,
) -> Result<CourseView, ToolError> {
    open_course_parts(state, ctx, course_id, CourseParts::All).await
}

/// The live [`PageFacts`] of the course's pages.
pub async fn load_page_facts(state: &McpState, course_id: Uuid) -> Result<PageFacts, ToolError> {
    let mut conn = connection(state).await?;
    let activity = load_student_activity(&mut conn, course_id).await?;
    Ok(PageFacts {
        pages_with_submissions: activity.pages_with_submissions,
        page_language_groups: page_language_groups::get_by_course_id(&mut conn, course_id).await?,
    })
}

/// [`open_course`] loading only the parts of the course a tool reads.
pub async fn open_course_parts(
    state: &McpState,
    ctx: &RequestContext,
    course_id: Uuid,
    parts: CourseParts,
) -> Result<CourseView, ToolError> {
    let mut conn = connection(state).await?;
    let course = authorize_course(&mut conn, ctx.principal.actor.user_id, course_id).await?;
    Ok(load_view(&mut conn, ctx.principal.actor.user_id, course, parts).await?)
}

/// The page id argument, checked to belong to the course (as staged or as published).
pub fn page_in_course(view: &CourseView, page_id: Uuid) -> Result<Uuid, ToolError> {
    if view.staged.page(page_id).is_some() || view.live.page(page_id).is_some() {
        Ok(page_id)
    } else {
        Err(ToolError::NotFound {
            message: format!(
                "course {} has no page {page_id}; get_course_structure lists its pages",
                view.course.id
            ),
        })
    }
}

/// The page as `staged`, a state with the user's staged changes, has it.
pub fn staged_page_document(
    staged: &CourseState,
    page_id: Uuid,
) -> Result<PageDocument, ToolError> {
    snapshots::page_document(staged, page_id).ok_or_else(|| deleted_in_staged_changes(page_id))
}

/// The error for a page the user's staged changes delete.
pub fn deleted_in_staged_changes(page_id: Uuid) -> ToolError {
    ToolError::NotFound {
        message: format!("page {page_id} is deleted in your staged changes"),
    }
}
