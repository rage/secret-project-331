use std::env;

use anyhow::Result;
use chrono::Utc;
use dotenv::dotenv;
use headless_lms_actix::{
    models::course_instances::{
        get_all_course_instances, update_course_instance_variant_status, VariantStatus,
    },
    setup_tracing,
};
use sqlx::PgPool;

#[tokio::main]
async fn main() -> Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info");
    dotenv().ok();
    setup_tracing()?;

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let db_pool = PgPool::connect(&database_url).await?;
    let mut transaction = db_pool.begin().await?;

    let course_instances = get_all_course_instances(&mut transaction).await?;

    for course_instance in course_instances {
        if course_instance.variant_status == VariantStatus::Upcoming {
            if let Some(starts_at) = course_instance.starts_at {
                if starts_at <= Utc::now() {
                    update_course_instance_variant_status(
                        &mut transaction,
                        course_instance.id,
                        VariantStatus::Active,
                    )
                    .await?;
                }
            }
        } else if course_instance.variant_status == VariantStatus::Active {
            if let Some(ends_at) = course_instance.ends_at {
                if ends_at <= Utc::now() {
                    update_course_instance_variant_status(
                        &mut transaction,
                        course_instance.id,
                        VariantStatus::Ended,
                    )
                    .await?;
                }
            }
        }
    }

    transaction.commit().await?;

    Ok(())
}
