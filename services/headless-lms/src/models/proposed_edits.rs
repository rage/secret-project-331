use crate::{
    domain::merge_edits,
    models::{pages::PageUpdate, ModelResult},
    utils::pagination::Pagination,
};
use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Connection, PgConnection};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct NewProposedEdit {
    pub block_id: Uuid,
    pub original_text: String,
    pub changed_text: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    page_id: Uuid,
    user_id: Option<Uuid>,
    block_id: Uuid,
    original_text: &str,
    changed_text: &str,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO proposed_edits (
    course_id,
    user_id,
    block_id,
    original_text,
    changed_text
  )
VALUES ($1, $2, $3, $4, $5)
RETURNING id
",
        page_id,
        user_id,
        block_id,
        original_text,
        changed_text
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn accept(conn: &mut PgConnection, proposal_id: Uuid, author: Uuid) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    let res = sqlx::query!(
        "
UPDATE proposed_edits
SET status = 'accepted'
WHERE id = $1
RETURNING page_id, block_id, original_text, changed_text
",
        proposal_id
    )
    .fetch_one(&mut tx)
    .await?;
    let page = crate::models::pages::get_page(&mut tx, res.page_id).await?;
    let mut blocks = page.blocks_cloned()?;
    let block = blocks
        .iter_mut()
        .find(|b| b.client_id == res.block_id)
        .context("Failed to find block for edit proposal")?;
    let current_content = block
        .attributes
        .get_mut("content")
        .ok_or_else(|| anyhow::anyhow!("Edited block has no content"))?;
    let current_str = current_content
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("No content on edited block"))?;
    let merge = merge_edits::merge(&res.original_text, &res.changed_text, current_str)
        .ok_or_else(|| anyhow::anyhow!("Failed to merge edit proposal"))?;
    *current_content = serde_json::json!(merge);

    let updated_content = serde_json::to_value(&blocks)?;

    let page_update = PageUpdate {
        content: updated_content,
        url_path: page.url_path,
        title: page.title,
        chapter_id: page.chapter_id,
        front_page_of_chapter_id: None,
    };
    crate::models::pages::update_page(&mut tx, page.id, page_update, author, true).await?;

    tx.commit().await?;
    Ok(())
}

pub async fn reject(conn: &mut PgConnection, proposal_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE proposed_edits
SET status = 'rejected'
WHERE id = $1
",
        proposal_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS, sqlx::Type)]
#[sqlx(type_name = "proposal_status", rename_all = "lowercase")]
pub enum ProposalStatus {
    Pending,
    Accepted,
    Rejected,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct Proposal {
    user_id: Option<Uuid>,
    block_id: Uuid,
    original_text: String,
    changed_text: String,
    status: ProposalStatus,
    created_at: DateTime<Utc>,
}

pub async fn get_proposals_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    pagination: &Pagination,
) -> ModelResult<Vec<Proposal>> {
    let res = sqlx::query_as!(
        Proposal,
        r#"
SELECT user_id,
  block_id,
  original_text,
  changed_text,
  status as "status: ProposalStatus",
  created_at
FROM proposed_edits
WHERE course_id = $1
LIMIT $2
OFFSET $3
"#,
        course_id,
        pagination.limit(),
        pagination.offset(),
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct ProposalCount {
    pending: i64,
    accepted: i64,
    rejected: i64,
}

pub async fn get_proposal_count_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<ProposalCount> {
    let res = sqlx::query!(
        "
SELECT COUNT(*) filter (
    where status = 'pending'
  ) AS pending,
  COUNT(*) filter (
    where status = 'accepted'
  ) AS accepted,
  COUNT(*) filter (
    where status = 'rejected'
  ) AS rejected
FROM proposed_edits
WHERE course_id = $1
  AND deleted_at IS NULL
  ",
        course_id,
    )
    .fetch_one(conn)
    .await?;
    let count = ProposalCount {
        pending: res.pending.unwrap_or_default(),
        accepted: res.accepted.unwrap_or_default(),
        rejected: res.rejected.unwrap_or_default(),
    };
    Ok(count)
}
