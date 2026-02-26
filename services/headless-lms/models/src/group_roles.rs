use crate::prelude::*;
use crate::roles::{RoleDomain, UserRole};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GroupRoleAssignment {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub group_id: Uuid,
    pub role: UserRole,
    pub organization_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct GroupAccessRow {
    pub group_id: Uuid,
    pub organization_id: Uuid,
    pub group_name: String,
    pub role: UserRole,
    pub member_count: i64,
}

fn invalid_group_role_domain(message: &str) -> ModelError {
    ModelError::new(ModelErrorType::InvalidRequest, message.to_string(), None)
}

pub async fn insert(
    conn: &mut PgConnection,
    group_id: Uuid,
    role: UserRole,
    domain: RoleDomain,
) -> ModelResult<Uuid> {
    let id = match domain {
        RoleDomain::Global => {
            return Err(invalid_group_role_domain(
                "Group roles cannot be assigned in the global scope.",
            ));
        }
        RoleDomain::Organization(id) => {
            sqlx::query!(
                r#"
INSERT INTO group_roles (group_id, role, organization_id)
VALUES ($1, $2, $3)
RETURNING id
"#,
                group_id,
                role as UserRole,
                id
            )
            .fetch_one(conn)
            .await?
            .id
        }
        RoleDomain::Course(id) => {
            sqlx::query!(
                r#"
INSERT INTO group_roles (group_id, role, course_id)
VALUES ($1, $2, $3)
RETURNING id
"#,
                group_id,
                role as UserRole,
                id
            )
            .fetch_one(conn)
            .await?
            .id
        }
        RoleDomain::CourseInstance(id) => {
            sqlx::query!(
                r#"
INSERT INTO group_roles (group_id, role, course_instance_id)
VALUES ($1, $2, $3)
RETURNING id
"#,
                group_id,
                role as UserRole,
                id
            )
            .fetch_one(conn)
            .await?
            .id
        }
        RoleDomain::Exam(id) => {
            sqlx::query!(
                r#"
INSERT INTO group_roles (group_id, role, exam_id)
VALUES ($1, $2, $3)
RETURNING id
"#,
                group_id,
                role as UserRole,
                id
            )
            .fetch_one(conn)
            .await?
            .id
        }
    };
    Ok(id)
}

pub async fn remove(
    conn: &mut PgConnection,
    group_id: Uuid,
    role: UserRole,
    domain: RoleDomain,
) -> ModelResult<()> {
    match domain {
        RoleDomain::Global => {
            return Err(invalid_group_role_domain(
                "Group roles cannot be removed from the global scope because they are not allowed there.",
            ));
        }
        RoleDomain::Organization(id) => {
            sqlx::query!(
                r#"
UPDATE group_roles
SET deleted_at = NOW()
WHERE group_id = $1
  AND role = $2
  AND organization_id = $3
  AND deleted_at IS NULL
"#,
                group_id,
                role as UserRole,
                id
            )
            .execute(conn)
            .await?;
        }
        RoleDomain::Course(id) => {
            sqlx::query!(
                r#"
UPDATE group_roles
SET deleted_at = NOW()
WHERE group_id = $1
  AND role = $2
  AND course_id = $3
  AND deleted_at IS NULL
"#,
                group_id,
                role as UserRole,
                id
            )
            .execute(conn)
            .await?;
        }
        RoleDomain::CourseInstance(id) => {
            sqlx::query!(
                r#"
UPDATE group_roles
SET deleted_at = NOW()
WHERE group_id = $1
  AND role = $2
  AND course_instance_id = $3
  AND deleted_at IS NULL
"#,
                group_id,
                role as UserRole,
                id
            )
            .execute(conn)
            .await?;
        }
        RoleDomain::Exam(id) => {
            sqlx::query!(
                r#"
UPDATE group_roles
SET deleted_at = NOW()
WHERE group_id = $1
  AND role = $2
  AND exam_id = $3
  AND deleted_at IS NULL
"#,
                group_id,
                role as UserRole,
                id
            )
            .execute(conn)
            .await?;
        }
    }
    Ok(())
}

pub async fn list_by_group(
    conn: &mut PgConnection,
    group_id: Uuid,
) -> ModelResult<Vec<GroupRoleAssignment>> {
    let group_roles = sqlx::query_as!(
        GroupRoleAssignment,
        r#"
SELECT id,
  created_at,
  updated_at,
  deleted_at,
  group_id,
  role AS "role!: UserRole",
  organization_id,
  course_id,
  course_instance_id,
  exam_id
FROM group_roles
WHERE group_id = $1
  AND deleted_at IS NULL
ORDER BY role,
  organization_id,
  course_id,
  course_instance_id,
  exam_id,
  id
"#,
        group_id
    )
    .fetch_all(conn)
    .await?;
    Ok(group_roles)
}

pub async fn list_groups_with_access_for_domain(
    conn: &mut PgConnection,
    domain: RoleDomain,
) -> ModelResult<Vec<GroupAccessRow>> {
    let rows = match domain {
        RoleDomain::Global => {
            return Err(invalid_group_role_domain(
                "Group access listings are not available for the global scope.",
            ));
        }
        RoleDomain::Organization(id) => {
            sqlx::query_as!(
                GroupAccessRow,
                r#"
SELECT g.id AS "group_id!",
  g.organization_id AS "organization_id!",
  g.name AS "group_name!",
  gr.role AS "role!: UserRole",
  (
    SELECT COUNT(*)::bigint
    FROM group_memberships gm
    WHERE gm.group_id = g.id
      AND gm.deleted_at IS NULL
  ) AS "member_count!"
FROM group_roles gr
  JOIN groups g ON g.id = gr.group_id
WHERE gr.organization_id = $1
  AND gr.deleted_at IS NULL
  AND g.deleted_at IS NULL
ORDER BY LOWER(g.name),
  gr.role,
  g.id
"#,
                id
            )
            .fetch_all(conn)
            .await?
        }
        RoleDomain::Course(id) => {
            sqlx::query_as!(
                GroupAccessRow,
                r#"
SELECT g.id AS "group_id!",
  g.organization_id AS "organization_id!",
  g.name AS "group_name!",
  gr.role AS "role!: UserRole",
  (
    SELECT COUNT(*)::bigint
    FROM group_memberships gm
    WHERE gm.group_id = g.id
      AND gm.deleted_at IS NULL
  ) AS "member_count!"
FROM group_roles gr
  JOIN groups g ON g.id = gr.group_id
WHERE gr.course_id = $1
  AND gr.deleted_at IS NULL
  AND g.deleted_at IS NULL
ORDER BY LOWER(g.name),
  gr.role,
  g.id
"#,
                id
            )
            .fetch_all(conn)
            .await?
        }
        RoleDomain::CourseInstance(id) => {
            sqlx::query_as!(
                GroupAccessRow,
                r#"
SELECT g.id AS "group_id!",
  g.organization_id AS "organization_id!",
  g.name AS "group_name!",
  gr.role AS "role!: UserRole",
  (
    SELECT COUNT(*)::bigint
    FROM group_memberships gm
    WHERE gm.group_id = g.id
      AND gm.deleted_at IS NULL
  ) AS "member_count!"
FROM group_roles gr
  JOIN groups g ON g.id = gr.group_id
WHERE gr.course_instance_id = $1
  AND gr.deleted_at IS NULL
  AND g.deleted_at IS NULL
ORDER BY LOWER(g.name),
  gr.role,
  g.id
"#,
                id
            )
            .fetch_all(conn)
            .await?
        }
        RoleDomain::Exam(id) => {
            sqlx::query_as!(
                GroupAccessRow,
                r#"
SELECT g.id AS "group_id!",
  g.organization_id AS "organization_id!",
  g.name AS "group_name!",
  gr.role AS "role!: UserRole",
  (
    SELECT COUNT(*)::bigint
    FROM group_memberships gm
    WHERE gm.group_id = g.id
      AND gm.deleted_at IS NULL
  ) AS "member_count!"
FROM group_roles gr
  JOIN groups g ON g.id = gr.group_id
WHERE gr.exam_id = $1
  AND gr.deleted_at IS NULL
  AND g.deleted_at IS NULL
ORDER BY LOWER(g.name),
  gr.role,
  g.id
"#,
                id
            )
            .fetch_all(conn)
            .await?
        }
    };

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{groups, organizations, test_helper::Conn};

    fn unique_text(prefix: &str) -> String {
        format!("{prefix}-{}", Uuid::new_v4())
    }

    async fn setup_group(conn: &mut PgConnection) -> (Uuid, Uuid) {
        let org_name = unique_text("org");
        let org_slug = unique_text("slug");
        let organization_id = organizations::insert(
            conn,
            PKeyPolicy::Generate,
            &org_name,
            &org_slug,
            None,
            false,
        )
        .await
        .unwrap();
        let group = groups::create(conn, organization_id, "Role Group")
            .await
            .unwrap();
        (organization_id, group.id)
    }

    #[tokio::test]
    async fn rejects_global_domain_for_group_role_assignments() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let (_organization_id, group_id) = setup_group(tx.as_mut()).await;

        let err = insert(
            tx.as_mut(),
            group_id,
            UserRole::Assistant,
            RoleDomain::Global,
        )
        .await
        .unwrap_err();
        assert_eq!(err.error_type(), &ModelErrorType::InvalidRequest);
    }

    #[tokio::test]
    async fn group_role_is_unique_and_reusable_after_soft_delete() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let (organization_id, group_id) = setup_group(tx.as_mut()).await;
        let domain = RoleDomain::Organization(organization_id);

        insert(tx.as_mut(), group_id, UserRole::Assistant, domain)
            .await
            .unwrap();

        let err = insert(tx.as_mut(), group_id, UserRole::Assistant, domain)
            .await
            .unwrap_err();
        match err.error_type() {
            ModelErrorType::DatabaseConstraint { constraint, .. } => {
                assert_eq!(constraint, "group_roles_group_role_domain_deleted_at_key");
            }
            other => panic!("unexpected error type: {other:?}"),
        }

        remove(tx.as_mut(), group_id, UserRole::Assistant, domain)
            .await
            .unwrap();
        insert(tx.as_mut(), group_id, UserRole::Assistant, domain)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn group_roles_table_enforces_exactly_one_scope_column() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let (_organization_id, group_id) = setup_group(tx.as_mut()).await;

        let err = sqlx::query(
            r#"
INSERT INTO group_roles (group_id, role)
VALUES ($1, $2)
"#,
        )
        .bind(group_id)
        .bind(UserRole::Assistant)
        .execute(tx.as_mut())
        .await
        .unwrap_err();
        let err = ModelError::from(err);

        match err.error_type() {
            ModelErrorType::DatabaseConstraint { constraint, .. } => {
                assert_eq!(constraint, "group_roles_single_domain");
            }
            other => panic!("unexpected error type: {other:?}"),
        }
    }
}
