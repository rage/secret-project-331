ALTER TABLE exercise_repositories
ADD COLUMN public_key VARCHAR(1024);
COMMENT ON COLUMN exercise_repositories.public_key IS 'The public SSH key associated with the deploy key.';
