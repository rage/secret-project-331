use crate::{
    prelude::*,
    roles::{RoleDomain, RoleInfo, UserRole},
};

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PendingRole {
    pub id: Uuid,
    pub user_email: String,
    pub role: UserRole,
    pub expires_at: DateTime<Utc>,
}

pub async fn insert(conn: &mut PgConnection, role_info: RoleInfo) -> ModelResult<Uuid> {
    match role_info.domain {
        crate::roles::RoleDomain::Global
        | crate::roles::RoleDomain::Organization(_)
        | crate::roles::RoleDomain::Exam(_) => {
            return Err(ModelError::new(
                ModelErrorType::InvalidRequest,
                "Cannot use a pending role for a role this broad".to_string(),
                None,
            ));
        }

        crate::roles::RoleDomain::Course(_) | crate::roles::RoleDomain::CourseInstance(_) => (),
    };

    match role_info.role {
        UserRole::Admin | UserRole::Teacher => {
            return Err(ModelError::new(
                ModelErrorType::InvalidRequest,
                "Cannot use a pending role with this much power".to_string(),
                None,
            ))
        }
        UserRole::Reviewer
        | UserRole::Assistant
        | UserRole::CourseOrExamCreator
        | UserRole::MaterialViewer => (),
    }

    let course_id = match role_info.domain {
        crate::roles::RoleDomain::Course(id) => Some(id),
        _ => None,
    };

    let course_instance_id = match role_info.domain {
        crate::roles::RoleDomain::CourseInstance(id) => Some(id),
        _ => None,
    };

    let id = sqlx::query!(
        r#"
INSERT INTO pending_roles (user_email, role, course_id, course_instance_id)
VALUES ($1, $2, $3, $4)
RETURNING id;
"#,
        role_info.email,
        role_info.role as UserRole,
        course_id,
        course_instance_id
    )
    .fetch_one(conn)
    .await?
    .id;
    Ok(id)
}

pub async fn get_all(conn: &mut PgConnection, domain: RoleDomain) -> ModelResult<Vec<PendingRole>> {
    let res = match domain {
        RoleDomain::Global | RoleDomain::Organization(_) | RoleDomain::Exam(_) => {
            return Ok(Vec::new())
        }
        RoleDomain::Course(course_id) => {
            sqlx::query_as!(
                PendingRole,
                r#"
SELECT id, user_email, expires_at, role AS "role!: UserRole" FROM pending_roles
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
SELECT id, user_email, expires_at, role AS "role!: UserRole" FROM pending_roles
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
