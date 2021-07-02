use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct ExerciseService {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub name: String,
    pub slug: String,
    pub public_url: String,
    /// This is needed because connecting to services directly inside the cluster with a special url is much for efficient than connecting to the same service with a url that would get routed though the internet. If not defined, use we can reach the service with the public url.
    pub internal_url: Option<String>,
}

pub async fn get_exercise_service(conn: &mut PgConnection, id: Uuid) -> Result<ExerciseService> {
    let res = sqlx::query_as!(
        ExerciseService,
        r#"
SELECT *
FROM exercise_services
WHERE id = $1
  "#,
        id
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_exercise_service_by_exercise_type(
    conn: &mut PgConnection,
    exercise_type: &str,
) -> Result<ExerciseService> {
    let res = sqlx::query_as!(
        ExerciseService,
        r#"
SELECT *
FROM exercise_services
WHERE slug = $1
  "#,
        exercise_type
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_exercise_services(conn: &mut PgConnection) -> Result<Vec<ExerciseService>> {
    let res = sqlx::query_as!(
        ExerciseService,
        r#"
SELECT *
FROM exercise_services
WHERE deleted_at IS NULL
"#
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn insert_exercise_service(
    conn: &mut PgConnection,
    name: &str,
    slug: &str,
    public_url: &str,
    internal_url: &str,
) -> Result<ExerciseService> {
    let res = sqlx::query_as!(
        ExerciseService,
        r#"
INSERT INTO exercise_services (name, slug, public_url, internal_url)
VALUES ($1, $2, $3, $4)
RETURNING *;
  "#,
        name,
        slug,
        public_url,
        internal_url
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
