use crate::prelude::*;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct Group {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub organization_id: Uuid,
    pub name: String,
}

pub async fn create(
    conn: &mut PgConnection,
    organization_id: Uuid,
    name: &str,
) -> ModelResult<Group> {
    let group = sqlx::query_as!(
        Group,
        r#"
INSERT INTO groups (organization_id, name)
VALUES ($1, $2)
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  organization_id,
  name
"#,
        organization_id,
        name
    )
    .fetch_one(conn)
    .await?;
    Ok(group)
}

pub async fn get_active_by_id(conn: &mut PgConnection, group_id: Uuid) -> ModelResult<Group> {
    let group = sqlx::query_as!(
        Group,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  organization_id,
  name
FROM groups
WHERE id = $1
  AND deleted_at IS NULL
"#,
        group_id
    )
    .fetch_one(conn)
    .await?;
    Ok(group)
}

pub async fn list_by_organization(
    conn: &mut PgConnection,
    organization_id: Uuid,
) -> ModelResult<Vec<Group>> {
    let groups = sqlx::query_as!(
        Group,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  organization_id,
  name
FROM groups
WHERE organization_id = $1
  AND deleted_at IS NULL
ORDER BY LOWER(name),
  id
"#,
        organization_id
    )
    .fetch_all(conn)
    .await?;
    Ok(groups)
}

pub async fn list_by_organization_for_member(
    conn: &mut PgConnection,
    organization_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Vec<Group>> {
    let groups = sqlx::query_as!(
        Group,
        r#"
SELECT g.id,
  g.created_at,
  g.updated_at,
  g.deleted_at,
  g.organization_id,
  g.name
FROM groups g
  JOIN group_memberships gm ON gm.group_id = g.id
WHERE g.organization_id = $1
  AND g.deleted_at IS NULL
  AND gm.user_id = $2
  AND gm.deleted_at IS NULL
ORDER BY LOWER(g.name),
  g.id
"#,
        organization_id,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(groups)
}

pub async fn rename(conn: &mut PgConnection, group_id: Uuid, name: &str) -> ModelResult<Group> {
    let group = sqlx::query_as!(
        Group,
        r#"
UPDATE groups
SET name = $2
WHERE id = $1
  AND deleted_at IS NULL
RETURNING id,
  created_at,
  updated_at,
  deleted_at,
  organization_id,
  name
"#,
        group_id,
        name
    )
    .fetch_one(conn)
    .await?;
    Ok(group)
}

pub async fn is_member(
    conn: &mut PgConnection,
    group_id: Uuid,
    user_id: Uuid,
) -> ModelResult<bool> {
    let membership = sqlx::query!(
        r#"
SELECT gm.id
FROM group_memberships gm
  JOIN groups g ON g.id = gm.group_id
WHERE gm.group_id = $1
  AND gm.user_id = $2
  AND gm.deleted_at IS NULL
  AND g.deleted_at IS NULL
LIMIT 1
"#,
        group_id,
        user_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(membership.is_some())
}

pub async fn soft_delete_with_dependents(
    conn: &mut PgConnection,
    group_id: Uuid,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;

    sqlx::query!(
        r#"
UPDATE group_roles
SET deleted_at = NOW()
WHERE group_id = $1
  AND deleted_at IS NULL
"#,
        group_id
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        r#"
UPDATE group_memberships
SET deleted_at = NOW()
WHERE group_id = $1
  AND deleted_at IS NULL
"#,
        group_id
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        r#"
UPDATE groups
SET deleted_at = NOW()
WHERE id = $1
  AND deleted_at IS NULL
"#,
        group_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{organizations, test_helper::Conn};

    fn unique_name(prefix: &str) -> String {
        format!("{prefix}-{}", Uuid::new_v4())
    }

    #[tokio::test]
    async fn group_name_is_case_insensitive_unique_and_reusable_after_soft_delete() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let org_name = unique_name("org");
        let org_slug = unique_name("org-slug");
        let organization_id = organizations::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &org_name,
            &org_slug,
            None,
            false,
        )
        .await
        .unwrap();

        let group = create(tx.as_mut(), organization_id, "Staff").await.unwrap();

        let err = create(tx.as_mut(), organization_id, "staff")
            .await
            .unwrap_err();
        match err.error_type() {
            ModelErrorType::DatabaseConstraint { constraint, .. } => {
                assert_eq!(
                    constraint,
                    "groups_organization_id_lower_name_deleted_at_unique_idx"
                );
            }
            other => panic!("unexpected error type: {other:?}"),
        }

        soft_delete_with_dependents(tx.as_mut(), group.id)
            .await
            .unwrap();

        let recreated = create(tx.as_mut(), organization_id, "staff").await.unwrap();
        assert_eq!(recreated.name, "staff");
        assert_eq!(recreated.organization_id, organization_id);
    }
}
