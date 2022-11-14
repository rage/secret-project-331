use std::collections::{hash_map::Entry, HashMap};

use futures::future::BoxFuture;
use headless_lms_utils::{document_schema_processor::GutenbergBlock, merge_edits};
use serde_json::Value;
use url::Url;

use crate::{
    exercise_service_info::ExerciseServiceInfoApi,
    page_history::HistoryChangeReason,
    pages::{CmsPageUpdate, PageUpdate},
    prelude::*,
    proposed_block_edits::{
        BlockProposal, BlockProposalAction, BlockProposalInfo, NewProposedBlockEdit, ProposalStatus,
    },
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewProposedPageEdits {
    pub page_id: Uuid,
    pub block_edits: Vec<NewProposedBlockEdit>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PageProposal {
    pub id: Uuid,
    pub page_id: Uuid,
    pub user_id: Option<Uuid>,
    pub pending: bool,
    pub created_at: DateTime<Utc>,
    pub block_proposals: Vec<BlockProposal>,
    pub page_title: String,
    pub page_url_path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EditProposalInfo {
    pub page_id: Uuid,
    pub page_proposal_id: Uuid,
    pub block_proposals: Vec<BlockProposalInfo>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ProposalCount {
    pub pending: u32,
    pub handled: u32,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    course_id: Uuid,
    user_id: Option<Uuid>,
    edits: &NewProposedPageEdits,
) -> ModelResult<(Uuid, Vec<Uuid>)> {
    if edits.block_edits.is_empty() {
        return Err(ModelError::new(
            ModelErrorType::Generic,
            "No block edits".to_string(),
            None,
        ));
    }

    let mut tx = conn.begin().await?;
    let page_res = sqlx::query!(
        "
INSERT INTO proposed_page_edits (id, course_id, page_id, user_id)
VALUES ($1, $2, $3, $4)
RETURNING id
        ",
        pkey_policy.into_uuid(),
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
    pagination: Pagination,
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
  proposed_page_edits.created_at as "created_at!",
  pages.title as "page_title!",
  pages.url_path as "page_url_path!"
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
  LEFT JOIN pages ON proposed_page_edits.page_id = pages.id
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
                let page = crate::pages::get_page(&mut *conn, r.page_id).await?;
                let content: Vec<GutenbergBlock> = serde_json::from_value(page.content)?;
                v.insert(content)
            }
        };
        let block = content
            .iter()
            .find(|b| b.client_id == r.block_id)
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::Generic,
                    "Failed to find the block which the proposal was for".to_string(),
                    None,
                )
            })?;
        let content = block
            .attributes
            .get(&r.block_attribute)
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::Generic,
                    format!(
                        "Missing expected attribute '{}' in edited block",
                        r.block_attribute
                    ),
                    None,
                )
            })?
            .as_str()
            .ok_or_else(|| {
                ModelError::new(
                    ModelErrorType::Generic,
                    format!("Attribute '{}' did not contain a string", r.block_attribute),
                    None,
                )
            })?
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
                    page_title: r.page_title,
                    page_url_path: r.page_url_path,
                });
        page_proposal.block_proposals.push(BlockProposal {
            accept_preview: merge_edits::merge(&original_text, &changed_text, &content),
            id: block_proposal_id,
            block_id,
            current_text: content.to_string(),
            changed_text: changed_text.to_string(),
            status: block_proposal_status,
            original_text: original_text.to_string(),
        });
    }

    let mut proposals = proposals.into_values().collect::<Vec<_>>();
    proposals.sort_by(|left, right| left.created_at.cmp(&right.created_at).reverse());
    Ok(proposals)
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
        pending: res.pending.unwrap_or_default().try_into()?,
        handled: res.handled.unwrap_or_default().try_into()?,
    };
    Ok(count)
}

