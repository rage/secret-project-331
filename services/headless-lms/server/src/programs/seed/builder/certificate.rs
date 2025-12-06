// services/headless-lms/server/src/programs/seed/builder/certificate.rs
use anyhow::{Context, Result};
use sqlx::{PgConnection, Row};
use uuid::Uuid;

use headless_lms_models::certificate_configurations;
use headless_lms_utils as utils;

#[derive(Debug, Clone)]
pub struct CertificateBuilder {
    user_id: Uuid,
    name_on_certificate: String,
    config_id: Option<Uuid>,
    default_for_module_id: Option<Uuid>,
}

impl CertificateBuilder {
    pub fn new(user_id: Uuid) -> Self {
        Self {
            user_id,
            name_on_certificate: "Example User".into(),
            config_id: None,
            default_for_module_id: None,
        }
    }

    pub fn name_on_certificate(mut self, name: impl Into<String>) -> Self {
        self.name_on_certificate = name.into();
        self
    }

    /// Use a specific certificate_configuration.id
    pub fn configuration_id(mut self, id: Uuid) -> Self {
        self.config_id = Some(id);
        self
    }

    /// Use the default certificate configuration for this module
    pub fn default_configuration_for_module(mut self, module_id: Uuid) -> Self {
        self.default_for_module_id = Some(module_id);
        self
    }

    pub async fn seed(self, conn: &mut PgConnection) -> Result<Uuid> {
        // Resolve configuration id (explicit or default for module).
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

        // Idempotency: if certificate already exists for this user + configuration, return it
        if let Some(existing_id) = sqlx::query(
            r#"
            SELECT id
            FROM generated_certificates
            WHERE user_id = $1
              AND certificate_configuration_id = $2
              AND deleted_at IS NULL
            "#,
        )
        .bind(self.user_id)
        .bind(config_id)
        .map(|row: sqlx::postgres::PgRow| row.get::<Uuid, _>("id"))
        .fetch_optional(&mut *conn)
        .await
        .context("query existing generated_certificates")?
        {
            return Ok(existing_id);
        }

        // No requirements check: just insert the certificate row
        let verification_id = utils::strings::generate_easily_writable_random_string(15);

        let inserted_id = sqlx::query(
            r#"
            INSERT INTO generated_certificates (
                user_id,
                certificate_configuration_id,
                name_on_certificate,
                verification_id
            )
            VALUES ($1, $2, $3, $4)
            RETURNING id
            "#,
        )
        .bind(self.user_id)
        .bind(config_id)
        .bind(self.name_on_certificate)
        .bind(verification_id)
        .map(|row: sqlx::postgres::PgRow| row.get::<Uuid, _>("id"))
        .fetch_one(&mut *conn)
        .await
        .context("insert generated_certificate")?;

        Ok(inserted_id)
    }
}
