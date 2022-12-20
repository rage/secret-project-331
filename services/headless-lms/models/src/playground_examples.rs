use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PlaygroundExample {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub name: String,
    pub url: String,
    pub width: i32,
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct PlaygroundExampleData {
    pub name: String,
    pub url: String,
    pub width: i32,
    pub data: serde_json::Value,
}

pub async fn get_all_playground_examples(
    conn: &mut PgConnection,
) -> ModelResult<Vec<PlaygroundExample>> {
    let examples = sqlx::query_as!(
        PlaygroundExample,
        "
SELECT *
from playground_examples
WHERE deleted_at IS NULL;
  "
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(examples)
}

pub async fn insert_playground_example(
    conn: &mut PgConnection,
    data: PlaygroundExampleData,
) -> ModelResult<PlaygroundExample> {
    let res = sqlx::query!(
        "
INSERT INTO playground_examples (name, url, width, data)
VALUES ($1, $2, $3, $4)
RETURNING *;
  ",
        data.name,
        data.url,
        data.width,
        data.data
    )
    .fetch_one(&mut *conn)
    .await?;
    Ok(PlaygroundExample {
        id: res.id,
        created_at: res.created_at,
        updated_at: res.updated_at,
        deleted_at: res.deleted_at,
        name: res.name,
        url: res.url,
        width: res.width,
        data: res.data,
    })
}

pub async fn update_playground_example(
    conn: &mut PgConnection,
    data: PlaygroundExample,
) -> ModelResult<PlaygroundExample> {
    let res = sqlx::query_as!(
        PlaygroundExample,
        "
UPDATE playground_examples
SET updated_at = now(),
  name = $1,
  url = $2,
  width = $3,
  data = $4
WHERE id = $5
RETURNING *;
    ",
        data.name,
        data.url,
        data.width,
        data.data,
        data.id
    )
    .fetch_one(&mut *conn)
    .await?;

    Ok(res)
}

pub async fn delete_playground_example(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<PlaygroundExample> {
    let res = sqlx::query!(
        "
UPDATE playground_examples
SET deleted_at = now()
WHERE id = $1
RETURNING *;
  ",
        id
    )
    .fetch_one(&mut *conn)
    .await
    .unwrap();

    Ok(PlaygroundExample {
        id: res.id,
        created_at: res.created_at,
        updated_at: res.updated_at,
        deleted_at: res.deleted_at,
        name: res.name,
        url: res.url,
        width: res.width,
        data: res.data,
    })
}

#[cfg(test)]
mod test {

    use super::*;
    use crate::{playground_examples::PlaygroundExampleData, test_helper::Conn};

    #[tokio::test]
    async fn insert_and_fetch_playground_example() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let fetched_data = get_all_playground_examples(tx.as_mut()).await.unwrap();
        let previous_length = fetched_data.len();

        let inserted_data = insert_playground_example(
            tx.as_mut(),
            PlaygroundExampleData {
                name: "test".to_string(),
                url: "https:\\test.com".to_string(),
                width: 500,
                data: serde_json::json!({"data":"test"}),
            },
        )
        .await
        .unwrap();

        assert!(inserted_data.name == *"test");
        assert!(inserted_data.url == *"https:\\test.com");
        assert!(inserted_data.width == 500);
        assert!(inserted_data.data == serde_json::json!({"data":"test"}));

        let fetched_data = get_all_playground_examples(tx.as_mut()).await.unwrap();

        assert_eq!(fetched_data.len(), previous_length + 1);
    }

    #[tokio::test]
    async fn insert_and_delete_playground_example() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let fetched_data = get_all_playground_examples(tx.as_mut()).await.unwrap();
        let previous_length = fetched_data.len();

        let inserted_data = insert_playground_example(
            tx.as_mut(),
            PlaygroundExampleData {
                name: "test".to_string(),
                url: "https:\\test.com".to_string(),
                width: 500,
                data: serde_json::json!({"data":"test"}),
            },
        )
        .await
        .unwrap();

        assert!(inserted_data.name == *"test");
        assert!(inserted_data.url == *"https:\\test.com");
        assert!(inserted_data.width == 500);
        assert!(inserted_data.data == serde_json::json!({"data":"test"}));

        let res = delete_playground_example(tx.as_mut(), inserted_data.id)
            .await
            .unwrap();

        assert!(res.deleted_at.is_some());

        let fetched_data = get_all_playground_examples(tx.as_mut()).await.unwrap();

        assert_eq!(fetched_data.len(), previous_length);
    }

    #[tokio::test]
    async fn insert_and_update_playground_example() {
        let mut conn = Conn::init().await;
        let mut tx = conn.begin().await;

        let fetched_data = get_all_playground_examples(tx.as_mut()).await.unwrap();
        let previous_length = fetched_data.len();

        let inserted_data = insert_playground_example(
            tx.as_mut(),
            PlaygroundExampleData {
                name: "test".to_string(),
                url: "https:\\test.com".to_string(),
                width: 500,
                data: serde_json::json!({"data":"test"}),
            },
        )
        .await
        .unwrap();

        assert!(inserted_data.name == *"test");
        assert!(inserted_data.url == *"https:\\test.com");
        assert!(inserted_data.width == 500);
        assert!(inserted_data.data == serde_json::json!({"data":"test"}));

        let updated_data = PlaygroundExample {
            name: "updated name".to_string(),
            url: "https:\\updated-url.com".to_string(),
            width: 600,
            data: serde_json::json!({"data": "updated data"}),
            ..inserted_data
        };

        let res = update_playground_example(tx.as_mut(), updated_data)
            .await
            .unwrap();

        assert!(res.name == *"updated name");
        assert!(res.url == *"https:\\updated-url.com");
        assert!(res.width == 600);
        assert!(res.data == serde_json::json!({"data":"updated data"}));

        let fetched_data = get_all_playground_examples(tx.as_mut()).await.unwrap();

        assert_eq!(fetched_data.len(), previous_length + 1);
    }
}
