-- Add up migration script here
ALTER TABLE organizations
ADD COLUMN organization_image_path varchar(255);
ALTER TABLE organizations
ADD COLUMN description VARCHAR(1000);