use super::ModelResult;
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use sqlx::Type;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Type)]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
pub enum UserRole {
    Admin,
    Assistant,
    Teacher,
    Reviewer,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
pub struct Role {
    pub organization_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub role: UserRole,
}

impl Role {
    pub fn is_global(&self) -> bool {
        self.organization_id.is_none() && self.course_id.is_none()
    }

    pub fn is_role_for_organization(&self, organization_id: Uuid) -> bool {
        self.course_id.is_none()
            && self
                .organization_id
                .map(|id| id == organization_id)
                .unwrap_or_default()
    }

    pub fn is_role_for_course(&self, course_id: Uuid) -> bool {
        self.course_id.map(|id| id == course_id).unwrap_or_default()
    }
}

pub async fn insert(
    conn: &mut PgConnection,
    user_id: Uuid,
    organization_id: Option<Uuid>,
    course_id: Option<Uuid>,
    role: UserRole,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO roles (user_id, organization_id, course_id, role) VALUES ($1, $2, $3, $4) RETURNING id
",
        user_id,
        organization_id,
        course_id,
        role as UserRole
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn get_roles(conn: &mut PgConnection, user_id: Uuid) -> ModelResult<Vec<Role>> {
    let roles = sqlx::query_as!(
        Role,
        r#"SELECT organization_id, course_id, role AS "role: UserRole" FROM roles WHERE user_id = $1"#, user_id
    )
    .fetch_all(conn)
    .await?;
    Ok(roles)
}
