use crate::{
    controllers::ControllerResult,
    domain::authorization::AuthUser,
    models::{
        proposed_block_edits::{self, BlockProposalInfo},
        proposed_page_edits::{self, PageProposal, ProposalCount},
    },
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
) -> ControllerResult<Json<Vec<PageProposal>>> {
    let mut conn = pool.acquire().await?;
    let course_id = course_id.into_inner();

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
) -> ControllerResult<Json<ProposalCount>> {
    let mut conn = pool.acquire().await?;
    let course_id = course_id.into_inner();

    let edit_proposal_count =
        proposed_page_edits::get_proposal_count_for_course(&mut conn, course_id).await?;
    Ok(Json(edit_proposal_count))
}

/**
POST `/api/v0/main-frontend/proposed-edits/accept-block-proposals` - Accepts the given block proposals.
*/
#[instrument(skip(pool))]
pub async fn accept_block_proposals(
    block_proposals: Json<BlockProposalInfo>,
    auth: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    proposed_block_edits::accept_block_edits(
        &mut conn,
        block_proposals.page_id,
        block_proposals.page_proposal_id,
        &block_proposals.block_proposal_ids,
        auth.id,
    )
    .await?;
    Ok(HttpResponse::Ok().finish())
}

/**
POST `/api/v0/main-frontend/proposed-edits/reject-block-proposals` - Rejects the given block proposals.
*/
#[instrument(skip(pool))]
pub async fn reject_block_proposals(
    block_proposals: Json<BlockProposalInfo>,
    auth: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    proposed_block_edits::reject_block_edits(
        &mut conn,
        block_proposals.page_proposal_id,
        &block_proposals.block_proposal_ids,
    )
    .await?;
    Ok(HttpResponse::Ok().finish())
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_proposed_edits_routes(cfg: &mut ServiceConfig) {
    cfg.route("/course/{course_id}", web::get().to(get_edit_proposals))
        .route(
            "/course/{course_id}/count",
            web::get().to(get_edit_proposal_count),
        )
        .route(
            "/accept-block-proposals",
            web::post().to(accept_block_proposals),
        )
        .route(
            "/reject-block-proposals",
            web::post().to(reject_block_proposals),
        );
}
