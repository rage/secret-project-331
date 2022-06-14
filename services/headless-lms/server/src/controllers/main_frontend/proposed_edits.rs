use models::proposed_page_edits::{self, EditProposalInfo, PageProposal, ProposalCount};

use crate::controllers::prelude::*;

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GetEditProposalsQuery {
    pending: bool,
    #[serde(flatten)]
    pagination: Pagination,
}

/**
GET `/api/v0/main-frontend/proposed-edits/course/:id?pending=true` - Returns feedback for the given course.
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn get_edit_proposals(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    query: web::Query<GetEditProposalsQuery>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<PageProposal>>> {
    let mut conn = pool.acquire().await?;

    let feedback = proposed_page_edits::get_proposals_for_course(
        &mut conn,
        *course_id,
        query.pending,
        query.pagination,
    )
    .await?;

    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    token.authorized_ok(web::Json(feedback))
}

/**
GET `/api/v0/main-frontend/proposed-edits/course/:id/count` - Returns the amount of feedback for the given course.
*/
#[generated_doc]
#[instrument(skip(pool))]
pub async fn get_edit_proposal_count(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<ProposalCount>> {
    let mut conn = pool.acquire().await?;

    let edit_proposal_count =
        proposed_page_edits::get_proposal_count_for_course(&mut conn, *course_id).await?;

    let token = authorize(
        &mut conn,
        Act::Teach,
        Some(user.id),
        Res::Course(*course_id),
    )
    .await?;
    token.authorized_ok(web::Json(edit_proposal_count))
}

/**
POST `/api/v0/main-frontend/proposed-edits/process-edit-proposal` - Processes the given edit proposal.
*/
#[instrument(skip(pool))]
pub async fn process_edit_proposal(
    proposal: web::Json<EditProposalInfo>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<HttpResponse> {
    let mut conn = pool.acquire().await?;
    let proposal = proposal.into_inner();

    proposed_page_edits::process_proposal(
        &mut conn,
        proposal.page_id,
        proposal.page_proposal_id,
        proposal.block_proposals,
        user.id,
    )
    .await?;

    let token = authorize(
        &mut conn,
        Act::Edit,
        Some(user.id),
        Res::Page(proposal.page_id),
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
