use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    nest(
        (
            path = "/api/v0/main-frontend",
            api = crate::controllers::main_frontend::MainFrontendRoutesApiDoc
        )
    ),
    tags(
        (name = "glossary", description = "Glossary endpoints used by main-frontend")
    ),
    info(
        title = "Main Frontend API",
        version = "0.1.0"
    )
)]
pub struct MainFrontendApiDoc;
