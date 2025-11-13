// services/headless-lms/server/src/programs/seed/builder/certificate.rs
use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::Row;
use sqlx::PgConnection;
use uuid::Uuid;

use headless_lms_models::{
    certificate_configuration_to_requirements, certificate_configurations, generated_certificates,
};

#[derive(Debug, Clone)]
pub struct CertificateBuilder {
    user_id: Uuid,
    name_on_certificate: String,
    config_id: Option<Uuid>,
    default_for_module_id: Option<Uuid>,
    ensure_requirements: bool,
}

impl CertificateBuilder {
    pub fn new(user_id: Uuid) -> Self {
        Self {
            user_id,
            name_on_certificate: "Example User".into(),
            config_id: None,
            default_for_module_id: None,
            ensure_requirements: false,
        }
    }

    pub fn name_on_certificate(mut self, name: impl Into<String>) -> Self {
        self.name_on_certificate = name.into();
        self
    }

    pub fn configuration_id(mut self, id: Uuid) -> Self {
        self.config_id = Some(id);
        self
    }

    pub fn default_configuration_for_module(mut self, module_id: Uuid) -> Self {
        self.default_for_module_id = Some(module_id);
        self
    }

    pub fn ensure_requirements(mut self, on: bool) -> Self {
        self.ensure_requirements = on;
        self
    }

    pub async fn seed(self, conn: &mut PgConnection) -> Result<Uuid> {
        // 1) Resolve configuration id (explicit or default for module)
        let config_id = match (self.config_id, self.default_for_module_id) {
            (Some(id), _) => id,
            (None, Some(module_id)) => {
                let conf = certificate_configurations::get_default_configuration_by_course_module(
                    conn, module_id,
                )
                .await
                .context("get_default_configuration_by_course_module")?;
                conf.id
            }
            _ => anyhow::bail!(
                "CertificateBuilder: provide configuration_id or default_configuration_for_module"
            ),
        };

        // 2) Optionally ensure all requirement modules are completed for this user
        if self.ensure_requirements {
            let reqs = certificate_configuration_to_requirements::
                get_all_requirements_for_certificate_configuration(conn, config_id)
                .await
                .context("get_all_requirements_for_certificate_configuration")?;

            for req in reqs {
                let course_module_id = req.course_module_id;

                // Fetch course_id + email for this user + module
                let (course_id, email): (Uuid, String) = sqlx::query(
                    r#"
                    SELECT m.course_id,
                           COALESCE(ud.email, '') AS email
                    FROM course_modules m
                    LEFT JOIN users u ON u.id = $1
                    LEFT JOIN user_details ud ON ud.user_id = u.id
                    WHERE m.id = $2
                    "#,
                )
                .bind(self.user_id)
                .bind(course_module_id)
                .map(|row: sqlx::postgres::PgRow| {
                    (
                        row.get::<Uuid, _>("course_id"),
                        row.get::<String, _>("email"),
                    )
                })
                .fetch_one(&mut *conn)
                .await
                .context("fetch course_id/email for requirement module")?;

                sqlx::query(
                    r#"
                    INSERT INTO course_module_completions (
                        course_id,
                        course_module_id,
                        user_id,
                        completion_date,
                        completion_language,
                        eligible_for_ects,
                        email,
                        grade,
                        passed,
                        prerequisite_modules_completed,
                        needs_to_be_reviewed
                    )
                    SELECT $1, $2, $3, $4, $5, true, $6, 5, true, true, false
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM course_module_completions
                        WHERE course_id = $1
                          AND course_module_id = $2
                          AND user_id = $3
                          AND completion_granter_user_id IS NULL
                          AND deleted_at IS NULL
                    )
                    "#,
                )
                .bind(course_id)
                .bind(course_module_id)
                .bind(self.user_id)
                .bind(Utc::now())
                .bind("en")
                .bind(email)
                .execute(&mut *conn)
                .await
                .context("insert-or-skip passed completion for requirement")?;
            }
        }

        // 3) Finally generate the certificate
        let gc = generated_certificates::generate_and_insert(
            conn,
            self.user_id,
            &self.name_on_certificate,
            config_id,
        )
        .await
        .context("generate_and_insert")?;

        Ok(gc.id)
    }
}
