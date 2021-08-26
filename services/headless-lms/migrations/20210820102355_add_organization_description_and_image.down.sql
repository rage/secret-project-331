-- Add down migration script here
ALTER TABLE organizations DROP COLUMN organization_image_path;
ALTER TABLE organizations DROP COLUMN description;
