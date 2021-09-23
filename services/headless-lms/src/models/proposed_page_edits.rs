use super::proposed_block_edits::{BlockProposal, NewProposedBlockEdit};
use crate::{
    domain::merge_edits,
    models::{proposed_block_edits::ProposalStatus, ModelError, ModelResult},
    utils::{document_schema_processor::GutenbergBlock, pagination::Pagination},
};
use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Connection, PgConnection};
use std::collections::{hash_map::Entry, HashMap};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct NewProposedPageEdits {
    pub page_id: Uuid,
    pub block_edits: Vec<NewProposedBlockEdit>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct PageProposal {
    pub id: Uuid,
    pub page_id: Uuid,
    pub user_id: Option<Uuid>,
    pub pending: bool,
    pub created_at: DateTime<Utc>,
    pub block_proposals: Vec<BlockProposal>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct ProposalCount {
    pending: i64,
    handled: i64,
}

pub async fn insert(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_id: Option<Uuid>,
    edits: &NewProposedPageEdits,
) -> ModelResult<(Uuid, Vec<Uuid>)> {
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

    let mut block_ids = vec![];
    for block_edit in &edits.block_edits {
        let res = sqlx::query!(
            "
INSERT INTO proposed_block_edits (
  proposal_id,
  block_id,
  block_attribute,
  original_text,
  changed_text
)
VALUES ($1, $2, $3, $4, $5)
RETURNING id
",
            page_res.id,
            block_edit.block_id,
            block_edit.block_attribute,
            block_edit.original_text,
            block_edit.changed_text
        )
        .fetch_one(&mut tx)
        .await?;
        block_ids.push(res.id);
    }
    tx.commit().await?;
    Ok((page_res.id, block_ids))
}

pub async fn get_proposals_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
    pending: bool,
    pagination: &Pagination,
) -> ModelResult<Vec<PageProposal>> {
    let res = sqlx::query!(
        r#"
SELECT proposed_page_edits.id AS "page_proposal_id!",
  proposed_block_edits.id AS "block_proposal_id!",
  page_id as "page_id!",
  user_id,
  block_id,
  original_text,
  changed_text,
  proposed_page_edits.pending as "pending!",
  block_attribute,
  proposed_block_edits.status as "block_proposal_status: ProposalStatus",
  proposed_page_edits.created_at as "created_at!"
FROM (
    SELECT id,
      page_id,
      user_id,
      pending,
      created_at
    FROM proposed_page_edits
    WHERE course_id = $1
      AND pending = $2
      AND deleted_at IS NULL
    ORDER BY created_at DESC,
      id
    LIMIT $3 OFFSET $4
  ) proposed_page_edits
  LEFT JOIN proposed_block_edits ON proposed_page_edits.id = proposed_block_edits.proposal_id
WHERE proposed_block_edits.deleted_at IS NULL
"#,
        course_id,
        pending,
        pagination.limit(),
        pagination.offset(),
    )
    .fetch_all(&mut *conn)
    .await?;

    let mut proposals = HashMap::new();
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
            .get(&r.block_attribute)
            .context(format!(
                "Missing expected attribute '{}' in edited block",
                r.block_attribute
            ))?
            .as_str()
            .context(format!(
                "Attribute '{}' did not contain a string",
                r.block_attribute
            ))?
            .to_string();
        let page_proposal_id = r.page_proposal_id;
        let page_id = r.page_id;
        let user_id = r.user_id;
        let page_proposal_pending = r.pending;
        let created_at = r.created_at;

        let block_proposal_id = r.block_proposal_id;
        let block_id = r.block_id;
        let original_text = r.original_text;
        let changed_text = r.changed_text;
        let block_proposal_status = r.block_proposal_status;
        let page_proposal =
            proposals
                .entry(r.page_proposal_id)
                .or_insert_with(move || PageProposal {
                    id: page_proposal_id,
                    page_id,
                    user_id,
                    pending: page_proposal_pending,
                    created_at,
                    block_proposals: Vec::new(),
                });
        page_proposal.block_proposals.push(BlockProposal {
            accept_preview: merge_edits::merge(&original_text, &changed_text, &content),
            id: block_proposal_id,
            block_id,
            current_text: content,
            changed_text,
            status: block_proposal_status,
        });
    }
    Ok(proposals.into_values().collect())
}

