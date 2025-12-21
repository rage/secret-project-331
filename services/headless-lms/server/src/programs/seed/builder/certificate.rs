use anyhow::{Context, Result};
use sqlx::PgConnection;
use uuid::Uuid;

use certificate_configurations::get_default_configuration_by_course_module;
use headless_lms_models::certificate_configurations;
use headless_lms_models::generated_certificates::{find_existing, insert_raw};
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
        // Resolve configuration id (explicit or default for a module)
        let config_id = if let Some(id) = self.config_id {
            id
        } else if let Some(module_id) = self.default_for_module_id {
            let conf = get_default_configuration_by_course_module(conn, module_id)
                .await
                .context("get_default_configuration_by_course_module")?;

            conf.id
        } else {
            anyhow::bail!(
                "CertificateBuilder: provide configuration_id or default_configuration_for_module"
            );
        };

        // 1) Check if certificate already exists
        if let Some(existing_id) = find_existing(conn, self.user_id, config_id).await? {
            return Ok(existing_id);
        }

        // 2) Insert new certificate
        let verification_id = utils::strings::generate_easily_writable_random_string(15);

        let inserted_id = insert_raw(
            conn,
            self.user_id,
            config_id,
            &self.name_on_certificate,
            &verification_id,
        )
        .await
        .context("insert generated_certificate")?;
        Ok(inserted_id)
    }
}
