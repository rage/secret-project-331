use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type, TS)]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
pub enum UserRole {
    Admin,
    Assistant,
    Teacher,
    Reviewer,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
pub struct Role {
    pub is_global: bool,
    pub organization_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub role: UserRole,
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
}

#[derive(Debug, Clone, Copy, Deserialize, TS)]
#[serde(tag = "tag", content = "id")]
pub enum RoleDomain {
    Global,
    Organization(Uuid),
    Course(Uuid),
    CourseInstance(Uuid),
    Exam(Uuid),
}

#[derive(Debug, Serialize, TS)]
pub struct RoleUser {
    id: Uuid,
    first_name: Option<String>,
    last_name: Option<String>,
    email: String,
    role: UserRole,
}

pub async fn get(conn: &mut PgConnection, domain: RoleDomain) -> ModelResult<Vec<RoleUser>> {
    let users = match domain {
        RoleDomain::Global => {
            sqlx::query_as!(
                RoleUser,
                r#"
SELECT users.id AS "id!",
  users.first_name,
  users.last_name,
  email AS "email!",
  role AS "role!: UserRole"
FROM users
  JOIN roles ON users.id = roles.user_id
WHERE is_global = TRUE
"#,
            )
            .fetch_all(conn)
            .await?
        }
        RoleDomain::Organization(id) => {
            sqlx::query_as!(
                RoleUser,
                r#"
SELECT users.id,
  users.first_name,
  users.last_name,
  email,
  role AS "role: UserRole"
FROM users
  JOIN roles ON users.id = roles.user_id
WHERE roles.organization_id = $1
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
SELECT users.id,
  users.first_name,
  users.last_name,
  email,
  role AS "role: UserRole"
FROM users
  JOIN roles ON users.id = roles.user_id
WHERE roles.course_id = $1
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
SELECT users.id,
  users.first_name,
  users.last_name,
  email,
  role AS "role: UserRole"
FROM users
  JOIN roles ON users.id = roles.user_id
WHERE roles.course_instance_id = $1
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
SELECT users.id,
  users.first_name,
  users.last_name,
  email,
  role AS "role: UserRole"
FROM users
  JOIN roles ON users.id = roles.user_id
WHERE roles.exam_id = $1
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
DELETE FROM roles
WHERE user_id = $1
  AND role = $2
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
DELETE FROM roles
WHERE user_id = $1
  AND role = $2
  AND organization_id = $3
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
DELETE FROM roles
WHERE user_id = $1
  AND role = $2
  AND course_id = $3
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
DELETE FROM roles
WHERE user_id = $1
  AND role = $2
  AND course_instance_id = $3
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
DELETE FROM roles
WHERE user_id = $1
  AND role = $2
  AND exam_id = $3
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
SELECT is_global,
  organization_id,
  course_id,
  course_instance_id,
  exam_id,
  role AS "role: UserRole"
FROM roles
WHERE user_id = $1
"#,
        user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(roles)
}
