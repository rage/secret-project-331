use models::feedback;
use utoipa::{OpenApi, ToSchema};

use crate::prelude::*;

#[derive(OpenApi)]
#[openapi(paths(mark_as_read))]
pub(crate) struct MainFrontendFeedbackApiDoc;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, ToSchema)]

pub struct MarkAsRead {
    read: bool,
}

/**
POST `/api/v0/main-frontend/feedback/:id` - Creates new feedback.
*/
#[utoipa::path(
    post,
    path = "/{feedback_id}",
    operation_id = "markFeedbackAsRead",
    tag = "feedback",
    params(
        ("feedback_id" = String, Path, description = "Feedback id")
    ),
    request_body = MarkAsRead,
    responses(
        (status = 200, description = "Feedback read state updated")
    )
)]
#[instrument(skip(pool))]
pub async fn mark_as_read(
    feedback_id: web::Path<Uuid>,
    mark_as_read: web::Json<MarkAsRead>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let feedback = feedback::get_by_id(&mut conn, *feedback_id).await?;
    let course_id = feedback
        .course_id
        .ok_or_else(|| controller_err!(Forbidden, "Feedback is not course-scoped".to_string()))?;
    let token = authorize(&mut conn, Act::Teach, Some(user.id), Res::Course(course_id)).await?;
    feedback::set_read_state_by_id_and_course_id(
        &mut conn,
        *feedback_id,
        course_id,
        mark_as_read.into_inner().read,
    )
    .await?;
    token.authorized_ok(HttpResponse::Ok().finish())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{feedback_id}", web::post().to(mark_as_read));
}