pub async fn process_proposal(
    conn: &mut PgConnection,
    page_id: Uuid,
    page_proposal_id: Uuid,
    block_proposals: Vec<BlockProposalInfo>,
    author: Uuid,
    spec_fetcher: impl Fn(
        Url,
        Option<&serde_json::Value>,
    ) -> BoxFuture<'static, ModelResult<serde_json::Value>>,
    fetch_service_info: impl Fn(Url) -> BoxFuture<'static, ModelResult<ExerciseServiceInfoApi>>,
) -> ModelResult<()> {
    if block_proposals.is_empty() {
        return Err(ModelError::new(
            ModelErrorType::Generic,
            "No block proposals to process".to_string(),
            None,
        ));
    }

    let mut tx = conn.begin().await?;
    let page_with_exercises = crate::pages::get_page_with_exercises(&mut tx, page_id).await?;
    let mut blocks = page_with_exercises.page.blocks_cloned()?;
    for BlockProposalInfo { id, action } in block_proposals {
        match action {
            BlockProposalAction::Accept(contents) => {
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
                    id
                )
                .fetch_one(&mut tx)
                .await?;
                let block = blocks
                    .iter_mut()
                    .find(|b| b.client_id == res.block_id)
                    .ok_or_else(|| {
                        ModelError::new(
                            ModelErrorType::Generic,
                            "Failed to find the block which the proposal was for".to_string(),
                            None,
                        )
                    })?;
                let current_content =
                    block
                        .attributes
                        .get_mut(&res.block_attribute)
                        .ok_or_else(|| {
                            ModelError::new(
                                ModelErrorType::Generic,
                                format!("Edited block has no attribute {}", &res.block_attribute),
                                None,
                            )
                        })?;
                if let Value::String(s) = current_content {
                    *s = contents;
                } else {
                    return Err(ModelError::new(
                        ModelErrorType::Generic,
                        format!(
                            "Block attribute {} did not contain a string",
                            res.block_attribute
                        ),
                        None,
                    ));
                }
            }
            BlockProposalAction::Reject => {
                sqlx::query!(
                    "
UPDATE proposed_block_edits
SET status = 'rejected'
WHERE id = $1
",
                    id
                )
                .execute(&mut tx)
                .await?;
            }
        }
    }

    let updated_content = serde_json::to_value(&blocks)?;
    let cms_page_update = CmsPageUpdate {
        content: updated_content,
        exercises: page_with_exercises.exercises,
        exercise_slides: page_with_exercises.exercise_slides,
        exercise_tasks: page_with_exercises.exercise_tasks,
        url_path: page_with_exercises.page.url_path,
        title: page_with_exercises.page.title,
        chapter_id: page_with_exercises.page.chapter_id,
    };
    crate::pages::update_page(
        &mut tx,
        PageUpdate {
            page_id: page_with_exercises.page.id,
            author,
            cms_page_update,
            retain_ids: true,
            history_change_reason: HistoryChangeReason::PageSaved,
            is_exam_page: page_with_exercises.page.exam_id.is_some(),
        },
        spec_fetcher,
        fetch_service_info,
    )
    .await?;

    update_page_edit_status(&mut tx, page_proposal_id).await?;

    tx.commit().await?;
    Ok(())
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
    use headless_lms_utils::document_schema_processor::{attributes, GutenbergBlock};

    use super::*;
    use crate::{pages::PageUpdate, proposed_block_edits::*, test_helper::*};

    async fn init_content(
        conn: &mut PgConnection,
        chapter: Uuid,
        page: Uuid,
        user: Uuid,
        content: &str,
    ) -> Uuid {
        let client_id = Uuid::new_v4();
        let new_content: Vec<GutenbergBlock> = vec![GutenbergBlock {
            client_id,
            name: "core/paragraph".to_string(),
            is_valid: true,
            attributes: attributes! {
                "content": content
            },
            inner_blocks: vec![],
        }];
        let cms_page_update = CmsPageUpdate {
            content: serde_json::to_value(&new_content).unwrap(),
            url_path: "".to_string(),
            title: "".to_string(),
            chapter_id: Some(chapter),
            exercises: vec![],
            exercise_slides: vec![],
            exercise_tasks: vec![],
        };
        crate::pages::update_page(
            conn,
            PageUpdate {
                page_id: page,
                author: user,
                cms_page_update,
                retain_ids: true,
                history_change_reason: HistoryChangeReason::PageSaved,
                is_exam_page: false,
            },
            |_, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap();
        client_id
    }

    async fn assert_content(conn: &mut PgConnection, page_id: Uuid, expected: &str) {
        let page = crate::pages::get_page(conn, page_id).await.unwrap();
        let mut new_content: Vec<GutenbergBlock> = serde_json::from_value(page.content).unwrap();
        let block = new_content.pop().unwrap();
        let content = block.attributes.get("content").unwrap().as_str().unwrap();
        assert_eq!(content, expected);
    }

    #[tokio::test]
    async fn typo_fix() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module, :chapter, :page);
        let block_id = init_content(
            tx.as_mut(),
            chapter,
            page,
            user,
            "Content with a tpo in it.",
        )
        .await;

        let new = NewProposedPageEdits {
            page_id: page,
            block_edits: vec![NewProposedBlockEdit {
                block_id,
                block_attribute: "content".to_string(),
                original_text: "Content with a tpo in it.".to_string(),
                changed_text: "Content with a typo in it.".to_string(),
            }],
        };
        insert(tx.as_mut(), PKeyPolicy::Generate, course, None, &new)
            .await
            .unwrap();
        let mut ps = get_proposals_for_course(tx.as_mut(), course, true, Pagination::default())
            .await
            .unwrap();
        let mut p = ps.pop().unwrap();
        let b = p.block_proposals.pop().unwrap();
        assert_eq!(b.accept_preview.unwrap(), "Content with a typo in it.");
        process_proposal(
            tx.as_mut(),
            page,
            p.id,
            vec![BlockProposalInfo {
                id: b.id,
                action: BlockProposalAction::Accept("Content with a typo in it.".to_string()),
            }],
            user,
            |_, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap();

        let mut ps = get_proposals_for_course(tx.as_mut(), course, false, Pagination::default())
            .await
            .unwrap();
        let _ = ps.pop().unwrap();

        assert_content(tx.as_mut(), page, "Content with a typo in it.").await;
    }

    #[tokio::test]
    async fn rejection() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module, :chapter, :page);
        let block_id = init_content(
            tx.as_mut(),
            chapter,
            page,
            user,
            "Content with a tpo in it.",
        )
        .await;
        let new = NewProposedPageEdits {
            page_id: page,
            block_edits: vec![NewProposedBlockEdit {
                block_id,
                block_attribute: "content".to_string(),
                original_text: "Content with a tpo in it.".to_string(),
                changed_text: "Content with a typo in it.".to_string(),
            }],
        };
        insert(tx.as_mut(), PKeyPolicy::Generate, course, None, &new)
            .await
            .unwrap();

        let mut ps = get_proposals_for_course(tx.as_mut(), course, true, Pagination::default())
            .await
            .unwrap();
        let mut p = ps.pop().unwrap();
        let b = p.block_proposals.pop().unwrap();
        assert_eq!(b.accept_preview.unwrap(), "Content with a typo in it.");
        assert_eq!(b.status, ProposalStatus::Pending);

        process_proposal(
            tx.as_mut(),
            page,
            p.id,
            vec![BlockProposalInfo {
                id: b.id,
                action: BlockProposalAction::Reject,
            }],
            user,
            |_, _| unimplemented!(),
            |_| unimplemented!(),
        )
        .await
        .unwrap();

        let mut ps = get_proposals_for_course(tx.as_mut(), course, false, Pagination::default())
            .await
            .unwrap();
        let _ = ps.pop().unwrap();

        assert_content(tx.as_mut(), page, "Content with a tpo in it.").await;
    }
}
