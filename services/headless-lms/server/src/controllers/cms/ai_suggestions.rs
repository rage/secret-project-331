//! Controllers for requests starting with `/api/v0/cms/ai-suggestions`.
use headless_lms_models::application_task_default_language_models::{self, ApplicationTask};

use crate::prelude::*;

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
    pub text: String,
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

    // Basic validation of input text.
    if payload.text.trim().is_empty() {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "Paragraph text must not be empty.".to_string(),
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
        text: payload.text.clone(),
        meta_tone: meta.and_then(|m| m.tone.clone()),
        meta_language: meta.and_then(|m| m.language.clone()),
    };

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
