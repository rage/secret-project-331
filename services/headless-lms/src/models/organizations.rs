use std::path::PathBuf;

use crate::{utils::file_store::FileStore, ApplicationConfiguration};

use super::ModelResult;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct DatabaseOrganization {
    id: Uuid,
    slug: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    name: String,
    description: Option<String>,
    organization_image_path: Option<String>,
    deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, TS)]
pub struct Organization {
    id: Uuid,
    slug: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    name: String,
    description: Option<String>,
    organization_image_url: Option<String>,
    deleted_at: Option<DateTime<Utc>>,
}

impl Organization {
    pub fn from_database_organization(
        organization: &DatabaseOrganization,
        file_store: &impl FileStore,
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
            name: organization.name.clone(),
            slug: organization.slug.clone(),
            deleted_at: organization.deleted_at,
            organization_image_url,
            description: organization.description.clone(),
        }
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    name: &str,
    slug: &str,
    description: &str,
    id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO organizations (id, name, slug, description)
VALUES ($1, $2, $3, $4)
RETURNING id
",
        id,
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
        "SELECT * FROM organizations WHERE deleted_at IS NULL;"
    )
    .fetch_all(conn)
    .await?;
    Ok(organizations)
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
            "org",
            "slug",
            "description",
            Uuid::parse_str("8c34e601-b5db-4b33-a588-57cb6a5b1669").unwrap(),
        )
        .await
        .unwrap();
        let orgs_after = all_organizations(tx.as_mut()).await.unwrap();
        assert_eq!(orgs_before.len() + 1, orgs_after.len());
    }
}
