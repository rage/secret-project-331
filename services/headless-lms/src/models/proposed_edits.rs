use std::collections::{hash_map::Entry, HashMap};

use crate::{
    domain::merge_edits,
    models::{pages::PageUpdate, ModelError, ModelResult},
    utils::{document_schema_processor::GutenbergBlock, pagination::Pagination},
};
use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Connection, PgConnection};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct NewProposedPageEdits {
    pub page_id: Uuid,
    pub block_edits: Vec<NewProposedBlockEdits>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct NewProposedBlockEdits {
    pub block_id: Uuid,
    pub block_attribute: String,
    pub original_text: String,
    pub changed_text: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_id: Option<Uuid>,
    edits: &NewProposedPageEdits,
) -> ModelResult<Uuid> {
    if edits.block_edits.is_empty() {
        return Err(ModelError::Generic("No block edits".to_string()));
    }

    let mut tx = conn.begin().await?;
    let page_res = sqlx::query!(
        "
INSERT INTO proposed_page_edits (course_id, page_id, user_id)
VALUES ($1, $2, $3)
RETURNING id
",
        course_id,
        edits.page_id,
        user_id,
    )
    .fetch_one(&mut tx)
    .await?;
    for block_edit in &edits.block_edits {
        sqlx::query!(
            "
INSERT INTO proposed_block_edits (
    proposal_id,
    block_id,
    block_attribute,
    original_text,
    changed_text
  )
VALUES ($1, $2, $3, $4, $5)
",
            page_res.id,
            block_edit.block_id,
            block_edit.block_attribute,
            block_edit.original_text,
            block_edit.changed_text
        )
        .execute(&mut tx)
        .await?;
    }
    tx.commit().await?;
    Ok(page_res.id)
}

pub async fn accept_block_edits(
    conn: &mut PgConnection,
    page_id: Uuid,
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
        front_page_of_chapter_id: None,
    };
    crate::models::pages::update_page(&mut tx, page.id, page_update, author, true).await?;

    tx.commit().await?;
    Ok(())
}

