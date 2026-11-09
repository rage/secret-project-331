use crate::{
    prelude::*,
    roles::{RoleDomain, UserRole},
};
use utoipa::ToSchema;

/// A role granted to an email address that is not verified yet. See [`activate_for_user`].
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
    pub organization_id: Option<Uuid>,
    pub exam_id: Option<Uuid>,
    pub is_global: bool,
}

/// Columns of a pending role's domain, mirroring how `roles` stores it.
struct DomainColumns {
    organization_id: Option<Uuid>,
    course_id: Option<Uuid>,
    course_instance_id: Option<Uuid>,
    exam_id: Option<Uuid>,
    is_global: bool,
}

impl From<RoleDomain> for DomainColumns {
    fn from(domain: RoleDomain) -> Self {
        let mut columns = DomainColumns {
            organization_id: None,
            course_id: None,
            course_instance_id: None,
            exam_id: None,
            is_global: false,
        };
        match domain {
            RoleDomain::Global => columns.is_global = true,
            RoleDomain::Organization(id) => columns.organization_id = Some(id),
            RoleDomain::Course(id) => columns.course_id = Some(id),
            RoleDomain::CourseInstance(id) => columns.course_instance_id = Some(id),
            RoleDomain::Exam(id) => columns.exam_id = Some(id),
        }
        columns
    }
}

