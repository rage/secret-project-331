use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct OtherDomainToCourseRedirection {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub domain: String,
    pub course_id: Uuid,
}

pub async fn get_by_domain(
    conn: &mut PgConnection,
    domain: &str,
) -> ModelResult<OtherDomainToCourseRedirection> {
    let res = sqlx::query_as!(
        OtherDomainToCourseRedirection,
        "
SELECT * FROM other_domain_to_course_redirections
WHERE domain = $1 AND deleted_at IS NULL
",
        domain
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}
