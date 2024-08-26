use sqlx::{QueryBuilder, Row};

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct CodeGiveawayCode {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub code_giveaway_id: Uuid,
    pub code_given_to_user_id: Option<Uuid>,
    pub added_by_user_id: Uuid,
    pub code: String,
}

pub async fn insert_many(
    conn: &mut PgConnection,
    code_giveaway_id: Uuid,
    input: &[String],
    added_by_user_id: Uuid,
) -> ModelResult<Vec<CodeGiveawayCode>> {
    if input.is_empty() {
        return Ok(vec![]);
    }
    let mut query_builder = QueryBuilder::new(
        "INSERT INTO code_giveaway_codes (code_giveaway_id, code, added_by_user_id) ",
    );

    query_builder.push_values(input, |mut b, code| {
        b.push_bind(code_giveaway_id)
            .push_bind(code)
            .push_bind(added_by_user_id);
    });

    query_builder.push(" RETURNING id");

    let query = query_builder.build();

    let ids: Vec<Uuid> = query
        .fetch_all(&mut *conn)
        .await?
        .iter()
        .map(|row| row.get("id"))
        .collect();

    // Fetch the inserted rows to return them
    let res = sqlx::query_as!(
        CodeGiveawayCode,
        r#"
SELECT *
FROM code_giveaway_codes
WHERE code_giveaway_id = $1
  AND added_by_user_id = $2
  AND id = ANY($3)
    "#,
        code_giveaway_id,
        added_by_user_id,
        &ids
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(res)
}

pub async fn get_all_by_code_giveaway_id(
    conn: &mut PgConnection,
    code_giveaway_id: Uuid,
) -> ModelResult<Vec<CodeGiveawayCode>> {
    let res = sqlx::query_as!(
        CodeGiveawayCode,
        r#"
SELECT *
FROM code_giveaway_codes
WHERE code_giveaway_id = $1
  AND deleted_at IS NULL
        "#,
        code_giveaway_id
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_code_given_to_user(
    conn: &mut PgConnection,
    code_giveaway_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Option<CodeGiveawayCode>> {
    let res = sqlx::query_as!(
        CodeGiveawayCode,
        r#"
SELECT *
FROM code_giveaway_codes
WHERE code_giveaway_id = $1
  AND code_given_to_user_id = $2
  AND deleted_at IS NULL
        "#,
        code_giveaway_id,
        user_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn give_some_code_to_user(
    conn: &mut PgConnection,
    code_giveaway_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Option<CodeGiveawayCode>> {
    let res = sqlx::query_as!(
        CodeGiveawayCode,
        r#"
UPDATE code_giveaway_codes
SET code_given_to_user_id = $2
WHERE code_giveaway_id = $1
  AND code_given_to_user_id IS NULL
  AND deleted_at IS NULL
RETURNING *
        "#,
        code_giveaway_id,
        user_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helper::*;

    #[tokio::test]
    async fn test_insert_many_empty() {
        insert_data!(:tx, :user, :org, :course);

        let code_giveaway = crate::code_giveaways::insert(tx.as_mut(), course)
            .await
            .unwrap();

        let insert_result = insert_many(tx.as_mut(), code_giveaway.id, &[], user)
            .await
            .unwrap();

        assert!(insert_result.is_empty());
    }

    #[tokio::test]
    async fn test_insert_many_with_data() {
        insert_data!(:tx, :user, :org, :course);

        let code_giveaway = crate::code_giveaways::insert(tx.as_mut(), course)
            .await
            .unwrap();

        let codes = vec![
            "code1".to_string(),
            "code2".to_string(),
            "code3".to_string(),
        ];

        let insert_result = insert_many(tx.as_mut(), code_giveaway.id, &codes, user)
            .await
            .unwrap();

        assert_eq!(insert_result.len(), codes.len());
        for code in &codes {
            let found = insert_result.iter().find(|c| c.code == *code);
            assert!(found.is_some());
        }
        // Double checking
        let all_codes = get_all_by_code_giveaway_id(tx.as_mut(), code_giveaway.id)
            .await
            .unwrap();
        assert_eq!(all_codes.len(), codes.len());
        for code in &codes {
            let found = all_codes.iter().find(|c| c.code == *code);
            assert!(found.is_some());
        }
    }
}
