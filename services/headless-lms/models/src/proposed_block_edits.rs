use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct NewProposedBlockEdit {
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

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
pub struct BlockProposalInfo {
    pub id: Uuid,
    pub action: BlockProposalAction,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, TS)]
#[serde(tag = "tag", content = "data")]
pub enum BlockProposalAction {
    Accept(String),
    Reject,
}
