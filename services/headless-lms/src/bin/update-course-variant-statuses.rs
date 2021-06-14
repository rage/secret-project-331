use anyhow::Result;
use chrono::{DateTime, Utc};
use dotenv::dotenv;
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<()> {
    env::set_var("RUST_LOG", "info,actix_web=info");
    dotenv().ok();
    env_logger::init();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/headless_lms_dev".to_string());
    let db_pool = PgPool::connect(&database_url).await?;
    let mut transaction = db_pool.begin().await?;

    #[derive(Debug, PartialEq, Eq, sqlx::Type)]
    #[sqlx(type_name = "variant_status", rename_all = "snake_case")]
    enum VariantStatus {
        Draft,
        Upcoming,
        Active,
        Ended,
    }

    #[derive(Debug)]
    struct CourseInstance {
        id: Uuid,
        variant_status: VariantStatus,
        starts_at: Option<DateTime<Utc>>,
        ends_at: Option<DateTime<Utc>>,
    }

    let course_instances = sqlx::query_as!(
        CourseInstance,
        r#"
SELECT
    id, variant_status as "variant_status: VariantStatus", starts_at, ends_at
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
