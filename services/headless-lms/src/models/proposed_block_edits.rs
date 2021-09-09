use super::proposed_page_edits;
use crate::{
    domain::merge_edits,
    models::{pages::PageUpdate, ModelError, ModelResult},
};
use anyhow::Context;
use serde::{Deserialize, Serialize};
use sqlx::{Connection, PgConnection};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct NewProposedBlockEdits {
    pub block_id: Uuid,
    pub block_attribute: String,
    pub original_text: String,
    pub changed_text: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS, sqlx::Type)]
#[sqlx(type_name = "proposal_status", rename_all = "lowercase")]
pub enum ProposalStatus {
    Pending,
    Accepted,
    Rejected,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct BlockProposal {
    pub id: Uuid,
    pub block_id: Uuid,
    pub current_text: String,
    pub changed_text: String,
    pub status: ProposalStatus,
    pub accept_preview: Option<String>,
}

pub async fn accept_block_edits(
    conn: &mut PgConnection,
    page_id: Uuid,
    page_proposal_id: Uuid,
    block_proposal_ids: &[Uuid],
    author: Uuid,
) -> ModelResult<()> {
    if block_proposal_ids.is_empty() {
        return Err(ModelError::Generic(
            "No block proposals to accept".to_string(),
        ));
    }

    let mut tx = conn.begin().await?;
    let page = crate::models::pages::get_page(&mut tx, page_id).await?;
    let mut blocks = page.blocks_cloned()?;
    for block_proposal_id in block_proposal_ids {
        let res = sqlx::query!(
            "
UPDATE proposed_block_edits
SET status = 'accepted'
WHERE id = $1
RETURNING block_id,
block_attribute,
original_text,
changed_text
",
            block_proposal_id
        )
        .fetch_one(&mut tx)
        .await?;
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
    }

    let updated_content = serde_json::to_value(&blocks)?;

    let page_update = PageUpdate {
        content: updated_content,
        url_path: page.url_path,
        title: page.title,
        chapter_id: page.chapter_id,
    };
    crate::models::pages::update_page(&mut tx, page.id, page_update, author, true).await?;

    proposed_page_edits::update_page_edit_status(&mut tx, page_proposal_id).await?;

    tx.commit().await?;
    Ok(())
}

pub async fn reject_block_edits(
    conn: &mut PgConnection,
    page_proposal_id: Uuid,
    block_proposal_ids: &[Uuid],
) -> ModelResult<()> {
    if block_proposal_ids.is_empty() {
        return Err(ModelError::Generic(
            "No block proposals to reject".to_string(),
        ));
    }

    let mut tx = conn.begin().await?;
    for block_proposal_id in block_proposal_ids {
        sqlx::query!(
            "
UPDATE proposed_block_edits
SET status = 'rejected'
WHERE id = $1
  ",
            block_proposal_id
        )
        .execute(&mut tx)
        .await?;
    }

    proposed_page_edits::update_page_edit_status(&mut tx, page_proposal_id).await?;

    tx.commit().await?;
    Ok(())
}