/// The live pending roles of one domain.
pub async fn get_all(conn: &mut PgConnection, domain: RoleDomain) -> ModelResult<Vec<PendingRole>> {
    let columns = DomainColumns::from(domain);
    let res = sqlx::query_as!(
        PendingRole,
        r#"
SELECT *
FROM pending_roles
WHERE organization_id IS NOT DISTINCT FROM $1
  AND course_id IS NOT DISTINCT FROM $2
  AND course_instance_id IS NOT DISTINCT FROM $3
  AND exam_id IS NOT DISTINCT FROM $4
  AND is_global = $5
  AND deleted_at IS NULL
  AND expires_at > NOW()
        "#,
        columns.organization_id,
        columns.course_id,
        columns.course_instance_id,
        columns.exam_id,
        columns.is_global,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Records a role for an address that is not verified yet. It takes effect when the account
/// holding that address verifies it, through [`activate_for_user`].
pub async fn insert(
    conn: &mut PgConnection,
    user_email: &str,
    role: UserRole,
    domain: RoleDomain,
) -> ModelResult<Uuid> {
    let columns = DomainColumns::from(domain);
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO pending_roles (
    user_email,
    role,
    organization_id,
    course_id,
    course_instance_id,
    exam_id,
    is_global
  )
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id
        "#,
        user_email.trim(),
        role as UserRole,
        columns.organization_id,
        columns.course_id,
        columns.course_instance_id,
        columns.exam_id,
        columns.is_global,
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

/// Withdraws the live pending roles of `role` in `domain` for an address, as removing a role does.
pub async fn delete(
    conn: &mut PgConnection,
    user_email: &str,
    role: UserRole,
    domain: RoleDomain,
) -> ModelResult<u64> {
    let columns = DomainColumns::from(domain);
    let res = sqlx::query!(
        r#"
UPDATE pending_roles
SET deleted_at = NOW()
WHERE lower(user_email) = lower($1)
  AND role = $2
  AND organization_id IS NOT DISTINCT FROM $3
  AND course_id IS NOT DISTINCT FROM $4
  AND course_instance_id IS NOT DISTINCT FROM $5
  AND exam_id IS NOT DISTINCT FROM $6
  AND is_global = $7
  AND deleted_at IS NULL
        "#,
        user_email.trim(),
        role as UserRole,
        columns.organization_id,
        columns.course_id,
        columns.course_instance_id,
        columns.exam_id,
        columns.is_global,
    )
    .execute(conn)
    .await?;
    Ok(res.rows_affected())
}

/// Turns the live pending roles for the user's current email into roles, if that email is verified.
/// Returns how many roles were granted.
///
/// Call after anything that verifies an email; it does nothing for an unverified one.
pub async fn activate_for_user(conn: &mut PgConnection, user_id: Uuid) -> ModelResult<u64> {
    let mut tx = conn.begin().await?;
    let granted = sqlx::query_scalar!(
        r#"
WITH activated AS (
  UPDATE pending_roles pr
  SET deleted_at = NOW()
  FROM user_details ud
  WHERE ud.user_id = $1
    AND ud.email_verified_at IS NOT NULL
    AND lower(pr.user_email) = lower(ud.email)
    AND pr.deleted_at IS NULL
    AND pr.expires_at > NOW()
  RETURNING pr.role,
    pr.organization_id,
    pr.course_id,
    pr.course_instance_id,
    pr.exam_id,
    pr.is_global
),
granted AS (
  INSERT INTO roles (
      user_id,
      role,
      organization_id,
      course_id,
      course_instance_id,
      exam_id,
      is_global
    )
  SELECT DISTINCT $1::uuid,
    a.role,
    a.organization_id,
    a.course_id,
    a.course_instance_id,
    a.exam_id,
    a.is_global
  FROM activated a
  WHERE NOT EXISTS (
      SELECT 1
      FROM roles r
      WHERE r.user_id = $1
        AND r.role = a.role
        AND r.organization_id IS NOT DISTINCT FROM a.organization_id
        AND r.course_id IS NOT DISTINCT FROM a.course_id
        AND r.course_instance_id IS NOT DISTINCT FROM a.course_instance_id
        AND r.exam_id IS NOT DISTINCT FROM a.exam_id
        AND r.is_global = a.is_global
        AND r.deleted_at IS NULL
    )
  RETURNING id
)
SELECT COUNT(*) AS "count!"
FROM granted
        "#,
        user_id,
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(granted.try_into().unwrap_or_default())
}

/// How many live pending roles wait for the user to verify their current email. Zero once it is
/// verified, since verifying activates them.
pub async fn count_waiting_for_user(conn: &mut PgConnection, user_id: Uuid) -> ModelResult<i64> {
    let count = sqlx::query_scalar!(
        r#"
SELECT COUNT(*) AS "count!"
FROM pending_roles pr
  JOIN user_details ud ON lower(pr.user_email) = lower(ud.email)
WHERE ud.user_id = $1
  AND ud.email_verified_at IS NULL
  AND pr.deleted_at IS NULL
  AND pr.expires_at > NOW()
        "#,
        user_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        roles,
        test_helper::*,
        user_details::{self, EmailVerificationMethod},
    };

    #[tokio::test]
    async fn a_pending_role_waits_for_the_email_to_be_verified() {
        insert_data!(:tx, :user, :org, :course);
        let email = user_details::get_user_details_by_user_id(tx.as_mut(), user)
            .await
            .unwrap()
            .email;
        insert(
            tx.as_mut(),
            &email.to_uppercase(),
            UserRole::Assistant,
            RoleDomain::Course(course),
        )
        .await
        .unwrap();

        assert_eq!(activate_for_user(tx.as_mut(), user).await.unwrap(), 0);
        assert_eq!(count_waiting_for_user(tx.as_mut(), user).await.unwrap(), 1);
        assert!(
            roles::get_roles(tx.as_mut(), user)
                .await
                .unwrap()
                .is_empty()
        );

        user_details::set_email_verified(
            tx.as_mut(),
            user,
            EmailVerificationMethod::EmailedCode,
            Utc::now(),
        )
        .await
        .unwrap();

        let roles = roles::get_roles(tx.as_mut(), user).await.unwrap();
        assert_eq!(roles.len(), 1);
        assert_eq!(roles[0].role, UserRole::Assistant);
        assert_eq!(roles[0].course_id, Some(course));
        assert!(
            get_all(tx.as_mut(), RoleDomain::Course(course))
                .await
                .unwrap()
                .is_empty()
        );
        assert_eq!(count_waiting_for_user(tx.as_mut(), user).await.unwrap(), 0);
    }

    #[tokio::test]
    async fn a_pending_role_for_another_address_is_not_granted() {
        insert_data!(:tx, :user, :org);
        insert(
            tx.as_mut(),
            "someone-else@example.com",
            UserRole::Teacher,
            RoleDomain::Organization(org),
        )
        .await
        .unwrap();
        user_details::set_email_verified(
            tx.as_mut(),
            user,
            EmailVerificationMethod::EmailedCode,
            Utc::now(),
        )
        .await
        .unwrap();
        assert!(
            roles::get_roles(tx.as_mut(), user)
                .await
                .unwrap()
                .is_empty()
        );
        assert_eq!(
            get_all(tx.as_mut(), RoleDomain::Organization(org))
                .await
                .unwrap()
                .len(),
            1
        );
    }
}