pub async fn get_proposal_count_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<ProposalCount> {
    let res = sqlx::query!(
        "
SELECT COUNT(*) filter (
  where proposed_page_edits.pending = true
) AS pending,
COUNT(*) filter (
  where proposed_page_edits.pending = false
) AS handled
FROM proposed_page_edits
WHERE proposed_page_edits.course_id = $1
AND proposed_page_edits.deleted_at IS NULL
",
        course_id,
    )
    .fetch_one(conn)
    .await?;
    let count = ProposalCount {
        pending: res.pending.unwrap_or_default(),
        handled: res.handled.unwrap_or_default(),
    };
    Ok(count)
}

pub async fn update_page_edit_status(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    let block_proposals = sqlx::query!(
        r#"
SELECT status AS "status: ProposalStatus"
FROM proposed_block_edits
WHERE proposal_id = $1
AND deleted_at IS NULL
"#,
        id
    )
    .fetch_all(&mut *conn)
    .await?;
    let pending = block_proposals
        .iter()
        .any(|bp| bp.status == ProposalStatus::Pending);
    sqlx::query!(
        "
UPDATE proposed_page_edits
SET pending = $1
WHERE id = $2
",
        pending,
        id,
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        attributes,
        models::{pages::PageUpdate, proposed_block_edits::*},
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
            block_edits: vec![NewProposedBlockEdit {
                block_id,
                block_attribute: "content".to_string(),
                original_text: "Content with a tpo in it.".to_string(),
                changed_text: "Content with a typo in it.".to_string(),
            }],
        };
        insert(tx.as_mut(), data.course, None, &new).await.unwrap();
        let mut ps =
            get_proposals_for_course(tx.as_mut(), data.course, true, &Pagination::default())
                .await
                .unwrap();
        let mut p = ps.pop().unwrap();
        let b = p.block_proposals.pop().unwrap();
        assert_eq!(b.accept_preview.unwrap(), "Content with a typo in it.");
        accept_block_edits(tx.as_mut(), data.page, p.id, &[b.id], data.user)
            .await
            .unwrap();

        let mut ps =
            get_proposals_for_course(tx.as_mut(), data.course, false, &Pagination::default())
                .await
                .unwrap();
        let _ = ps.pop().unwrap();

        assert_content(tx.as_mut(), data.page, "Content with a typo in it.").await;
    }

    #[tokio::test]
    async fn rejection() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let (data, block_id) = init_content(tx.as_mut(), "Content with a tpo in it.").await;
        let new = NewProposedPageEdits {
            page_id: data.page,
            block_edits: vec![NewProposedBlockEdit {
                block_id,
                block_attribute: "content".to_string(),
                original_text: "Content with a tpo in it.".to_string(),
                changed_text: "Content with a typo in it.".to_string(),
            }],
        };
        insert(tx.as_mut(), data.course, None, &new).await.unwrap();

        let mut ps =
            get_proposals_for_course(tx.as_mut(), data.course, true, &Pagination::default())
                .await
                .unwrap();
        let mut p = ps.pop().unwrap();
        let b = p.block_proposals.pop().unwrap();
        assert_eq!(b.accept_preview.unwrap(), "Content with a typo in it.");
        assert_eq!(b.status, ProposalStatus::Pending);

        reject_block_edits(tx.as_mut(), p.id, &[b.id])
            .await
            .unwrap();

        let mut ps =
            get_proposals_for_course(tx.as_mut(), data.course, false, &Pagination::default())
                .await
                .unwrap();
        let _ = ps.pop().unwrap();

        assert_content(tx.as_mut(), data.page, "Content with a tpo in it.").await;
    }
}
