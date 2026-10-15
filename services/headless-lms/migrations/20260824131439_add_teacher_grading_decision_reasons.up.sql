ALTER TYPE teacher_decision_type
ADD VALUE IF NOT EXISTS 'unauthorized-ai-use';

ALTER TYPE teacher_decision_type
ADD VALUE IF NOT EXISTS 'bad-answer';

ALTER TYPE teacher_decision_type
ADD VALUE IF NOT EXISTS 'other';
