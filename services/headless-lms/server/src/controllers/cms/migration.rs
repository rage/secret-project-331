//! Controllers for requests starting with `/api/v0/cms/migration`.

use crate::domain::models_requests;
use crate::domain::models_requests::JwtKey;
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use models::pages::{CmsPageUpdate, NewPage};

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

#[instrument(skip(pool, jwt_key, app_conf, user, cms_update_json, course_id, request_id))]
async fn create_page(
    request_id: RequestId,
    cms_update_json: web::Json<CmsPageUpdate>,
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    jwt_key: web::Data<JwtKey>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: AuthUser,
) -> ControllerResult<web::Json<(Uuid, Uuid)>> {
    let mut conn = pool.acquire().await?;
    let token = authorize(&mut conn, Act::Edit, Some(user.id), Res::Course(*course_id)).await?;

    let mut cms_update = cms_update_json.into_inner();

    // Ensure title/url fallbacks
    if cms_update.title.trim().is_empty() {
        cms_update.title = extract_title_from_blocks(&cms_update.content)
            .unwrap_or_else(|| "Untitled Page".to_string());
    }
    if cms_update.url_path.trim().is_empty() {
        cms_update.url_path = format!("/{}", slugify(&cms_update.title));
    }

    // Validate exercise payload shape early
    cms_update.validate_exercise_data()?;

    let new_page = NewPage {
        exercises: cms_update.exercises,
        exercise_slides: cms_update.exercise_slides,
        exercise_tasks: cms_update.exercise_tasks,
        content: cms_update.content,
        url_path: cms_update.url_path,
        title: cms_update.title,
        course_id: Some(*course_id),
        exam_id: None,
        chapter_id: cms_update.chapter_id,
        front_page_of_chapter_id: None,
        content_search_language: None,
        hidden: cms_update.hidden,
    };

    let created = models::pages::create_for_course_id(
        &mut conn,
        *course_id,
        new_page,
        user.id,
        models_requests::make_spec_fetcher(
            app_conf.base_url.clone(),
            request_id.0,
            jwt_key.into_inner(),
        ),
        models_requests::fetch_service_info,
    )
    .await?;

    let latest_map =
        models::page_history::get_latest_page_history_ids_by_course_ids(&mut conn, &[*course_id])
            .await?;
    let history_id = match latest_map.get(&created.id).cloned() {
        Some(id) => id,
        None => {
            return Err(controller_err!(
                NotFound,
                "page history not found".to_string()
            ));
        }
    };

    return token.authorized_ok(web::Json((created.id, history_id)));
}

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

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/new_page/{course_id}", web::post().to(create_page));
}
