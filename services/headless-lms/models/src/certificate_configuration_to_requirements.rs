use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CertificateConfigurationToRequirement {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub certificate_configuration_id: Uuid,
    pub course_module_id: Option<Uuid>,
    pub course_instance_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CertificateAllRequirements {
    pub certificate_configuration_id: Uuid,
    pub course_module_ids: Vec<Uuid>,
    pub course_instance_ids: Vec<Uuid>,
}

impl CertificateAllRequirements {
    /** A certificate configuration is a default configuration if the requirement is only for one course module and for one course instance. These types of configurations are regarded as the default because they are the most commonly used ones. */
    pub fn is_default_certificate_configuration(&self) -> bool {
        self.course_module_ids.len() == 1 && self.course_instance_ids.len() == 1
    }

    /** Checks if the user has completed all requirements to be eligible for a certificate. */
    pub async fn has_user_completed_all_requirements(
        &self,
        conn: &mut PgConnection,
        user_id: Uuid,
    ) -> ModelResult<bool> {
        let all_users_completions =
            crate::course_module_completions::get_all_by_user_id(conn, user_id).await?;
        let all_completed_course_instance_ids = all_users_completions
            .iter()
            .map(|o| o.course_instance_id)
            .collect::<Vec<_>>();
        let all_completed_course_module_ids = all_users_completions
            .iter()
            .map(|o| o.course_module_id)
            .collect::<Vec<_>>();
        // Compare the vecs of completed stuff to the requirements
        let all_required_course_instances_completed = self
            .course_instance_ids
            .iter()
            .all(|id| all_completed_course_instance_ids.contains(id));
        let all_required_course_modules_completed = self
            .course_module_ids
            .iter()
            .all(|id| all_completed_course_module_ids.contains(id));
        let result =
            all_required_course_instances_completed && all_required_course_modules_completed;
        if !result {
            let missing_course_instance_ids = self
                .course_instance_ids
                .iter()
                .filter(|id| !all_completed_course_instance_ids.contains(id))
                .collect::<Vec<_>>();
            let missing_course_module_ids = self
                .course_module_ids
                .iter()
                .filter(|id| !all_completed_course_module_ids.contains(id))
                .collect::<Vec<_>>();
            warn!(
                "User {} has not completed all requirements for certificate configuration {}. Missing course instance ids: {:?}, missing course module ids: {:?}.",
                user_id, self.certificate_configuration_id, missing_course_instance_ids, missing_course_module_ids
            )
        }
        Ok(result)
    }
}

pub async fn get_all_requirements_for_certificate_configuration(
    conn: &mut PgConnection,
    certificate_configuration_id: Uuid,
) -> ModelResult<CertificateAllRequirements> {
    let requirements = sqlx::query_as!(
        CertificateConfigurationToRequirement,
        r#"
SELECT *
FROM certificate_configuration_to_requirements
WHERE certificate_configuration_id = $1
AND deleted_at IS NULL
        "#,
        certificate_configuration_id
    )
    .fetch_all(conn)
    .await?;
    let course_module_ids = requirements
        .iter()
        .filter_map(|r| r.course_module_id)
        .collect();
    let course_instance_ids = requirements
        .iter()
        .filter_map(|r| r.course_instance_id)
        .collect();
    Ok(CertificateAllRequirements {
        certificate_configuration_id,
        course_module_ids,
        course_instance_ids,
    })
}

pub async fn insert(
    conn: &mut PgConnection,
    certificate_configuration_id: Uuid,
    course_module_id: Option<Uuid>,
    course_instance_id: Option<Uuid>,
) -> ModelResult<CertificateConfigurationToRequirement> {
    let row = sqlx::query_as!(
        CertificateConfigurationToRequirement,
        r#"
INSERT INTO certificate_configuration_to_requirements (
    certificate_configuration_id,
    course_module_id,
    course_instance_id
  )
VALUES ($1, $2, $3)
RETURNING *
        "#,
        certificate_configuration_id,
        course_module_id,
        course_instance_id
    )
    .fetch_one(conn)
    .await?;
    Ok(row)
}
