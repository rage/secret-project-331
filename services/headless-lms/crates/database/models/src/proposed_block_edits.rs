use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, ToSchema)]

pub struct NewProposedBlockEdit {
    pub block_id: Uuid,
    pub block_attribute: String,
    pub original_text: String,
    pub changed_text: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, ToSchema)]
pub struct ProposedBlockEdit {
    pub id: Uuid,
    pub proposal_id: Uuid,
    pub block_id: Uuid,
    pub block_attribute: String,
    pub original_text: String,
    pub changed_text: String,
    pub status: ProposalStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, sqlx::Type, ToSchema)]
#[sqlx(type_name = "proposal_status", rename_all = "lowercase")]
pub enum ProposalStatus {
    Pending,
    Accepted,
    Rejected,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, ToSchema)]

pub struct EditedBlockStillExistsData {
    pub id: Uuid,
    pub block_id: Uuid,
    pub current_text: String,
    pub changed_text: String,
    pub original_text: String,
    pub status: ProposalStatus,
    pub accept_preview: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, ToSchema)]

pub struct EditedBlockNoLongerExistsData {
    pub id: Uuid,
    pub block_id: Uuid,
    pub changed_text: String,
    pub original_text: String,
    pub status: ProposalStatus,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, ToSchema)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum BlockProposal {
    EditedBlockStillExists(EditedBlockStillExistsData),
    EditedBlockNoLongerExists(EditedBlockNoLongerExistsData),
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, ToSchema)]

pub struct BlockProposalInfo {
    pub id: Uuid,
    pub action: BlockProposalAction,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, ToSchema)]
#[serde(tag = "tag", content = "data")]
pub enum BlockProposalAction {
    Accept(String),
    Reject,
}

pub async fn get_by_ids(
    conn: &mut PgConnection,
    ids: &[Uuid],
) -> ModelResult<Vec<ProposedBlockEdit>> {
    let res = sqlx::query_as!(
        ProposedBlockEdit,
        r#"
SELECT *
FROM proposed_block_edits
WHERE id = ANY($1)
  AND deleted_at IS NULL
        "#,
        ids
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
