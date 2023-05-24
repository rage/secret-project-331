use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewProposedBlockEdit {
    pub block_id: Uuid,
    pub block_attribute: String,
    pub original_text: String,
    pub changed_text: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq, sqlx::Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "proposal_status", rename_all = "lowercase")]
pub enum ProposalStatus {
    Pending,
    Accepted,
    Rejected,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EditedBlockStillExistsData {
    pub id: Uuid,
    pub block_id: Uuid,
    pub current_text: String,
    pub changed_text: String,
    pub original_text: String,
    pub status: ProposalStatus,
    pub accept_preview: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct EditedBlockNoLongerExistsData {
    pub id: Uuid,
    pub block_id: Uuid,
    pub changed_text: String,
    pub original_text: String,
    pub status: ProposalStatus,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[serde(tag = "type", rename_all = "kebab-case")]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub enum BlockProposal {
    EditedBlockStillExists(EditedBlockStillExistsData),
    EditedBlockNoLongerExists(EditedBlockNoLongerExistsData),
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct BlockProposalInfo {
    pub id: Uuid,
    pub action: BlockProposalAction,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(tag = "tag", content = "data")]
pub enum BlockProposalAction {
    Accept(String),
    Reject,
}
