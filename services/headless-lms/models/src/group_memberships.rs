use crate::prelude::*;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GroupMember {
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: String,
}

pub async fn list_members(
    conn: &mut PgConnection,
    group_id: Uuid,
) -> ModelResult<Vec<GroupMember>> {
    let members = sqlx::query_as!(
        GroupMember,
        r#"
SELECT users.id AS "user_id!",
  user_details.first_name,
  user_details.last_name,
  user_details.email
FROM group_memberships
  JOIN users ON users.id = group_memberships.user_id
  JOIN user_details ON user_details.user_id = users.id
  JOIN groups ON groups.id = group_memberships.group_id
WHERE group_memberships.group_id = $1
  AND group_memberships.deleted_at IS NULL
  AND groups.deleted_at IS NULL
ORDER BY COALESCE(user_details.last_name, ''),
  COALESCE(user_details.first_name, ''),
  user_details.email
"#,
        group_id
    )
    .fetch_all(conn)
    .await?;
    Ok(members)
}

pub async fn add_member(
    conn: &mut PgConnection,
    group_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO group_memberships (group_id, user_id)
VALUES ($1, $2)
RETURNING id
"#,
        group_id,
        user_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn remove_member(
    conn: &mut PgConnection,
    group_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE group_memberships
SET deleted_at = NOW()
WHERE group_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
"#,
        group_id,
        user_id
    )
    .execute(conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{groups, organizations, test_helper::Conn, users};

    fn unique_text(prefix: &str) -> String {
        format!("{prefix}-{}", Uuid::new_v4())
    }

    #[tokio::test]
    async fn membership_is_unique_and_can_be_readded_after_soft_delete() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let org_name = unique_text("org");
        let org_slug = unique_text("slug");
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
        let group = groups::create(tx.as_mut(), organization_id, "Team A")
            .await
            .unwrap();
        let email = format!("{}@example.com", unique_text("member"));
        let user_id = users::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &email,
            Some("Member"),
            Some("One"),
        )
        .await
        .unwrap();

        add_member(tx.as_mut(), group.id, user_id).await.unwrap();

        let err = add_member(tx.as_mut(), group.id, user_id)
            .await
            .unwrap_err();
        match err.error_type() {
            ModelErrorType::DatabaseConstraint { constraint, .. } => {
                assert_eq!(
                    constraint,
                    "group_memberships_group_id_user_id_deleted_at_key"
                );
            }
            other => panic!("unexpected error type: {other:?}"),
        }

        remove_member(tx.as_mut(), group.id, user_id).await.unwrap();
        add_member(tx.as_mut(), group.id, user_id).await.unwrap();

        let members = list_members(tx.as_mut(), group.id).await.unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].user_id, user_id);
    }
}
