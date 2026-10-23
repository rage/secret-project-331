//! Who may use a tool on a course: the token's scopes are checked by dispatch, the teacher's live
//! roles here, with the same `authorize` check the web UI's course editing uses.

use headless_lms_authorization::{Action, Resource, authorize};
use headless_lms_models::{courses, courses::Course, error::TryToOptional};
use sqlx::{PgConnection, Postgres, pool::PoolConnection};
use uuid::Uuid;

use crate::course_state::{CourseView, load_view};
use crate::state::McpState;
use crate::tools::{RequestContext, ToolError, parse_id};

/// The course, if it exists and the user may edit it.
pub async fn authorize_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> Result<Course, ToolError> {
    let course = courses::get_course(conn, course_id)
        .await
        .optional()?
        .filter(|c| c.deleted_at.is_none())
        .ok_or_else(|| ToolError::NotFound {
            message: format!("no course {course_id}; list_courses shows the courses you can edit"),
        })?;
    authorize(
        conn,
        Action::Edit,
        Some(user_id),
        Resource::Course(course_id),
    )
    .await?;
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
            retry_after_seconds: Some(1),
        })
}

/// Authorizes the course argument and loads the course as the user sees it.
pub async fn open_course(
    state: &McpState,
    ctx: &RequestContext,
    course: &str,
) -> Result<(PoolConnection<Postgres>, CourseView), ToolError> {
    let course_id = parse_id(course, "course")?;
    let mut conn = connection(state).await?;
    let course = authorize_course(&mut conn, ctx.principal.user_id, course_id).await?;
    let view = load_view(&mut conn, ctx.principal.user_id, course).await?;
    Ok((conn, view))
}

/// The page id argument, checked to belong to the course (as staged or as published).
pub fn page_in_course(view: &CourseView, page: &str) -> Result<Uuid, ToolError> {
    let page_id = parse_id(page, "page")?;
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
