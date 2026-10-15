-- Not reversible: the up migration does not record which rows it changed, and the previous
-- stage is indistinguishable from states that legitimately reached 'not_answered_and_locked'.
SELECT 1;
