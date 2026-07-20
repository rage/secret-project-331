-- Intentionally a no-op.
--
-- The up migration sets attributes.isDecorative = true on core/image blocks whose alt was blank.
-- isDecorative is a normal, user-settable block attribute, so after the migration runs a value of
-- true set by the migration is indistinguishable from one a teacher set deliberately. A reversing
-- down would have to guess and would risk clearing decorative flags that users own, destroying
-- real content. The forward change is also idempotent and semantically harmless (a blank-alt image
-- is decorative), so we do not reverse it. This file exists so that `sqlx migrate down` stays
-- runnable and the migration pair is well-formed.
SELECT 1;
