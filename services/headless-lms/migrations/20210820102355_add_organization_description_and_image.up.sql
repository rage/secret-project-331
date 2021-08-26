-- Add up migration script here
ALTER TABLE organizations
ADD COLUMN organization_image_path varchar(255);
ALTER TABLE organizations
ADD COLUMN description VARCHAR(1000);
COMMENT ON COLUMN organizations.organization_image_path IS 'Organization image path is converted to organization image url once fetched from database.';
COMMENT ON COLUMN organizations.description IS 'Organization description.';
