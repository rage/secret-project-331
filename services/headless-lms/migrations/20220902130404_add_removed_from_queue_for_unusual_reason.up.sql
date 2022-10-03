ALTER TABLE peer_review_queue_entries
ADD COLUMN removed_from_queue_for_unusual_reason BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN peer_review_queue_entries.removed_from_queue_for_unusual_reason IS 'If true, the answer won''t be given to others to be peer reviewed. This will **not** be set to true when user receives enough reviews and concludes the peer review process. This will be set to true for example when teacher grades the answer manually and peer reviews are no longer true or when an anwer would be removed from the peer review queue due to it being spam.';
