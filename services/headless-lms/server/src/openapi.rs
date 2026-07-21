use utoipa::{
    Modify, OpenApi,
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
};

#[derive(OpenApi)]
#[openapi(
    nest((path = "/api/v0/cms", api = crate::controllers::cms::CmsRoutesApiDoc)),
    info(
        title = "CMS API",
        version = "0.1.0"
    )
)]
pub struct CmsApiDoc;

#[derive(OpenApi)]
#[openapi(
    nest(
        (
            path = "/api/v0/main-frontend",
            api = crate::controllers::main_frontend::MainFrontendRoutesApiDoc
        ),
        (path = "/api/v0/files", api = crate::controllers::files::FilesApiDoc)
    ),
    components(schemas(
        headless_lms_models::suspected_cheaters::SuspectedCheaterStatus
    )),
    tags(
        (name = "glossary", description = "Glossary endpoints used by main-frontend")
    ),
    info(
        title = "Main Frontend API",
        version = "0.1.0"
    )
)]
pub struct MainFrontendApiDoc;

#[derive(OpenApi)]
#[openapi(
    nest(
        (
            path = "/api/v0/course-material",
            api = crate::controllers::course_material::CourseMaterialRoutesApiDoc
        )
    ),
    components(schemas(
        headless_lms_models::teacher_grading_decisions::TeacherDecisionType
    )),
    info(
        title = "Course Material API",
        version = "0.1.0"
    )
)]
pub struct CourseMaterialApiDoc;

#[derive(OpenApi)]
#[openapi(
    nest((path = "/api/v0/auth", api = crate::controllers::auth::AuthRoutesApiDoc)),
    info(
        title = "Auth API",
        version = "0.1.0"
    )
)]
pub struct AuthApiDoc;

#[derive(OpenApi)]
#[openapi(
    nest((path = "/api/v0/errors", api = crate::controllers::errors::ErrorsRoutesApiDoc)),
    info(
        title = "Errors API",
        version = "0.1.0"
    )
)]
pub struct ErrorsApiDoc;

/// Adds the bearer-token security scheme used by every
/// `/api/v0/exercise-services/client` endpoint.
///
/// The client endpoints authenticate via `Authorization: Bearer <token>`, so the
/// spec declares a single `bearer_auth` HTTP bearer scheme that each operation
/// references.
struct ExerciseServicesClientSecurityAddon;

impl Modify for ExerciseServicesClientSecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);
        components.add_security_scheme(
            "bearer_auth",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .description(Some(
                        "Access token passed as an HTTP bearer token in the Authorization header.",
                    ))
                    .build(),
            ),
        );
    }
}

#[derive(OpenApi)]
#[openapi(
    nest((path = "/api/v0/exercise-services/client", api = crate::controllers::exercise_services::client::ExerciseServicesClientRoutesApiDoc)),
    modifiers(&ExerciseServicesClientSecurityAddon),
    info(
        title = "Exercise Services Client API",
        version = "0.1.0"
    )
)]
pub struct ExerciseServicesClientApiDoc;
