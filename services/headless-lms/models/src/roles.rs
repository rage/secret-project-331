use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
pub enum UserRole {
    Reviewer,
    Assistant,
    Teacher,
    Admin,
    CourseOrExamCreator,
    MaterialViewer,
    TeachingAndLearningServices,
    StatsViewer,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
pub struct Role {
    pub is_global: bool,
    pub organization_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub role: UserRole,
    pub user_id: Uuid,
}

impl Role {
    pub fn is_global(&self) -> bool {
        self.is_global
    }

    pub fn is_role_for_organization(&self, organization_id: Uuid) -> bool {
        self.organization_id
            .map(|id| id == organization_id)
            .unwrap_or_default()
    }

    pub fn is_role_for_course(&self, course_id: Uuid) -> bool {
        self.course_id.map(|id| id == course_id).unwrap_or_default()
    }

    pub fn is_role_for_course_instance(&self, course_instance_id: Uuid) -> bool {
        self.course_instance_id
            .map(|id| id == course_instance_id)
            .unwrap_or_default()
    }

    pub fn is_role_for_exam(&self, exam_id: Uuid) -> bool {
        self.exam_id.map(|id| id == exam_id).unwrap_or_default()
    }

    /// Returns a human-readable description of the domain this role applies to
    pub fn domain_description(&self) -> String {
        if self.is_global {
            "Global".to_string()
        } else if let Some(id) = self.organization_id {
            format!("Organization {}", id)
        } else if let Some(id) = self.course_id {
            format!("Course {}", id)
        } else if let Some(id) = self.course_instance_id {
            format!("CourseInstance {}", id)
        } else if let Some(id) = self.exam_id {
            format!("Exam {}", id)
        } else {
            "Unknown domain".to_string()
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(tag = "tag", content = "id")]
pub enum RoleDomain {
    Global,
    Organization(Uuid),
    Course(Uuid),
    CourseInstance(Uuid),
    Exam(Uuid),
}

#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct RoleInfo {
    pub email: String,
    pub role: UserRole,
    pub domain: RoleDomain,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct RoleUser {
    pub user_id: Uuid,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: String,
    pub role: UserRole,
}

pub async fn get(conn: &mut PgConnection, domain: RoleDomain) -> ModelResult<Vec<RoleUser>> {
    let users = match domain {
        RoleDomain::Global => {
            sqlx::query_as!(
                RoleUser,
                r#"
SELECT users.id AS "user_id!",
  user_details.first_name,
  user_details.last_name,
  user_details.email,
  role AS "role!: UserRole"
FROM users
  JOIN roles ON users.id = roles.user_id
  JOIN user_details ON users.id = user_details.user_id
WHERE is_global = TRUE
AND roles.deleted_at IS NULL
"#,
            )
            .fetch_all(conn)
            .await?
        }
        RoleDomain::Organization(id) => {
            sqlx::query_as!(
                RoleUser,
                r#"
SELECT users.id AS "user_id!",
  user_details.first_name,
  user_details.last_name,
  user_details.email,
  role AS "role: UserRole"
FROM users
  JOIN roles ON users.id = roles.user_id
  JOIN user_details ON users.id = user_details.user_id
WHERE roles.organization_id = $1
AND roles.deleted_at IS NULL
"#,
                id
            )
            .fetch_all(conn)
            .await?
        }
        RoleDomain::Course(id) => {
            sqlx::query_as!(
                RoleUser,
                r#"
SELECT users.id AS "user_id!",
  user_details.first_name,
  user_details.last_name,
  user_details.email,
  role AS "role: UserRole"
FROM users
  JOIN roles ON users.id = roles.user_id
  JOIN user_details ON users.id = user_details.user_id
WHERE roles.course_id = $1
AND roles.deleted_at IS NULL
"#,
                id
            )
            .fetch_all(conn)
            .await?
        }
        RoleDomain::CourseInstance(id) => {
            sqlx::query_as!(
                RoleUser,
                r#"
SELECT users.id AS "user_id!",
  user_details.first_name,
  user_details.last_name,
  user_details.email,
  role AS "role: UserRole"
FROM users
  JOIN roles ON users.id = roles.user_id
  JOIN user_details ON users.id = user_details.user_id
WHERE roles.course_instance_id = $1
AND roles.deleted_at IS NULL
"#,
                id
            )
            .fetch_all(conn)
            .await?
        }
        RoleDomain::Exam(id) => {
            sqlx::query_as!(
                RoleUser,
                r#"
SELECT users.id AS "user_id!",
  user_details.first_name,
  user_details.last_name,
  user_details.email,
  role AS "role: UserRole"
FROM users
  JOIN roles ON users.id = roles.user_id
  JOIN user_details ON users.id = user_details.user_id
WHERE roles.exam_id = $1
AND roles.deleted_at IS NULL
"#,
                id
            )
            .fetch_all(conn)
            .await?
        }
    };
    Ok(users)
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    role: UserRole,
    domain: RoleDomain,
) -> ModelResult<Uuid> {
    let id = match domain {
        RoleDomain::Global => {
            sqlx::query!(
                "
INSERT INTO roles (user_id, role, is_global)
VALUES ($1, $2, True)
RETURNING id
",
                user_id,
                role as UserRole
            )
            .fetch_one(conn)
            .await?
            .id
        }
        RoleDomain::Organization(id) => {
            sqlx::query!(
                "
INSERT INTO roles (user_id, role, organization_id)
VALUES ($1, $2, $3)
RETURNING id
",
                user_id,
                role as UserRole,
                id
            )
            .fetch_one(conn)
            .await?
            .id
        }
        RoleDomain::Course(id) => {
            sqlx::query!(
                "
INSERT INTO roles (user_id, role, course_id)
VALUES ($1, $2, $3)
RETURNING id
",
                user_id,
                role as UserRole,
                id
            )
            .fetch_one(conn)
            .await?
            .id
        }
        RoleDomain::CourseInstance(id) => {
            sqlx::query!(
                "
INSERT INTO roles (user_id, role, course_instance_id)
VALUES ($1, $2, $3)
RETURNING id
",
                user_id,
                role as UserRole,
                id
            )
            .fetch_one(conn)
            .await?
            .id
        }
        RoleDomain::Exam(id) => {
            sqlx::query!(
                "
INSERT INTO roles (user_id, role, exam_id)
VALUES ($1, $2, $3)
RETURNING id
",
                user_id,
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
    user_id: Uuid,
    role: UserRole,
    domain: RoleDomain,
) -> ModelResult<()> {
    match domain {
        RoleDomain::Global => {
            sqlx::query!(
                "
UPDATE roles
SET deleted_at = NOW()
WHERE user_id = $1
  AND role = $2
  AND deleted_at IS NULL
",
                user_id,
                role as UserRole
            )
            .execute(conn)
            .await?;
        }
        RoleDomain::Organization(id) => {
            sqlx::query!(
                "
UPDATE roles
SET deleted_at = NOW()
WHERE user_id = $1
  AND role = $2
  AND organization_id = $3
  AND deleted_at IS NULL
",
                user_id,
                role as UserRole,
                id
            )
            .execute(conn)
            .await?;
        }
        RoleDomain::Course(id) => {
            sqlx::query!(
                "
UPDATE roles
SET deleted_at = NOW()
WHERE user_id = $1
  AND role = $2
  AND course_id = $3
  AND deleted_at IS NULL
",
                user_id,
                role as UserRole,
                id
            )
            .execute(conn)
            .await?;
        }
        RoleDomain::CourseInstance(id) => {
            sqlx::query!(
                "
UPDATE roles
SET deleted_at = NOW()
WHERE user_id = $1
  AND role = $2
  AND course_instance_id = $3
  AND deleted_at IS NULL
",
                user_id,
                role as UserRole,
                id
            )
            .execute(conn)
            .await?;
        }
        RoleDomain::Exam(id) => {
            sqlx::query!(
                "
UPDATE roles
SET deleted_at = NOW()
WHERE user_id = $1
  AND role = $2
  AND exam_id = $3
  AND deleted_at IS NULL
",
                user_id,
                role as UserRole,
                id
            )
            .execute(conn)
            .await?;
        }
    }
    Ok(())
}

pub async fn get_roles(conn: &mut PgConnection, user_id: Uuid) -> ModelResult<Vec<Role>> {
    let roles = sqlx::query_as!(
        Role,
        r#"
SELECT is_global AS "is_global!",
  organization_id,
  course_id,
  course_instance_id,
  exam_id,
  role AS "role: UserRole",
  user_id
FROM roles
WHERE user_id = $1
AND roles.deleted_at IS NULL
"#,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(roles)
}

pub async fn get_effective_roles(conn: &mut PgConnection, user_id: Uuid) -> ModelResult<Vec<Role>> {
    let roles = sqlx::query_as!(
        Role,
        r#"
SELECT is_global AS "is_global!",
  organization_id,
  course_id,
  course_instance_id,
  exam_id,
  role AS "role!: UserRole",
  user_id AS "user_id!"
FROM roles
WHERE user_id = $1
  AND roles.deleted_at IS NULL
UNION
SELECT FALSE AS "is_global!",
  gr.organization_id,
  gr.course_id,
  gr.course_instance_id,
  gr.exam_id,
  gr.role AS "role: UserRole",
  gm.user_id
FROM group_memberships gm
  JOIN groups g ON g.id = gm.group_id
  JOIN group_roles gr ON gr.group_id = gm.group_id
WHERE gm.user_id = $1
  AND gm.deleted_at IS NULL
  AND g.deleted_at IS NULL
  AND gr.deleted_at IS NULL
"#,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(roles)
}

/// Gets all roles related to a specific course.
/// This includes:
/// - Global roles
/// - Organization roles for the organization that owns the course
/// - Course roles for this specific course
/// - Course instance roles for any instance of this course
/// - Group-derived roles for the same scopes above
pub async fn get_course_related_roles(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<Role>> {
    let roles = sqlx::query_as!(
        Role,
        r#"
WITH course_org AS (
  SELECT organization_id
  FROM courses
  WHERE id = $1
    AND deleted_at IS NULL
)
SELECT is_global AS "is_global!",
  organization_id,
  course_id,
  course_instance_id,
  exam_id,
  role AS "role!: UserRole",
  user_id AS "user_id!"
FROM roles
WHERE (
    is_global = TRUE
    OR organization_id = (
      SELECT organization_id
      FROM course_org
    )
    OR course_id = $1
    OR course_instance_id IN (
      SELECT id
      FROM course_instances
      WHERE course_id = $1
        AND deleted_at IS NULL
    )
  )
  AND deleted_at IS NULL
UNION
SELECT FALSE AS "is_global!",
  gr.organization_id,
  gr.course_id,
  gr.course_instance_id,
  gr.exam_id,
  gr.role AS "role: UserRole",
  gm.user_id
FROM group_roles gr
  JOIN group_memberships gm ON gm.group_id = gr.group_id
  JOIN groups g ON g.id = gm.group_id
WHERE (
    gr.organization_id = (
      SELECT organization_id
      FROM course_org
    )
    OR gr.course_id = $1
    OR gr.course_instance_id IN (
      SELECT id
      FROM course_instances
      WHERE course_id = $1
        AND deleted_at IS NULL
    )
  )
  AND gr.deleted_at IS NULL
  AND gm.deleted_at IS NULL
  AND g.deleted_at IS NULL
"#,
        course_id
    )
    .fetch_all(conn)
    .await?;

    Ok(roles)
}

/// Gets all roles related to any course in a language group.
/// This includes global roles, organization roles for any organization that has a course in the group,
/// course roles for any course in the group, course instance roles for any instance of those courses,
/// and group-derived roles for the same scopes.
pub async fn get_course_language_group_related_roles(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
) -> ModelResult<Vec<Role>> {
    let roles = sqlx::query_as!(
        Role,
        r#"
WITH course_org AS (
  SELECT DISTINCT organization_id
  FROM courses
  WHERE course_language_group_id = $1
    AND deleted_at IS NULL
)
SELECT is_global AS "is_global!",
  organization_id,
  course_id,
  course_instance_id,
  exam_id,
  role AS "role!: UserRole",
  user_id AS "user_id!"
FROM roles
WHERE (
    is_global = TRUE
    OR organization_id IN (
      SELECT organization_id
      FROM course_org
    )
    OR course_id IN (
      SELECT id
      FROM courses
      WHERE course_language_group_id = $1
        AND deleted_at IS NULL
    )
    OR course_instance_id IN (
      SELECT ci.id
      FROM course_instances ci
        JOIN courses c ON ci.course_id = c.id
      WHERE c.course_language_group_id = $1
        AND ci.deleted_at IS NULL
    )
  )
  AND deleted_at IS NULL
UNION
SELECT FALSE AS "is_global!",
  gr.organization_id,
  gr.course_id,
  gr.course_instance_id,
  gr.exam_id,
  gr.role AS "role: UserRole",
  gm.user_id
FROM group_roles gr
  JOIN group_memberships gm ON gm.group_id = gr.group_id
  JOIN groups g ON g.id = gm.group_id
WHERE (
    gr.organization_id IN (
      SELECT organization_id
      FROM course_org
    )
    OR gr.course_id IN (
      SELECT id
      FROM courses
      WHERE course_language_group_id = $1
        AND deleted_at IS NULL
    )
    OR gr.course_instance_id IN (
      SELECT ci.id
      FROM course_instances ci
        JOIN courses c ON ci.course_id = c.id
      WHERE c.course_language_group_id = $1
        AND ci.deleted_at IS NULL
    )
  )
  AND gr.deleted_at IS NULL
  AND gm.deleted_at IS NULL
  AND g.deleted_at IS NULL
"#,
        course_language_group_id
    )
    .fetch_all(conn)
    .await?;

    Ok(roles)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{group_memberships, group_roles, groups, organizations, test_helper::Conn, users};

    fn unique_text(prefix: &str) -> String {
        format!("{prefix}-{}", Uuid::new_v4())
    }

    async fn setup_user_and_org(conn: &mut PgConnection) -> (Uuid, Uuid) {
        let email = format!("{}@example.com", unique_text("user"));
        let user_id = users::insert(
            conn,
            PKeyPolicy::Generate,
            &email,
            Some("Test"),
            Some("User"),
        )
        .await
        .unwrap();
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
        (user_id, organization_id)
    }

    #[tokio::test]
    async fn effective_roles_include_direct_and_group_roles() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let (user_id, organization_id) = setup_user_and_org(tx.as_mut()).await;

        insert(
            tx.as_mut(),
            user_id,
            UserRole::Admin,
            RoleDomain::Organization(organization_id),
        )
        .await
        .unwrap();

        let group = groups::create(tx.as_mut(), organization_id, "Teaching team")
            .await
            .unwrap();
        group_memberships::add_member(tx.as_mut(), group.id, user_id)
            .await
            .unwrap();
        group_roles::insert(
            tx.as_mut(),
            group.id,
            UserRole::Assistant,
            RoleDomain::Organization(organization_id),
        )
        .await
        .unwrap();

        let direct_roles = get_roles(tx.as_mut(), user_id).await.unwrap();
        assert_eq!(direct_roles.len(), 1);
        assert_eq!(direct_roles[0].role, UserRole::Admin);

        let effective_roles = get_effective_roles(tx.as_mut(), user_id).await.unwrap();
        assert_eq!(effective_roles.len(), 2);
        assert!(effective_roles.iter().any(|r| r.role == UserRole::Admin));
        assert!(
            effective_roles
                .iter()
                .any(|r| r.role == UserRole::Assistant)
        );
    }

    #[tokio::test]
    async fn soft_deleted_group_stops_granting_effective_roles_immediately() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;
        let (user_id, organization_id) = setup_user_and_org(tx.as_mut()).await;

        let group = groups::create(tx.as_mut(), organization_id, "Graders")
            .await
            .unwrap();
        group_memberships::add_member(tx.as_mut(), group.id, user_id)
            .await
            .unwrap();
        group_roles::insert(
            tx.as_mut(),
            group.id,
            UserRole::Assistant,
            RoleDomain::Organization(organization_id),
        )
        .await
        .unwrap();

        let before_delete = get_effective_roles(tx.as_mut(), user_id).await.unwrap();
        assert_eq!(before_delete.len(), 1);
        assert_eq!(before_delete[0].role, UserRole::Assistant);

        groups::soft_delete_with_dependents(tx.as_mut(), group.id)
            .await
            .unwrap();

        let after_delete = get_effective_roles(tx.as_mut(), user_id).await.unwrap();
        assert!(after_delete.is_empty());
    }
}
