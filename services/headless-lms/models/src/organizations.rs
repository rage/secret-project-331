use std::path::PathBuf;

use headless_lms_utils::{ApplicationConfiguration, file_store::FileStore};

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct DatabaseOrganization {
    pub id: Uuid,
    pub slug: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub description: Option<String>,
    pub organization_image_path: Option<String>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Organization {
    pub id: Uuid,
    pub slug: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub name: String,
    pub description: Option<String>,
    pub organization_image_url: Option<String>,
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Organization {
    pub fn from_database_organization(
        organization: DatabaseOrganization,
        file_store: &dyn FileStore,
        app_conf: &ApplicationConfiguration,
    ) -> Self {
        let organization_image_url = organization.organization_image_path.as_ref().map(|image| {
            let path = PathBuf::from(image);
            file_store.get_download_url(path.as_path(), app_conf)
        });
        Self {
            id: organization.id,
            created_at: organization.created_at,
            updated_at: organization.updated_at,
            name: organization.name,
            slug: organization.slug,
            deleted_at: organization.deleted_at,
            organization_image_url,
            description: organization.description,
        }
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    name: &str,
    slug: &str,
    description: &str,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO organizations (id, name, slug, description)
VALUES ($1, $2, $3, $4)
RETURNING id
",
        pkey_policy.into_uuid(),
        name,
        slug,
        description
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn all_organizations(conn: &mut PgConnection) -> ModelResult<Vec<DatabaseOrganization>> {
    let organizations = sqlx::query_as!(
        DatabaseOrganization,
        "SELECT * FROM organizations WHERE deleted_at IS NULL ORDER BY name;"
    )
    .fetch_all(conn)
    .await?;
    Ok(organizations)
}

pub async fn get_organization(
    conn: &mut PgConnection,
    organization_id: Uuid,
) -> ModelResult<DatabaseOrganization> {
    let org = sqlx::query_as!(
        DatabaseOrganization,
        "
SELECT *
from organizations
where id = $1;",
        organization_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(org)
}

pub async fn get_organization_by_slug(
    conn: &mut PgConnection,
    organization_slug: &str,
) -> ModelResult<DatabaseOrganization> {
    let organization = sqlx::query_as!(
        DatabaseOrganization,
        "
SELECT *
FROM organizations
WHERE slug = $1;
        ",
        organization_slug
    )
    .fetch_one(conn)
    .await?;
    Ok(organization)
}

pub async fn update_organization_image_path(
    conn: &mut PgConnection,
    organization_id: Uuid,
    organization_image_path: Option<String>,
) -> ModelResult<DatabaseOrganization> {
    let updated_organization = sqlx::query_as!(
        DatabaseOrganization,
        "
UPDATE organizations
SET organization_image_path = $1
WHERE id = $2
RETURNING *;",
        organization_image_path,
        organization_id
    )
    .fetch_one(conn)
    .await?;
    Ok(updated_organization)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::Conn;

    #[tokio::test]
    async fn gets_organizations() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let orgs_before = all_organizations(tx.as_mut()).await.unwrap();
        insert(
            tx.as_mut(),
            PKeyPolicy::Fixed(Uuid::parse_str("8c34e601-b5db-4b33-a588-57cb6a5b1669").unwrap()),
            "org",
            "slug",
            "description",
        )
        .await
        .unwrap();
        let orgs_after = all_organizations(tx.as_mut()).await.unwrap();
        assert_eq!(orgs_before.len() + 1, orgs_after.len());
    }
}
