use crate::{
    controllers::ControllerResult,
    domain::authorization::{authorize, Action, AuthUser, Resource},
    models::proposed_page_edits::{self, EditProposalInfo, PageProposal, ProposalCount},
    utils::pagination::Pagination,
};
use actix_web::{
    web::{self, Json, ServiceConfig},
    HttpResponse,
};
use serde::Deserialize;
use sqlx::PgPool;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Deserialize, TS)]
pub struct GetEditProposalsQuery {
    pending: bool,
    #[serde(flatten)]
    pagination: Pagination,
}

/**
GET `/api/v0/main-frontend/proposed-edits/course/:id?pending=true` - Returns feedback for the given course.
*/
#[instrument(skip(pool))]
pub async fn get_edit_proposals(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    query: web::Query<GetEditProposalsQuery>,
    user: AuthUser,
) -> ControllerResult<Json<Vec<PageProposal>>> {
    let mut conn = pool.acquire().await?;
    let course_id = course_id.into_inner();
    authorize(
        &mut conn,
        Action::View,
        user.id,
        Resource::Course(course_id),
    )
    .await?;

    let feedback = proposed_page_edits::get_proposals_for_course(
        &mut conn,
        course_id,
        query.pending,
        &query.pagination,
    )
    .await?;
    Ok(Json(feedback))
}

/**
GET `/api/v0/main-frontend/proposed-edits/course/:id/count` - Returns the amount of feedback for the given course.
*/
#[instrument(skip(pool))]
pub async fn get_edit_proposal_count(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<ProposalCount>> {
    let mut conn = pool.acquire().await?;
    let course_id = course_id.into_inner();
    authorize(
        &mut conn,
        Action::View,
        user.id,
        Resource::Course(course_id),
    )
    .await?;

    let edit_proposal_count =
        proposed_page_edits::get_proposal_count_for_course(&mut conn, course_id).await?;
    Ok(Json(edit_proposal_count))
}

/**
POST `/api/v0/main-frontend/proposed-edits/process-edit-proposal` - Processes the given edit proposal.
*/
#[instrument(skip(pool))]
pub async fn process_edit_proposal(
    proposal: Json<EditProposalInfo>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let proposal = proposal.into_inner();
    authorize(
        &mut conn,
        Action::Edit,
        user.id,
        Resource::Page(proposal.page_id),
    )
    .await?;

    proposed_page_edits::process_proposal(
        &mut conn,
        proposal.page_id,
        proposal.page_proposal_id,
        proposal.block_proposals,
        user.id,
    )
    .await?;
    Ok(HttpResponse::Ok().finish())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/course/{course_id}", web::get().to(get_edit_proposals))
        .route(
            "/course/{course_id}/count",
            web::get().to(get_edit_proposal_count),
        )
        .route(
            "/process-edit-proposal",
            web::post().to(process_edit_proposal),
        );
}
