//! Controllers for requests starting with `/api/v0/cms/ai-suggestions`.
use headless_lms_models::application_task_default_language_models::{self, ApplicationTask};

use crate::prelude::*;

const ALLOWED_PARAGRAPH_ACTIONS: &[&str] = &[
    "moocfi/ai/generate-draft-from-notes",
    "moocfi/ai/generate-continue-paragraph",
    "moocfi/ai/generate-add-example",
    "moocfi/ai/generate-add-counterpoint",
    "moocfi/ai/generate-add-concluding-sentence",
    "moocfi/fix-spelling",
    "moocfi/ai/improve-clarity",
    "moocfi/ai/improve-flow",
    "moocfi/ai/improve-concise",
    "moocfi/ai/improve-expand-detail",
    "moocfi/ai/improve-academic-style",
    "moocfi/ai/structure-create-topic-sentence",
    "moocfi/ai/structure-reorder-sentences",
    "moocfi/ai/structure-split-into-paragraphs",
    "moocfi/ai/structure-combine-into-one",
    "moocfi/ai/structure-to-bullets",
    "moocfi/ai/structure-from-bullets",
    "moocfi/ai/learning-simplify-beginners",
    "moocfi/ai/learning-add-definitions",
    "moocfi/ai/learning-add-analogy",
    "moocfi/ai/learning-add-practice-question",
    "moocfi/ai/learning-add-check-understanding",
    "moocfi/ai/summaries-one-sentence",
    "moocfi/ai/summaries-two-three-sentences",
    "moocfi/ai/summaries-key-takeaway",
    "moocfi/ai/tone-academic-formal",
    "moocfi/ai/tone-friendly-conversational",
    "moocfi/ai/tone-encouraging-supportive",
    "moocfi/ai/tone-neutral-objective",
    "moocfi/ai/tone-confident",
    "moocfi/ai/tone-serious",
    "moocfi/ai/translate-english",
    "moocfi/ai/translate-finnish",
    "moocfi/ai/translate-swedish",
];

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ParagraphSuggestionMeta {
    pub tone: Option<String>,
    pub language: Option<String>,
    pub setting_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ParagraphSuggestionContext {
    pub page_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub locale: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ParagraphSuggestionRequest {
    pub action: String,
    pub content: String,
    pub is_html: bool,
    pub meta: Option<ParagraphSuggestionMeta>,
    pub context: Option<ParagraphSuggestionContext>,
}

#[derive(Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ParagraphSuggestionResponse {
    pub suggestions: Vec<String>,
}

/**
POST `/api/v0/cms/ai-suggestions/paragraph` - Generate AI suggestions for a CMS paragraph.

This endpoint is intended for CMS editors. It requires the user to have edit access
to the referenced page when `context.page_id` is provided, otherwise it falls back
to requiring a teaching role for some course via `Res::AnyCourse`.
*/
#[instrument(skip(pool, app_conf))]
async fn suggest_paragraph(
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: AuthUser,
    payload: web::Json<ParagraphSuggestionRequest>,
) -> ControllerResult<web::Json<ParagraphSuggestionResponse>> {
    let mut conn = pool.acquire().await?;

    // Basic validation of input content.
    if payload.content.trim().is_empty() {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Paragraph content must not be empty.".to_string(),
            None,
        ));
    }

    if !ALLOWED_PARAGRAPH_ACTIONS.contains(&payload.action.as_str()) {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Unsupported paragraph suggestion action.".to_string(),
            None,
        ));
    }

    // Authorize: prefer page-level edit permission when page_id is available,
    // otherwise require that the user can teach at least one course.
    let token = if let Some(ParagraphSuggestionContext {
        page_id: Some(page_id),
        ..
    }) = &payload.context
    {
        authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(*page_id)).await?
    } else {
        authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?
    };

    let task_lm = application_task_default_language_models::get_for_task(
        &mut conn,
        ApplicationTask::CmsParagraphSuggestion,
    )
    .await?;

    let meta = payload.meta.as_ref();
    let generator_input = headless_lms_chatbot::cms_ai_suggestion::CmsParagraphSuggestionInput {
        action: payload.action.clone(),
        content: payload.content.clone(),
        is_html: payload.is_html,
        meta_tone: meta.and_then(|m| m.tone.clone()),
        meta_language: meta.and_then(|m| m.language.clone()),
        meta_setting_type: meta.and_then(|m| m.setting_type.clone()),
    };

    // Return the DB connection to the pool before the LLM call.
    drop(conn);

    let suggestions = headless_lms_chatbot::cms_ai_suggestion::generate_paragraph_suggestions(
        &app_conf,
        task_lm,
        &generator_input,
    )
    .await?;

    token.authorized_ok(web::Json(ParagraphSuggestionResponse { suggestions }))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/paragraph", web::post().to(suggest_paragraph));
}
