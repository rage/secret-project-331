use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CodeGiveaway {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub course_module_id: Option<Uuid>,
    pub enabled: bool,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct NewCodeGiveaway {
    pub course_id: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub enum CodeGiveawayStatus {
    Disabled,
    NotEligible,
    Eligible { codes_left: bool },
    AlreadyGottenCode { given_code: String },
}

pub async fn insert(conn: &mut PgConnection, input: &NewCodeGiveaway) -> ModelResult<CodeGiveaway> {
    let res = sqlx::query_as!(
        CodeGiveaway,
        r#"
INSERT INTO code_giveaways (course_id, name)
VALUES ($1, $2)
RETURNING *
        "#,
        input.course_id,
        input.name
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(res)
}

pub async fn get_all_for_course(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<CodeGiveaway>> {
    let res = sqlx::query_as!(
        CodeGiveaway,
        r#"
SELECT *
FROM code_giveaways
WHERE course_id = $1
  AND deleted_at IS NULL
"#,
        course_id
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(res)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<CodeGiveaway> {
    let res = sqlx::query_as!(
        CodeGiveaway,
        r#"
SELECT *
FROM code_giveaways
WHERE id = $1
"#,
        id
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(res)
}

pub async fn set_enabled(
    conn: &mut PgConnection,
    id: Uuid,
    enabled: bool,
) -> ModelResult<CodeGiveaway> {
    let res = sqlx::query_as!(
        CodeGiveaway,
        r#"
UPDATE code_giveaways
SET enabled = $2
WHERE id = $1
RETURNING *
"#,
        id,
        enabled
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(res)
}

pub async fn get_code_giveaway_status(
    conn: &mut PgConnection,
    code_giveaway_id: Uuid,
    user_id: Uuid,
) -> ModelResult<CodeGiveawayStatus> {
    let code_giveaway = get_by_id(conn, code_giveaway_id).await?;
    if !code_giveaway.enabled {
        return Ok(CodeGiveawayStatus::Disabled);
    }

    if let Some(course_module_id) = code_giveaway.course_module_id {
        let course_module_completions =
            crate::course_module_completions::get_all_by_user_id_and_course_module_id(
                conn,
                user_id,
                course_module_id,
            )
            .await?;

        if !course_module_completions
            .iter().any(|c| c.passed)
        {
            return Ok(CodeGiveawayStatus::NotEligible);
        }
    }
    let already_given_code =
        crate::code_giveaway_codes::get_code_given_to_user(conn, code_giveaway_id, user_id).await?;

    if let Some(code) = already_given_code {
        return Ok(CodeGiveawayStatus::AlreadyGottenCode {
            given_code: code.code,
        });
    }

    let codes_left = crate::code_giveaway_codes::are_any_codes_left(conn, code_giveaway_id).await?;

    Ok(CodeGiveawayStatus::Eligible { codes_left })
}
