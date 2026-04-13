use utoipa::OpenApi;

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
