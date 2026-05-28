//! Controllers for requests starting with `/api/v0/cms/migration`.

use headless_lms_utils::document_schema_processor::GutenbergBlock;
use models::migration::NewCoursePage;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{domain::request_id::RequestId, prelude::*};

/**
POST `/api/v0/cms/migration/new_page/{course_id}` - Create a new page from Gutenberg blocks.

Creates a new page in the CMS by accepting an array of Gutenberg blocks. The page title is extracted
from the first hero-section or heading block. The URL path is auto-generated from the title, and the
order number is automatically determined.

# Example

Request:

```http
POST /api/v0/cms/migration/new_page/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa HTTP/1.1
Content-Type: application/json

[
  {
    "clientId": "...",
    "isValid": true,
    "name": "moocfi/hero-section",
    "attributes": {
      "title": "My Page Title"
    },
    "innerBlocks": []
  },
  {
    "clientId": "...",
    "isValid": true,
    "name": "core/paragraph",
    "attributes": {
      "content": "Page content here"
    },
    "innerBlocks": []
  }
]
```
*/

/// Extract title from Gutenberg blocks (looks for hero-section or first heading)
fn extract_title_from_blocks(blocks: &[GutenbergBlock]) -> Option<String> {
    fn extract_from_block(block: &GutenbergBlock) -> Option<String> {
        if block.name == "moocfi/hero-section" {
            let attrs = &block.attributes;
            if let Some(title) = attrs.get("title").and_then(|v| v.as_str()) {
                return Some(title.trim_matches('\'').trim_matches('"').to_string());
            }
        }
        if block.name.starts_with("core/heading") {
            let attrs = &block.attributes;
            if let Some(content) = attrs.get("content").and_then(|v| v.as_str()) {
                // Strip HTML tags for a clean title
                let clean = content.replace("<strong>", "").replace("</strong>", "");
                return Some(clean.trim().to_string());
            }
        }
        // Recursively check inner blocks
        for inner in &block.inner_blocks {
            if let Some(title) = extract_from_block(inner) {
                return Some(title);
            }
        }
        None
    }

    for block in blocks {
        if let Some(title) = extract_from_block(block) {
            return Some(title);
        }
    }
    None
}

/// Generate a URL-safe slug from a title
fn slugify(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c
            } else if c.is_whitespace() {
                '-'
            } else {
                '_'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(untagged)]
enum MigrationPageRequest {
    Blocks(Vec<GutenbergBlock>),
    Page(MigrationPageWithMeta),
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct MigrationPageWithMeta {
    content: Vec<GutenbergBlock>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    url_path: Option<String>,
    #[serde(default)]
    chapter_id: Option<Uuid>,
    #[serde(default)]
    front_page_of_chapter_id: Option<Uuid>,
    #[serde(default)]
    hidden: Option<bool>,
}

async fn next_order_number_for_migration_page(
    conn: &mut PgConnection,
    course_id: Uuid,
    chapter_id: Option<Uuid>,
) -> ModelResult<i32> {
    match chapter_id {
        Some(chapter_id) => {
            let order_number: Option<i32> = sqlx::query_scalar(
                "SELECT MAX(order_number) FROM pages WHERE chapter_id = $1 AND deleted_at IS NULL",
            )
            .bind(chapter_id)
            .fetch_one(&mut *conn)
            .await?;
            Ok(order_number.map(|value| value + 1).unwrap_or(0))
        }
        None => {
            let order_number: Option<i32> = sqlx::query_scalar(
                "SELECT MAX(order_number) FROM pages WHERE course_id = $1 AND chapter_id IS NULL AND deleted_at IS NULL",
            )
            .bind(course_id)
            .fetch_one(&mut *conn)
            .await?;
            Ok(order_number.map(|value| value + 1).unwrap_or(0))
        }
    }
}

#[instrument(skip(pool))]
async fn create_page(
    _request_id: RequestId,
    content: web::Json<MigrationPageRequest>,
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<(Uuid, Uuid)>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    let new_page = match content.into_inner() {
        MigrationPageRequest::Blocks(blocks) => {
            let title =
                extract_title_from_blocks(&blocks).unwrap_or_else(|| "Untitled Page".to_string());
            let url_path = format!("/{}", slugify(&title));
            let order_number =
                next_order_number_for_migration_page(&mut conn, *course_id, None).await?;

            NewCoursePage {
                content: blocks,
                course_id: *course_id,
                chapter_id: None,
                front_page_of_chapter_id: None,
                order_number,
                title,
                hidden: false,
                url_path,
            }
        }
        MigrationPageRequest::Page(MigrationPageWithMeta {
            content,
            title,
            url_path,
            chapter_id,
            front_page_of_chapter_id,
            hidden,
        }) => {
            let title = title
                .or_else(|| extract_title_from_blocks(&content))
                .unwrap_or_else(|| "Untitled Page".to_string());
            let url_path = url_path.unwrap_or_else(|| format!("/{}", slugify(&title)));
            let order_number =
                next_order_number_for_migration_page(&mut conn, *course_id, chapter_id).await?;

            NewCoursePage {
                content,
                course_id: *course_id,
                chapter_id,
                front_page_of_chapter_id,
                order_number,
                title,
                hidden: hidden.unwrap_or(false),
                url_path,
            }
        }
    };

    let saved = models::migration::insert_course_page(&mut conn, &new_page, user.id).await?;
    token.authorized_ok(web::Json(saved))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/new_page/{course_id}", web::post().to(create_page));
}
