use anyhow::Result;
use chrono::Utc;
use dotenv::dotenv;
use headless_lms_actix::models::course_instances::{CourseInstance, VariantStatus};
use sqlx::PgPool;
use std::env;

#[tokio::main]
async fn main() -> Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info");
    dotenv().ok();
    tracing_subscriber::fmt().init();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let db_pool = PgPool::connect(&database_url).await?;
    let mut transaction = db_pool.begin().await?;

    let course_instances = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT
    id, created_at, updated_at, deleted_at, course_id, starts_at, ends_at, name, description, variant_status as "variant_status: VariantStatus"
FROM course_instances
WHERE deleted_at IS NOT NULL;
"#
    )
    .fetch_all(&mut transaction)
    .await?;

    for course_instance in course_instances {
        if course_instance.variant_status == VariantStatus::Upcoming {
            if let Some(starts_at) = course_instance.starts_at {
                if starts_at <= Utc::now() {
                    sqlx::query!(
                        r#"
UPDATE course_instances
SET variant_status = $1
WHERE id = $2;
"#,
                        VariantStatus::Active as _,
                        course_instance.id
                    )
                    .execute(&mut transaction)
                    .await?;
                }
            }
        } else if course_instance.variant_status == VariantStatus::Active {
            if let Some(ends_at) = course_instance.ends_at {
                if ends_at <= Utc::now() {
                    sqlx::query!(
                        r#"
UPDATE course_instances
SET variant_status = $1
WHERE id = $2;
"#,
                        VariantStatus::Ended as _,
                        course_instance.id
                    )
                    .execute(&mut transaction)
                    .await?;
                }
            }
        }
    }

    transaction.commit().await?;

    Ok(())
}
