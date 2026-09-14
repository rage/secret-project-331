use crate::{
    prelude::*,
    roles::{RoleDomain, UserRole},
};
use utoipa::ToSchema;

#[derive(Debug, Serialize, ToSchema)]

pub struct PendingRole {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub user_email: String,
    pub role: UserRole,
    pub course_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
    pub expires_at: DateTime<Utc>,
}

pub async fn get_all(conn: &mut PgConnection, domain: RoleDomain) -> ModelResult<Vec<PendingRole>> {
    let res = match domain {
        RoleDomain::Global | RoleDomain::Organization(_) | RoleDomain::Exam(_) => {
            return Ok(Vec::new());
        }
        RoleDomain::Course(course_id) => {
            sqlx::query_as!(
                PendingRole,
                r#"
SELECT * FROM pending_roles
WHERE course_id = $1
AND deleted_at IS NULL
AND expires_at > NOW()
          "#,
                course_id
            )
            .fetch_all(&mut *conn)
            .await?
        }
        RoleDomain::CourseInstance(course_instance_id) => {
            sqlx::query_as!(
                PendingRole,
                r#"
SELECT * FROM pending_roles
WHERE course_instance_id = $1
AND deleted_at IS NULL
AND expires_at > NOW()
        "#,
                course_instance_id
            )
            .fetch_all(&mut *conn)
            .await?
        }
    };
    Ok(res)
}
