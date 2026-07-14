//! Controllers for requests starting with `/api/v0/cms/ai-suggestions`.
use headless_lms_models::application_task_default_language_models::{self, ApplicationTask};
use headless_lms_models::cms_ai::ParagraphSuggestionAction;
use utoipa::{OpenApi, ToSchema};

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, ToSchema)]

pub struct ParagraphSuggestionMeta {
    pub tone: Option<String>,
    pub language: Option<String>,
    pub setting_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]

pub struct ParagraphSuggestionContext {
    pub page_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub locale: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]

pub struct ParagraphSuggestionRequest {
    pub action: ParagraphSuggestionAction,
    pub content: String,
    pub is_html: bool,
    pub meta: Option<ParagraphSuggestionMeta>,
    pub context: Option<ParagraphSuggestionContext>,
}

#[derive(Serialize, Deserialize, ToSchema)]

pub struct ParagraphSuggestionResponse {
    pub suggestions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]

pub struct ChartSpecGenerationRequest {
    pub prompt: String,
    pub current_spec: Option<String>,
    pub data_url: Option<String>,
    pub data_format: Option<String>,
    pub data_sample: Option<String>,
    pub page_id: Option<Uuid>,
}

#[derive(Serialize, Deserialize, ToSchema)]

pub struct ChartSpecGenerationResponse {
    pub spec: String,
}

#[derive(OpenApi)]
#[openapi(paths(suggest_paragraph, generate_chart_spec))]
pub(crate) struct CmsAiSuggestionsApiDoc;

/**
POST `/api/v0/cms/ai-suggestions/paragraph` - Generate AI suggestions for a CMS paragraph.

This endpoint is intended for CMS editors. It requires the user to have edit access
to the referenced page when `context.page_id` is provided, otherwise it falls back
to requiring a teaching role for some course via `Res::AnyCourse`.
*/
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    post,
    path = "/paragraph",
    operation_id = "requestParagraphSuggestions",
    tag = "cms_ai_suggestions",
    request_body = ParagraphSuggestionRequest,
    responses(
        (status = 200, description = "Generated paragraph suggestions", body = ParagraphSuggestionResponse)
    )
)]
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
        action: payload.action,
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
POST `/api/v0/cms/ai-suggestions/chart-spec` - Generate a Vega-Lite chart specification from a prompt.

This endpoint is intended for the CMS chart block editor. It requires the user to have
edit access to the referenced page when `page_id` is provided, otherwise it falls back
to requiring a teaching role for some course via `Res::AnyCourse`.
*/
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    post,
    path = "/chart-spec",
    operation_id = "requestChartSpecGeneration",
    tag = "cms_ai_suggestions",
    request_body = ChartSpecGenerationRequest,
    responses(
        (status = 200, description = "Generated Vega-Lite chart specification", body = ChartSpecGenerationResponse)
    )
)]
async fn generate_chart_spec(
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    user: AuthUser,
    payload: web::Json<ChartSpecGenerationRequest>,
) -> ControllerResult<web::Json<ChartSpecGenerationResponse>> {
    let mut conn = pool.acquire().await?;

    if payload.prompt.trim().is_empty() {
        return Err(ControllerError::new(
            ControllerErrorType::BadRequest,
            "The chart generation prompt must not be empty.".to_string(),
            None,
        ));
    }

    let token = if let Some(page_id) = payload.page_id {
        authorize(&mut conn, Act::Edit, Some(user.id), Res::Page(page_id)).await?
    } else {
        authorize(&mut conn, Act::Teach, Some(user.id), Res::AnyCourse).await?
    };

    let task_lm = application_task_default_language_models::get_for_task(
        &mut conn,
        ApplicationTask::ChartSpecGeneration,
    )
    .await?;

    let generator_input = headless_lms_chatbot::chart_spec_generation::ChartSpecGenerationInput {
        prompt: payload.prompt.clone(),
        current_spec: payload.current_spec.clone(),
        data_url: payload.data_url.clone(),
        data_format: payload.data_format.clone(),
        data_sample: payload.data_sample.clone(),
    };

    // Return the DB connection to the pool before the LLM call.
    drop(conn);

    let spec = headless_lms_chatbot::chart_spec_generation::generate_chart_spec(
        &app_conf,
        task_lm,
        &generator_input,
    )
    .await?;

    token.authorized_ok(web::Json(ChartSpecGenerationResponse { spec }))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/paragraph", web::post().to(suggest_paragraph))
        .route("/chart-spec", web::post().to(generate_chart_spec));
}