pub async fn reject_block_edits(
    conn: &mut PgConnection,
    block_proposal_ids: &[Uuid],
) -> ModelResult<()> {
    if block_proposal_ids.is_empty() {
        return Err(ModelError::Generic(
            "No block proposals to accept".to_string(),
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
    tx.commit().await?;
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
    page_proposal_id: Uuid,
    block_proposal_id: Uuid,
    user_id: Option<Uuid>,
    block_id: Uuid,
    original_text: String,
    changed_text: String,
    status: ProposalStatus,
    created_at: DateTime<Utc>,
    accept_preview: Option<String>,
}

pub async fn get_proposals_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    pagination: &Pagination,
) -> ModelResult<Vec<Proposal>> {
    let res = sqlx::query!(
        r#"
SELECT proposed_page_edits.id AS page_proposal_id,
  proposed_block_edits.id AS block_proposal_id,
  page_id,
  user_id,
  block_id,
  original_text,
  changed_text,
  status as "status: ProposalStatus",
  proposed_page_edits.created_at
FROM proposed_page_edits
JOIN proposed_block_edits ON proposed_page_edits.id = proposed_block_edits.proposal_id
WHERE course_id = $1
AND proposed_page_edits.deleted_at IS NULL
AND proposed_block_edits.deleted_at IS NULL
ORDER BY proposed_page_edits.created_at DESC, proposed_block_edits.id
LIMIT $2
OFFSET $3
"#,
        course_id,
        pagination.limit(),
        pagination.offset(),
    )
    .fetch_all(&mut *conn)
    .await?;

    let mut proposals = vec![];
    let mut pages = HashMap::new();
    for r in res {
        let content = match pages.entry(r.page_id) {
            Entry::Occupied(o) => o.into_mut(),
            Entry::Vacant(v) => {
                let page = crate::models::pages::get_page(&mut *conn, r.page_id).await?;
                let content: Vec<GutenbergBlock> = serde_json::from_value(page.content)?;
                v.insert(content)
            }
        };
        let block = content
            .iter()
            .find(|b| b.client_id == r.block_id)
            .context("Failed to find block that the edit was for")?;
        let content = block
            .attributes
            .get("content")
            .context("Missing content in edited block")?
            .as_str()
            .context("Content did not contain a string")?;
        proposals.push(Proposal {
            accept_preview: merge_edits::merge(&r.original_text, &r.changed_text, content),
            page_proposal_id: r.page_proposal_id,
            block_proposal_id: r.block_proposal_id,
            user_id: r.user_id,
            block_id: r.block_id,
            original_text: r.original_text,
            changed_text: r.changed_text,
            status: r.status,
            created_at: r.created_at,
        });
    }
    Ok(proposals)
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
FROM proposed_page_edits
JOIN proposed_block_edits ON proposed_page_edits.id = proposed_block_edits.proposal_id
WHERE proposed_page_edits.course_id = $1
AND proposed_page_edits.deleted_at IS NULL
AND proposed_block_edits.deleted_at IS NULL
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

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        attributes,
        test_helper::{insert_data, Conn, Data},
        utils::document_schema_processor::GutenbergBlock,
    };

    async fn init_content(conn: &mut PgConnection, content: &str) -> (Data, Uuid) {
        let client_id = Uuid::new_v4();
        let data = insert_data(conn, "").await.unwrap();
        let new_content: Vec<GutenbergBlock> = vec![GutenbergBlock {
            client_id,
            name: "core/paragraph".to_string(),
            is_valid: true,
            attributes: attributes! {
                "content": content
            },
            inner_blocks: vec![],
        }];
        let page_update = PageUpdate {
            content: serde_json::to_value(&new_content).unwrap(),
            url_path: "".to_string(),
            title: "".to_string(),
            chapter_id: Some(data.chapter),
            front_page_of_chapter_id: None,
        };
        crate::models::pages::update_page(conn, data.page, page_update, data.user, true)
            .await
            .unwrap();
        (data, client_id)
    }

    async fn assert_content(conn: &mut PgConnection, page_id: Uuid, expected: &str) {
        let page = crate::models::pages::get_page(conn, page_id).await.unwrap();
        let mut new_content: Vec<GutenbergBlock> = serde_json::from_value(page.content).unwrap();
        let block = new_content.pop().unwrap();
        let content = block.attributes.get("content").unwrap().as_str().unwrap();
        assert_eq!(content, expected);
    }

    #[tokio::test]
    async fn typo_fix() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let (data, block_id) = init_content(tx.as_mut(), "Content with a tpo in it.").await;
        let new = NewProposedPageEdits {
            page_id: data.page,
            block_edits: vec![NewProposedBlockEdits {
                block_id,
                block_attribute: "content".to_string(),
                original_text: "Content with a tpo in it.".to_string(),
                changed_text: "Content with a typo in it.".to_string(),
            }],
        };
        insert(tx.as_mut(), data.course, None, &new).await.unwrap();
        let proposals = get_proposals_for_course(tx.as_mut(), data.course, &Pagination::default())
            .await
            .unwrap();
        let mut ps = get_proposals_for_course(tx.as_mut(), data.course, &Pagination::default())
            .await
            .unwrap();
        let p = ps.pop().unwrap();
        assert_eq!(p.accept_preview.unwrap(), "Content with a typo in it.");
        accept_block_edits(
            tx.as_mut(),
            data.page,
            &[proposals[0].block_proposal_id],
            data.user,
        )
        .await
        .unwrap();

        let mut ps = get_proposals_for_course(tx.as_mut(), data.course, &Pagination::default())
            .await
            .unwrap();
        let p = ps.pop().unwrap();
        assert_eq!(p.status, ProposalStatus::Accepted);

        assert_content(tx.as_mut(), data.page, "Content with a typo in it.").await;
    }

    #[tokio::test]
    async fn rejection() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let (data, block_id) = init_content(tx.as_mut(), "Content with a tpo in it.").await;
        let new = NewProposedPageEdits {
            page_id: data.page,
            block_edits: vec![NewProposedBlockEdits {
                block_id,
                block_attribute: "content".to_string(),
                original_text: "Content with a tpo in it.".to_string(),
                changed_text: "Content with a typo in it.".to_string(),
            }],
        };
        insert(tx.as_mut(), data.course, None, &new).await.unwrap();
        let proposals = get_proposals_for_course(tx.as_mut(), data.course, &Pagination::default())
            .await
            .unwrap();

        let mut ps = get_proposals_for_course(tx.as_mut(), data.course, &Pagination::default())
            .await
            .unwrap();
        let p = ps.pop().unwrap();
        assert_eq!(p.accept_preview.unwrap(), "Content with a typo in it.");
        assert_eq!(p.status, ProposalStatus::Pending);

        reject_block_edits(tx.as_mut(), &[proposals[0].block_proposal_id])
            .await
            .unwrap();

        let mut ps = get_proposals_for_course(tx.as_mut(), data.course, &Pagination::default())
            .await
            .unwrap();
        let p = ps.pop().unwrap();
        assert_eq!(p.status, ProposalStatus::Rejected);

        assert_content(tx.as_mut(), data.page, "Content with a tpo in it.").await;
    }
}
