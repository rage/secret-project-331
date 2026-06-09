//! Controllers for requests starting with `/api/v0/course-material/courses`.

use std::{collections::HashMap, net::IpAddr, path::Path};

use actix_http::header::{self, X_FORWARDED_FOR};
use actix_web::web::Json;
use chrono::Utc;
use futures::{FutureExt, future::OptionFuture};
use headless_lms_models::courses::{CourseLanguageVersionNavigationInfo, CourseMaterialCourse};
use headless_lms_models::{
    course_custom_privacy_policy_checkbox_texts::CourseCustomPrivacyPolicyCheckboxText,
    marketing_consents::UserMarketingConsent,
};
use headless_lms_models::{partner_block::PartnersBlock, privacy_link::PrivacyLink};
use headless_lms_utils::ip_to_country::IpToCountryMapper;
use headless_lms_utils::services::sisu::SisuCourseInfoElement;
use isbot::Bots;
use models::{
    chapters::ChapterWithStatus,
    course_instances::CourseInstance,
    course_modules::CourseModule,
    courses::{self, get_nondeleted_course_id_by_slug},
    feedback,
    feedback::NewFeedback,
    glossary::Term,
    material_references::MaterialReference,
    page_visit_datum::NewPageVisitDatum,
    page_visit_datum_daily_visit_hashing_keys::{
        GenerateAnonymousIdentifierInput, generate_anonymous_identifier,
    },
    pages::{CoursePageWithUserData, Page, PageSearchResult, PageVisibility, SearchRequest},
    proposed_page_edits::{self, NewProposedPageEdits},
    research_forms::{
        NewResearchFormQuestionAnswer, ResearchForm, ResearchFormQuestion,
        ResearchFormQuestionAnswer,
    },
    student_countries::StudentCountry,
    user_course_settings::UserCourseSettings,
};
use utoipa::{OpenApi, ToSchema};

use crate::{
    domain::authorization::{
        Action, Resource, authorize_access_to_course_material,
        authorize_with_fetched_list_of_roles, can_user_view_chapter, skip_authorize,
    },
    prelude::*,
};
use headless_lms_utils::services::sisu::SisuClient;

#[derive(OpenApi)]
#[openapi(paths(
    get_course,
    get_course_page_by_path,
    get_current_course_instance,
    get_course_instances,
    get_public_course_pages,
    get_chapters,
    get_user_course_settings,
    search_pages_with_phrase,
    search_pages_with_words,
    feedback,
    propose_edit,
    glossary,
    get_material_references_by_course_id,
    get_public_top_level_pages,
    get_all_course_language_versions_navigation_info_from_page,
    get_page_by_course_id_and_language_group,
    student_country,
    get_student_countries,
    get_student_country,
    get_research_form_with_course_id,
    get_research_form_questions_with_course_id,
    upsert_course_research_form_answer,
    get_research_form_answers_with_user_id,
    update_marketing_consent,
    fetch_user_marketing_consent,
    get_partners_block,
    get_privacy_link,
    get_custom_privacy_policy_checkbox_texts,
    get_user_chapter_locks,
    get_sisu_course_info
))]
pub(crate) struct CourseMaterialCoursesApiDoc;

/**
GET `/api/v0/course-material/courses/:course_id` - Get course.
*/
#[utoipa::path(
    get,
    path = "/{course_id}",
    operation_id = "getCourseMaterialCourse",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course", body = CourseMaterialCourse)
    )
)]
#[instrument(skip(pool))]
async fn get_course(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<CourseMaterialCourse>> {
    let mut conn = pool.acquire().await?;
    let token =
        authorize_access_to_course_material(&mut conn, auth.map(|u| u.id), *course_id).await?;
    let course = models::courses::get_course(&mut conn, *course_id).await?;
    token.authorized_ok(web::Json(course.into()))
}

/**
GET `/:course_slug/page-by-path/...` - Returns a course page by path

If the page has moved and there's a redirection, this will still return the moved page but the field `was_redirected` will indicate that the redirection happened. The new path can be found in the page object. The frontend is supposed to update the url of the page to the new location without reloading the page.

# Example
GET /api/v0/course-material/courses/introduction-to-everything/page-by-path//part-2/hello-world
*/

#[utoipa::path(
    get,
    path = "/{course_slug}/page-by-path/{url_path}",
    operation_id = "getCourseMaterialCoursePageByPath",
    tag = "course-material-courses",
    params(
        ("course_slug" = String, Path, description = "Course slug"),
        ("url_path" = String, Path, description = "Page path within the course")
    ),
    responses(
        (status = 200, description = "Course page with user data", body = CoursePageWithUserData)
    )
)]
#[instrument(skip(pool, ip_to_country_mapper, req, file_store, app_conf))]
async fn get_course_page_by_path(
    params: web::Path<(String, String)>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
    ip_to_country_mapper: web::Data<IpToCountryMapper>,
    req: HttpRequest,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<CoursePageWithUserData>> {
    let mut conn = pool.acquire().await?;

    let (course_slug, raw_page_path) = params.into_inner();
    let path = if raw_page_path.starts_with('/') {
        raw_page_path
    } else {
        format!("/{}", raw_page_path)
    };
    let user_id = user.map(|u| u.id);
    let course_data = get_nondeleted_course_id_by_slug(&mut conn, &course_slug).await?;
    let page_with_user_data = models::pages::get_page_with_user_data_by_path(
        &mut conn,
        user_id,
        &course_data,
        &path,
        file_store.as_ref(),
        &app_conf,
    )
    .await?;

    // Chapters may be closed
    if !can_user_view_chapter(
        &mut conn,
        user_id,
        page_with_user_data.page.course_id,
        page_with_user_data.page.chapter_id,
    )
    .await?
    {
        return Err(ControllerError::new(
            ControllerErrorType::UnauthorizedWithReason(
                crate::domain::error::UnauthorizedReason::ChapterNotOpenYet,
            ),
            "Chapter is not open yet.".to_string(),
            None,
        ));
    }

    let token = authorize_access_to_course_material(
        &mut conn,
        user_id,
        page_with_user_data.page.course_id.ok_or_else(|| {
            ControllerError::new(
                ControllerErrorType::NotFound,
                "Course not found".to_string(),
                None,
            )
        })?,
    )
    .await?;

    let temp_request_information =
        derive_information_from_requester(req, ip_to_country_mapper).await?;

    let RequestInformation {
        ip,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        country,
        user_agent,
        has_bot_user_agent,
        browser_admits_its_a_bot,
        browser,
        browser_version,
        operating_system,
        operating_system_version,
        device_type,
    } = temp_request_information.data;

    let course_or_exam_id = page_with_user_data
        .page
        .course_id
        .unwrap_or_else(|| page_with_user_data.page.exam_id.unwrap_or_else(Uuid::nil));
    let anonymous_identifier = generate_anonymous_identifier(
        &mut conn,
        GenerateAnonymousIdentifierInput {
            user_agent,
            ip_address: ip.map(|ip| ip.to_string()).unwrap_or_default(),
            course_id: course_or_exam_id,
        },
    )
    .await?;

    models::page_visit_datum::insert(
        &mut conn,
        NewPageVisitDatum {
            course_id: page_with_user_data.page.course_id,
            page_id: page_with_user_data.page.id,
            country,
            browser,
            browser_version,
            operating_system,
            operating_system_version,
            device_type,
            referrer,
            is_bot: has_bot_user_agent || browser_admits_its_a_bot,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_term,
            utm_content,
            anonymous_identifier,
            exam_id: page_with_user_data.page.exam_id,
        },
    )
    .await?;

    token.authorized_ok(web::Json(page_with_user_data))
}

struct RequestInformation {
    ip: Option<IpAddr>,
    user_agent: String,
    referrer: Option<String>,
    utm_source: Option<String>,
    utm_medium: Option<String>,
    utm_campaign: Option<String>,
    utm_term: Option<String>,
    utm_content: Option<String>,
    country: Option<String>,
    has_bot_user_agent: bool,
    browser_admits_its_a_bot: bool,
    browser: Option<String>,
    browser_version: Option<String>,
    operating_system: Option<String>,
    operating_system_version: Option<String>,
    device_type: Option<String>,
}

/// Used in get_course_page_by_path for path for anonymous visitor counts
async fn derive_information_from_requester(
    req: HttpRequest,
    ip_to_country_mapper: web::Data<IpToCountryMapper>,
) -> ControllerResult<RequestInformation> {
    let mut headers = req.headers().clone();
    let x_real_ip = headers.get("X-Real-IP");
    let x_forwarded_for = headers.get(X_FORWARDED_FOR);
    let connection_info = req.connection_info();
    let peer_address = connection_info.peer_addr();
    let headers_clone = headers.clone();
    let user_agent = headers_clone.get(header::USER_AGENT);
    let bots = Bots::default();
    let has_bot_user_agent = user_agent
        .and_then(|ua| ua.to_str().ok())
        .map(|ua| bots.is_bot(ua))
        .unwrap_or(true);
    // If this header is not set, the requester is considered a bot
    let header_totally_not_a_bot = headers.get("totally-not-a-bot");
    let browser_admits_its_a_bot = header_totally_not_a_bot.is_none();
    if has_bot_user_agent || browser_admits_its_a_bot {
        warn!(
            ?has_bot_user_agent,
            ?browser_admits_its_a_bot,
            ?user_agent,
            ?header_totally_not_a_bot,
            "The requester is a bot"
        )
    }

    let user_agent_parser = woothee::parser::Parser::new();
    let parsed_user_agent = user_agent
        .and_then(|ua| ua.to_str().ok())
        .and_then(|ua| user_agent_parser.parse(ua));

    let ip: Option<IpAddr> = connection_info
        .realip_remote_addr()
        .and_then(|ip| ip.parse::<IpAddr>().ok());

    info!(
        "Ip {:?}, x_real_ip {:?}, x_forwarded_for {:?}, peer_address {:?}",
        ip, x_real_ip, x_forwarded_for, peer_address
    );

    let country = ip
        .and_then(|ip| ip_to_country_mapper.map_ip_to_country(&ip))
        .map(|c| c.to_string());

    let utm_tags = headers
        .remove("utm-tags")
        .next()
        .and_then(|utms| String::from_utf8(utms.as_bytes().to_vec()).ok())
        .and_then(|utms| serde_json::from_str::<serde_json::Value>(&utms).ok())
        .and_then(|o| o.as_object().cloned());

    let utm_source = utm_tags
        .clone()
        .and_then(|mut tags| tags.remove("utm_source"))
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    let utm_medium = utm_tags
        .clone()
        .and_then(|mut tags| tags.remove("utm_medium"))
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    let utm_campaign = utm_tags
        .clone()
        .and_then(|mut tags| tags.remove("utm_campaign"))
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    let utm_term = utm_tags
        .clone()
        .and_then(|mut tags| tags.remove("utm_term"))
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    let utm_content = utm_tags
        .and_then(|mut tags| tags.remove("utm_content"))
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    let referrer = headers
        .get("Orignal-Referrer")
        .and_then(|r| r.to_str().ok())
        .map(|r| r.to_string());

    let browser = parsed_user_agent.as_ref().map(|ua| ua.name.to_string());
    let browser_version = parsed_user_agent.as_ref().map(|ua| ua.version.to_string());
    let operating_system = parsed_user_agent.as_ref().map(|ua| ua.os.to_string());
    let operating_system_version = parsed_user_agent
        .as_ref()
        .map(|ua| ua.os_version.to_string());
    let device_type = parsed_user_agent.as_ref().map(|ua| ua.category.to_string());
    let token = skip_authorize();
    token.authorized_ok(RequestInformation {
        ip,
        user_agent: user_agent
            .and_then(|ua| ua.to_str().ok())
            .unwrap_or_default()
            .to_string(),
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        country,
        has_bot_user_agent,
        browser_admits_its_a_bot,
        browser,
        browser_version,
        operating_system,
        operating_system_version,
        device_type,
    })
}

/**
GET `/api/v0/course-material/courses/:course_id/current-instance` - Returns the instance of a course for the current user, if there is one.
*/
#[utoipa::path(
    get,
    path = "/{course_id}/current-instance",
    operation_id = "getCurrentCourseMaterialCourseInstance",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Current course instance", body = Option<CourseInstance>)
    )
)]
#[instrument(skip(pool))]
async fn get_current_course_instance(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Option<CourseInstance>>> {
    let mut conn = pool.acquire().await?;
    if let Some(user) = user {
        let instance = models::course_instances::current_course_instance_of_user(
            &mut conn, user.id, *course_id,
        )
        .await?;
        let token = skip_authorize();
        token.authorized_ok(web::Json(instance))
    } else {
        Err(ControllerError::new(
            ControllerErrorType::NotFound,
            "User not found".to_string(),
            None,
        ))
    }
}

/**
GET `/api/v0/course-material/courses/:course_id/course-instances` - Returns all course instances for given course id.
*/
#[utoipa::path(
    get,
    path = "/{course_id}/course-instances",
    operation_id = "getCourseMaterialCourseInstances",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course instances", body = Vec<CourseInstance>)
    )
)]
async fn get_course_instances(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<CourseInstance>>> {
    let mut conn = pool.acquire().await?;
    let instances =
        models::course_instances::get_course_instances_for_course(&mut conn, *course_id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(instances))
}

/**
GET `/api/v0/course-material/courses/:course_id/pages` - Returns a list of public pages on a course.

Since anyone can access this endpoint, any unlisted pages are omited from these results.
*/
#[utoipa::path(
    get,
    path = "/{course_id}/pages",
    operation_id = "getCourseMaterialCoursePages",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Public course pages", body = Vec<Page>)
    )
)]
#[instrument(skip(pool))]
async fn get_public_course_pages(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let user_id = auth.map(|u| u.id);
    let token = authorize_access_to_course_material(&mut conn, user_id, *course_id).await?;
    let pages: Vec<Page> = models::pages::get_all_by_course_id_and_visibility(
        &mut conn,
        *course_id,
        PageVisibility::Public,
    )
    .await?;
    let pages = models::pages::filter_course_material_pages(&mut conn, user_id, pages).await?;
    token.authorized_ok(web::Json(pages))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct ChaptersWithStatus {
    pub is_previewable: bool,
    pub modules: Vec<CourseMaterialCourseModule>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct CourseMaterialCourseModule {
    pub chapters: Vec<ChapterWithStatus>,
    pub id: Uuid,
    pub is_default: bool,
    pub name: Option<String>,
    pub order_number: i32,
}

/**
GET `/api/v0/course-material/courses/:course_id/chapters` - Returns a list of chapters in a course.
*/

#[utoipa::path(
    get,
    path = "/{course_id}/chapters",
    operation_id = "getCourseMaterialChapters",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course chapters grouped by module", body = ChaptersWithStatus)
    )
)]
#[instrument(skip(pool, file_store, app_conf))]
async fn get_chapters(
    course_id: web::Path<Uuid>,
    user: Option<AuthUser>,
    pool: web::Data<PgPool>,
    file_store: web::Data<dyn FileStore>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<web::Json<ChaptersWithStatus>> {
    let mut conn = pool.acquire().await?;
    let user_id = user.as_ref().map(|u| u.id);
    let is_previewable = OptionFuture::from(user.map(|u| {
        authorize(&mut conn, Act::Teach, Some(u.id), Res::Course(*course_id)).map(|r| r.ok())
    }))
    .await
    .is_some();
    let token = authorize_access_to_course_material(&mut conn, user_id, *course_id).await?;
    let course_modules = models::course_modules::get_by_course_id(&mut conn, *course_id).await?;
    let exercise_deadline_overrides =
        models::chapters::exercise_deadline_overrides_by_chapter_for_course(&mut conn, *course_id)
            .await?;
    let chapters = models::chapters::course_chapters(&mut conn, *course_id)
        .await?
        .into_iter()
        .map(|chapter| {
            let chapter_image_url = chapter
                .chapter_image_path
                .as_ref()
                .map(|path| file_store.get_download_url(Path::new(&path), &app_conf));
            let exercise_deadline_overrides = exercise_deadline_overrides.get(&chapter.id).copied();
            ChapterWithStatus::from_database_chapter_timestamp_and_image_url(
                chapter,
                Utc::now(),
                chapter_image_url,
                exercise_deadline_overrides,
            )
        })
        .collect();
    let modules = collect_course_modules(course_modules, chapters)?.data;
    token.authorized_ok(web::Json(ChaptersWithStatus {
        is_previewable,
        modules,
    }))
}

/// Combines course modules and chapters, consuming them.
fn collect_course_modules(
    course_modules: Vec<CourseModule>,
    chapters: Vec<ChapterWithStatus>,
) -> ControllerResult<Vec<CourseMaterialCourseModule>> {
    let mut course_modules: HashMap<Uuid, CourseMaterialCourseModule> = course_modules
        .into_iter()
        .map(|course_module| {
            (
                course_module.id,
                CourseMaterialCourseModule {
                    chapters: vec![],
                    id: course_module.id,
                    is_default: course_module.name.is_none(),
                    name: course_module.name,
                    order_number: course_module.order_number,
                },
            )
        })
        .collect();
    for chapter in chapters {
        course_modules
            .get_mut(&chapter.course_module_id)
            .ok_or_else(|| {
                ControllerError::new(
                    ControllerErrorType::InternalServerError,
                    "Module data mismatch.".to_string(),
                    None,
                )
            })?
            .chapters
            .push(chapter);
    }
    let token = skip_authorize();
    token.authorized_ok(course_modules.into_values().collect())
}

/**
GET `/api/v0/course-material/courses/:course_id/user-settings` - Returns user settings for the current course.
*/
#[utoipa::path(
    get,
    path = "/{course_id}/user-settings",
    operation_id = "getCourseMaterialUserCourseSettings",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "User course settings", body = Option<UserCourseSettings>)
    )
)]
#[instrument(skip(pool))]
async fn get_user_course_settings(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Option<UserCourseSettings>>> {
    let mut conn = pool.acquire().await?;
    if let Some(user) = user {
        let settings = models::user_course_settings::get_user_course_settings_by_course_id(
            &mut conn, user.id, *course_id,
        )
        .await?;
        let token = skip_authorize();
        token.authorized_ok(web::Json(settings))
    } else {
        Err(ControllerError::new(
            ControllerErrorType::NotFound,
            "User not found".to_string(),
            None,
        ))
    }
}

/**
POST `/api/v0/course-material/courses/:course_id/search-pages-with-phrase` - Returns a list of pages given a search query.

Provided words are supposed to appear right after each other in the source document.

# Example

Request:

```http
POST /api/v0/course-material/courses/1a68e8b0-d151-4c0e-9307-bb154e9d2be1/search-pages-with-phrase HTTP/1.1
Content-Type: application/json

{
  "query": "Everything"
}
```
*/
#[utoipa::path(
    post,
    path = "/{course_id}/search-pages-with-phrase",
    operation_id = "searchPagesWithPhrase",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    request_body = SearchRequest,
    responses(
        (status = 200, description = "Matching pages", body = Vec<PageSearchResult>)
    )
)]
#[instrument(skip(pool))]
async fn search_pages_with_phrase(
    course_id: web::Path<Uuid>,
    payload: web::Json<SearchRequest>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<PageSearchResult>>> {
    let mut conn = pool.acquire().await?;
    let token =
        authorize_access_to_course_material(&mut conn, auth.map(|u| u.id), *course_id).await?;
    let res =
        models::pages::get_page_search_results_for_phrase(&mut conn, *course_id, &payload).await?;
    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/course-material/courses/:course_id/search-pages-with-words` - Returns a list of pages given a search query.

Provided words can appear in any order in the source document.

# Example

Request:

```http
POST /api/v0/course-material/courses/1a68e8b0-d151-4c0e-9307-bb154e9d2be1/search-pages-with-words HTTP/1.1
Content-Type: application/json

{
  "query": "Everything"
}
```
*/
#[utoipa::path(
    post,
    path = "/{course_id}/search-pages-with-words",
    operation_id = "searchPagesWithWords",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    request_body = SearchRequest,
    responses(
        (status = 200, description = "Matching pages", body = Vec<PageSearchResult>)
    )
)]
#[instrument(skip(pool))]
async fn search_pages_with_words(
    course_id: web::Path<Uuid>,
    payload: web::Json<SearchRequest>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<PageSearchResult>>> {
    let mut conn = pool.acquire().await?;
    let token =
        authorize_access_to_course_material(&mut conn, auth.map(|u| u.id), *course_id).await?;
    let res =
        models::pages::get_page_search_results_for_words(&mut conn, *course_id, &payload).await?;
    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/course-material/courses/:course_id/feedback` - Creates new feedback.
*/
#[utoipa::path(
    post,
    path = "/{course_id}/feedback",
    operation_id = "postFeedback",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    request_body = Vec<NewFeedback>,
    responses(
        (status = 200, description = "Created feedback ids", body = Vec<Uuid>)
    )
)]
pub async fn feedback(
    course_id: web::Path<Uuid>,
    new_feedback: web::Json<Vec<NewFeedback>>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<Uuid>>> {
    let mut conn = pool.acquire().await?;
    let fs = new_feedback.into_inner();
    let user_id = user.as_ref().map(|u| u.id);

    // validate
    for f in &fs {
        if f.feedback_given.len() > 1000 {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "Feedback given too long: max 1000".to_string(),
                None,
            ));
        }
        if f.related_blocks.len() > 100 {
            return Err(ControllerError::new(
                ControllerErrorType::BadRequest,
                "Too many related blocks: max 100".to_string(),
                None,
            ));
        }
        for block in &f.related_blocks {
            if block.text.as_ref().map(|t| t.len()).unwrap_or_default() > 10000 {
                return Err(ControllerError::new(
                    ControllerErrorType::BadRequest,
                    "Block text too long: max 10000".to_string(),
                    None,
                ));
            }
        }
    }

    let mut tx = conn.begin().await?;
    let mut ids = vec![];
    for f in fs {
        let id = feedback::insert(&mut tx, PKeyPolicy::Generate, user_id, *course_id, f).await?;
        ids.push(id);
    }
    tx.commit().await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(ids))
}

/**
POST `/api/v0/course-material/courses/:course_slug/edit` - Creates a new edit proposal.
*/
#[utoipa::path(
    post,
    path = "/{course_slug}/propose-edit",
    operation_id = "postCourseMaterialCourseEditProposal",
    tag = "course-material-courses",
    params(
        ("course_slug" = String, Path, description = "Course slug")
    ),
    request_body = NewProposedPageEdits,
    responses(
        (status = 200, description = "Created edit proposal id", body = Uuid)
    )
)]
async fn propose_edit(
    course_slug: web::Path<String>,
    edits: web::Json<NewProposedPageEdits>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let course = courses::get_course_by_slug(&mut conn, course_slug.as_str()).await?;
    let edits = edits.into_inner();
    let token =
        authorize_access_to_course_material(&mut conn, user.as_ref().map(|u| u.id), course.id)
            .await?;
    let (id, _) = proposed_page_edits::create_for_page_id_and_course_id(
        &mut conn,
        PKeyPolicy::Generate,
        course.id,
        user.map(|u| u.id),
        &edits,
    )
    .await?;
    token.authorized_ok(web::Json(id))
}

#[utoipa::path(
    get,
    path = "/{course_id}/glossary",
    operation_id = "getCourseMaterialGlossary",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course glossary", body = Vec<Term>)
    )
)]
#[instrument(skip(pool))]
async fn glossary(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<Term>>> {
    let mut conn = pool.acquire().await?;
    let token =
        authorize_access_to_course_material(&mut conn, auth.map(|u| u.id), *course_id).await?;
    let glossary = models::glossary::fetch_for_course(&mut conn, *course_id).await?;
    token.authorized_ok(web::Json(glossary))
}

#[utoipa::path(
    get,
    path = "/{course_id}/references",
    operation_id = "getCourseMaterialReferences",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Course references", body = Vec<MaterialReference>)
    )
)]
#[instrument(skip(pool))]
async fn get_material_references_by_course_id(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<MaterialReference>>> {
    let mut conn = pool.acquire().await?;
    let token =
        authorize_access_to_course_material(&mut conn, user.map(|u| u.id), *course_id).await?;
    let res =
        models::material_references::get_references_by_course_id(&mut conn, *course_id).await?;

    token.authorized_ok(web::Json(res))
}

/**
GET /api/v0/course-material/courses/:course_id/top-level-pages
*/
#[utoipa::path(
    get,
    path = "/{course_id}/top-level-pages",
    operation_id = "getCourseMaterialTopLevelPages",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Top-level pages", body = Vec<Page>)
    )
)]
#[instrument(skip(pool))]
async fn get_public_top_level_pages(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<Page>>> {
    let mut conn = pool.acquire().await?;
    let user_id = auth.map(|u| u.id);
    let token = authorize_access_to_course_material(&mut conn, user_id, *course_id).await?;
    let page = models::pages::get_course_top_level_pages_by_course_id_and_visibility(
        &mut conn,
        *course_id,
        PageVisibility::Public,
    )
    .await?;
    let page = models::pages::filter_course_material_pages(&mut conn, user_id, page).await?;
    token.authorized_ok(web::Json(page))
}

/**
GET `/api/v0/course-material/courses/:id/language-versions-navigation-info/from-page/:page_id` - Returns all language versions of the same course. Since this is for course material, this does not include draft courses. To make developing new courses easier, we include all draft courses that the user has access to.
*/
#[utoipa::path(
    get,
    path = "/{course_id}/language-versions-navigation-info/from-page/{page_id}",
    operation_id = "getCourseMaterialLanguageVersionNavigationInfos",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("page_id" = Uuid, Path, description = "Page id")
    ),
    responses(
        (status = 200, description = "Language version navigation info", body = Vec<CourseLanguageVersionNavigationInfo>)
    )
)]
#[instrument(skip(pool))]
async fn get_all_course_language_versions_navigation_info_from_page(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    user: Option<AuthUser>,
) -> ControllerResult<web::Json<Vec<CourseLanguageVersionNavigationInfo>>> {
    let mut conn = pool.acquire().await?;
    let (course_id, page_id) = path.into_inner();
    let token = skip_authorize();
    let course = models::courses::get_course(&mut conn, course_id).await?;

    let unfiltered_language_versions =
        models::courses::get_all_language_versions_of_course(&mut conn, &course).await?;

    let all_pages_in_same_page_language_group =
        models::page_language_groups::get_all_pages_in_page_language_group_mapping(
            &mut conn, page_id,
        )
        .await?;

    let mut accessible_courses = unfiltered_language_versions
        .clone()
        .into_iter()
        .filter(|c| !c.is_draft)
        .collect::<Vec<_>>();

    // If user is logged in, check access if we need to add draft courses
    if let Some(user_id) = user.map(|u| u.id) {
        let user_roles = models::roles::get_roles(&mut conn, user_id).await?;

        for course_version in unfiltered_language_versions.iter().filter(|c| c.is_draft) {
            if authorize_with_fetched_list_of_roles(
                &mut conn,
                Action::ViewMaterial,
                Some(user_id),
                Resource::Course(course_version.id),
                &user_roles,
            )
            .await
            .is_ok()
            {
                accessible_courses.push(course_version.clone());
            }
        }
    }

    token.authorized_ok(web::Json(
        accessible_courses
            .into_iter()
            .map(|c| {
                let page_language_group_navigation_info =
                    all_pages_in_same_page_language_group.get(&CourseOrExamId::Course(c.id));
                CourseLanguageVersionNavigationInfo::from_course_and_page_info(
                    &c,
                    page_language_group_navigation_info,
                )
            })
            .collect(),
    ))
}

/**
GET `/api/v0/{course_id}/pages/by-language-group-id/{page_language_group_id} - Returns a page with the given course id and language group id.
 */
#[utoipa::path(
    get,
    path = "/{course_id}/pages/by-language-group-id/{page_language_group_id}",
    operation_id = "getCourseMaterialPageByCourseIdAndLanguageGroupId",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("page_language_group_id" = Uuid, Path, description = "Page language group id")
    ),
    responses(
        (status = 200, description = "Page in requested language group", body = Page)
    )
)]
#[instrument(skip(pool))]
async fn get_page_by_course_id_and_language_group(
    info: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    auth: Option<AuthUser>,
) -> ControllerResult<web::Json<Page>> {
    let mut conn = pool.acquire().await?;
    let (course_id, page_language_group_id) = info.into_inner();
    let user_id = auth.map(|u| u.id);
    let token = authorize_access_to_course_material(&mut conn, user_id, course_id).await?;

    let page: Page = models::pages::get_page_by_course_id_and_language_group(
        &mut conn,
        course_id,
        page_language_group_id,
    )
    .await?;
    let page = models::pages::filter_course_material_page(&mut conn, user_id, page).await?;
    token.authorized_ok(web::Json(page))
}

/**
POST `/api/v0/{course_id}/course-instances/{course_instance_id}/student-countries/{country_code}` - Add a new student's country entry.
*/
#[utoipa::path(
    post,
    path = "/{course_id}/course-instances/{course_instance_id}/student-countries/{country_code}",
    operation_id = "postCourseMaterialStudentCountry",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("course_instance_id" = Uuid, Path, description = "Course instance id"),
        ("country_code" = String, Path, description = "Country code")
    ),
    responses(
        (status = 200, description = "Student country recorded", body = bool)
    )
)]
#[instrument(skip(pool))]
async fn student_country(
    query: web::Path<(Uuid, Uuid, String)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<Json<bool>> {
    let mut conn = pool.acquire().await?;
    let (course_id, course_instance_id, country_code) = query.into_inner();

    models::student_countries::insert(
        &mut conn,
        user.id,
        course_id,
        course_instance_id,
        &country_code,
    )
    .await?;
    let token = skip_authorize();

    token.authorized_ok(Json(true))
}

/**
GET `/api/v0/{course_id}/course-instances/{course_instance_id}/student-countries - Returns countries of student registered in a course.
 */
#[utoipa::path(
    get,
    path = "/{course_id}/course-instances/{course_instance_id}/student-countries",
    operation_id = "getCourseMaterialStudentCountries",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id"),
        ("course_instance_id" = Uuid, Path, description = "Course instance id")
    ),
    responses(
        (status = 200, description = "Student country counts", body = HashMap<String, u32>)
    )
)]
#[instrument(skip(pool))]
async fn get_student_countries(
    query: web::Path<(Uuid, Uuid)>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<HashMap<String, u32>>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let (course_id, course_instance_id) = query.into_inner();

    let country_codes: Vec<String> =
        models::student_countries::get_countries(&mut conn, course_id, course_instance_id)
            .await?
            .into_iter()
            .map(|c| c.country_code)
            .collect();

    let mut frequency: HashMap<String, u32> = HashMap::new();
    for code in country_codes {
        *frequency.entry(code).or_insert(0) += 1
    }

    token.authorized_ok(web::Json(frequency))
}

/**
GET `/api/v0/{course_id}/student-country - Returns country of a student registered in a course.
 */
#[utoipa::path(
    get,
    path = "/{course_instance_id}/student-country",
    operation_id = "getCourseMaterialStudentCountry",
    tag = "course-material-courses",
    params(
        ("course_instance_id" = Uuid, Path, description = "Course instance id")
    ),
    responses(
        (status = 200, description = "Selected student country", body = StudentCountry)
    )
)]
#[instrument(skip(pool))]
async fn get_student_country(
    course_instance_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<StudentCountry>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();
    let res = models::student_countries::get_selected_country_by_user_id(
        &mut conn,
        user.id,
        *course_instance_id,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/course-material/courses/:course_id/research-consent-form` - Fetches courses research form with course id.
*/
#[utoipa::path(
    get,
    path = "/{course_id}/research-consent-form",
    operation_id = "getCourseMaterialResearchConsentForm",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Research consent form", body = Option<ResearchForm>)
    )
)]
#[instrument(skip(pool))]
async fn get_research_form_with_course_id(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Option<ResearchForm>>> {
    let mut conn = pool.acquire().await?;
    let user_id = Some(user.id);

    let token = authorize_access_to_course_material(&mut conn, user_id, *course_id).await?;

    let res = models::research_forms::get_research_form_with_course_id(&mut conn, *course_id)
        .await
        .optional()?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/course-material/courses/:course_id/research-consent-form-questions` - Fetches courses research form questions with course id.
*/
#[utoipa::path(
    get,
    path = "/{course_id}/research-consent-form-questions",
    operation_id = "getCourseMaterialResearchConsentFormQuestions",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Research consent form questions", body = Vec<ResearchFormQuestion>)
    )
)]
#[instrument(skip(pool))]
async fn get_research_form_questions_with_course_id(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<ResearchFormQuestion>>> {
    let mut conn = pool.acquire().await?;
    let user_id = Some(user.id);

    let token = authorize_access_to_course_material(&mut conn, user_id, *course_id).await?;
    let res =
        models::research_forms::get_research_form_questions_with_course_id(&mut conn, *course_id)
            .await?;

    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/course-material/courses/:course_id/research-consent-form-questions-answer` - Upserts users consent for a courses research form question.
*/

#[utoipa::path(
    post,
    path = "/{course_id}/research-consent-form-questions-answer",
    operation_id = "postCourseMaterialResearchConsentFormAnswer",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    request_body = NewResearchFormQuestionAnswer,
    responses(
        (status = 200, description = "Research consent answer id", body = Uuid)
    )
)]
#[instrument(skip(pool, payload))]
async fn upsert_course_research_form_answer(
    payload: web::Json<NewResearchFormQuestionAnswer>,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let user_id = Some(user.id);

    let token = authorize_access_to_course_material(&mut conn, user_id, *course_id).await?;
    let answer = payload.into_inner();
    let res = models::research_forms::upsert_answer_for_user_id_and_question_id(
        &mut conn,
        user.id,
        *course_id,
        answer.research_form_question_id,
        answer.research_consent,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/course/courses/:course_id/research-consent-form-users-answers` - Fetches users answers for courses research form.
*/
#[utoipa::path(
    get,
    path = "/{course_id}/research-consent-form-user-answers",
    operation_id = "getCourseMaterialResearchConsentFormAnswers",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Research consent answers", body = Vec<ResearchFormQuestionAnswer>)
    )
)]
#[instrument(skip(pool))]
async fn get_research_form_answers_with_user_id(
    course_id: web::Path<Uuid>,
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<ResearchFormQuestionAnswer>>> {
    let mut conn = pool.acquire().await?;
    let user_id = Some(user.id);

    let token = authorize_access_to_course_material(&mut conn, user_id, *course_id).await?;

    let res = models::research_forms::get_research_form_answers_with_user_id(
        &mut conn, *course_id, user.id,
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]

pub struct UserMarketingConsentPayload {
    pub course_language_groups_id: Uuid,
    pub email_subscription: bool,
    pub marketing_consent: bool,
}

/**
POST `/api/v0/course-material/courses/:course_id/user-marketing-consent` - Adds or updates user's marketing consent for a specific course.
*/
#[utoipa::path(
    post,
    path = "/{course_id}/user-marketing-consent",
    operation_id = "updateMarketingConsent",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    request_body = UserMarketingConsentPayload,
    responses(
        (status = 200, description = "Marketing consent id", body = Uuid)
    )
)]
#[instrument(skip(pool, payload))]
async fn update_marketing_consent(
    payload: web::Json<UserMarketingConsentPayload>,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Uuid>> {
    let mut conn = pool.acquire().await?;
    let user_id = Some(user.id);

    let token = authorize_access_to_course_material(&mut conn, user_id, *course_id).await?;

    let email_subscription = if payload.email_subscription {
        "subscribed"
    } else {
        "unsubscribed"
    };

    let result = models::marketing_consents::upsert_marketing_consent(
        &mut conn,
        *course_id,
        payload.course_language_groups_id,
        &user.id,
        email_subscription,
        payload.marketing_consent,
    )
    .await?;

    token.authorized_ok(web::Json(result))
}

/**
GET `/api/v0/course-material/courses/:course_id/fetch-user-marketing-consent`
*/
#[utoipa::path(
    get,
    path = "/{course_id}/fetch-user-marketing-consent",
    operation_id = "getCourseMaterialUserMarketingConsent",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "User marketing consent", body = Option<UserMarketingConsent>)
    )
)]
#[instrument(skip(pool))]
async fn fetch_user_marketing_consent(
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
    user: AuthUser,
) -> ControllerResult<web::Json<Option<UserMarketingConsent>>> {
    let mut conn = pool.acquire().await?;
    let user_id = Some(user.id);

    let token = authorize_access_to_course_material(&mut conn, user_id, *course_id).await?;

    let result =
        models::marketing_consents::fetch_user_marketing_consent(&mut conn, *course_id, &user.id)
            .await
            .ok();

    token.authorized_ok(web::Json(result))
}

/**
GET /courses/:course_id/partners-block - Gets a partners block related to a course
*/
#[utoipa::path(
    get,
    path = "/{course_id}/partners-block",
    operation_id = "getCourseMaterialPartnersBlock",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Partners block", body = Option<PartnersBlock>)
    )
)]
#[instrument(skip(pool))]
async fn get_partners_block(
    path: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Option<PartnersBlock>>> {
    let course_id = path.into_inner();
    let mut conn = pool.acquire().await?;
    let partner_block = models::partner_block::get_partner_block(&mut conn, course_id)
        .await
        .optional()?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(partner_block))
}

/**
GET /courses/:course_id/privacy_link - Gets a privacy link related to a course
*/
#[utoipa::path(
    get,
    path = "/{course_id}/privacy-link",
    operation_id = "getCourseMaterialPrivacyLink",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Privacy links", body = Vec<PrivacyLink>)
    )
)]
#[instrument(skip(pool))]
async fn get_privacy_link(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<PrivacyLink>>> {
    let mut conn = pool.acquire().await?;
    let privacy_link = models::privacy_link::get_privacy_link(&mut conn, *course_id).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(privacy_link))
}

/**
GET /courses/:course_id/custom-privacy-policy-checkbox-texts - Used to get customized checkbox texts for courses that use a different privacy policy than all our other courses (e.g. the Elements of AI course). These texts are shown in the course settings dialog.
*/
#[utoipa::path(
    get,
    path = "/{course_id}/custom-privacy-policy-checkbox-texts",
    operation_id = "getCourseMaterialCustomPrivacyPolicyCheckboxTexts",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Custom privacy policy checkbox texts", body = Vec<CourseCustomPrivacyPolicyCheckboxText>)
    )
)]
#[instrument(skip(pool))]
async fn get_custom_privacy_policy_checkbox_texts(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser, // Ensure the user is authenticated
) -> ControllerResult<web::Json<Vec<CourseCustomPrivacyPolicyCheckboxText>>> {
    let mut conn = pool.acquire().await?;

    let token = authorize_access_to_course_material(&mut conn, Some(user.id), *course_id).await?;

    let texts = models::course_custom_privacy_policy_checkbox_texts::get_all_by_course_id(
        &mut conn, *course_id,
    )
    .await?;

    token.authorized_ok(web::Json(texts))
}

/**
GET `/api/v0/course-material/courses/:course_id/user-chapter-locks` - Get user's chapter locking statuses for course

Returns all chapters that the authenticated user has unlocked or completed for the specified course.
**/
#[utoipa::path(
    get,
    path = "/{course_id}/user-chapter-locks",
    operation_id = "getCourseMaterialUserChapterLocks",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "User chapter locking statuses", body = Vec<models::user_chapter_locking_statuses::UserChapterLockingStatus>)
    )
)]
#[instrument(skip(pool))]
async fn get_user_chapter_locks(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<Vec<models::user_chapter_locking_statuses::UserChapterLockingStatus>>>
{
    use models::user_chapter_locking_statuses;
    let mut conn = pool.acquire().await?;
    let token = authorize_access_to_course_material(&mut conn, Some(user.id), *course_id).await?;

    let statuses =
        user_chapter_locking_statuses::get_or_init_all_for_course(&mut conn, user.id, *course_id)
            .await?;

    token.authorized_ok(web::Json(statuses))
}

/**
GET `/api/v0/course-material/courses/:course_id/sisu-course-info` - Get Sisu course info

Returns all course info for specific course.
**/
#[utoipa::path(
    get,
    path = "/{course_id}/sisu-course-info",
    operation_id = "getCourseMaterialSisuCourseInfo",
    tag = "course-material-courses",
    params(
        ("course_id" = Uuid, Path, description = "Course id")
    ),
    responses(
        (status = 200, description = "Sisu course info", body = Vec<SisuCourseInfoElement>)
    )
)]
#[instrument(skip(pool))]
async fn get_sisu_course_info(
    course_id: web::Path<Uuid>,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<SisuCourseInfoElement>>> {
    let mut conn = pool.acquire().await?;
    let course_modules = models::course_modules::get_by_course_id(&mut conn, *course_id).await?;

    let uh_course_codes: Vec<String> = course_modules
        .iter()
        .filter_map(|course_module| course_module.clone().uh_course_code)
        .collect::<Vec<String>>();
    let course_codes = SisuClient::get_course_codes(uh_course_codes).await?;

    let course_info = SisuClient::get_course_info(course_codes).await?;
    let token = skip_authorize();
    token.authorized_ok(web::Json(course_info))
}

/**
Add a route for each controller in this module.

The name starts with an underline in order to appear before other functions in the module documentation.

We add the routes by calling the route method instead of using the route annotations because this method preserves the function signatures for documentation.
*/
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{course_id}", web::get().to(get_course))
        .route("/{course_id}/chapters", web::get().to(get_chapters))
        .route(
            "/{course_id}/course-instances",
            web::get().to(get_course_instances),
        )
        .route(
            "/{course_id}/current-instance",
            web::get().to(get_current_course_instance),
        )
        .route("/{course_id}/feedback", web::post().to(feedback))
        .route(
            "/{course_id}/page-by-path/{url_path:.*}",
            web::get().to(get_course_page_by_path),
        )
        .route(
            "/{course_id}/search-pages-with-phrase",
            web::post().to(search_pages_with_phrase),
        )
        .route(
            "/{course_id}/language-versions-navigation-info/from-page/{page_id}",
            web::get().to(get_all_course_language_versions_navigation_info_from_page),
        )
        .route(
            "/{course_id}/search-pages-with-words",
            web::post().to(search_pages_with_words),
        )
        .route(
            "/{course_id}/user-settings",
            web::get().to(get_user_course_settings),
        )
        .route(
            "/{course_id}/top-level-pages",
            web::get().to(get_public_top_level_pages),
        )
        .route("/{course_id}/propose-edit", web::post().to(propose_edit))
        .route("/{course_id}/glossary", web::get().to(glossary))
        .route(
            "/{course_id}/references",
            web::get().to(get_material_references_by_course_id),
        )
        .route(
            "/{course_id}/pages/by-language-group-id/{page_language_group_id}",
            web::get().to(get_page_by_course_id_and_language_group),
        )
        .route("/{course_id}/pages", web::get().to(get_public_course_pages))
        .route(
            "/{course_id}/course-instances/{course_instance_id}/student-countries/{country_code}",
            web::post().to(student_country),
        )
        .route(
            "/{course_instance_id}/student-country",
            web::get().to(get_student_country),
        )
        .route(
            "/{course_id}/course-instances/{course_instance_id}/student-countries",
            web::get().to(get_student_countries),
        )
        .route(
            "/{course_id}/research-consent-form-questions-answer",
            web::post().to(upsert_course_research_form_answer),
        )
        .route(
            "/{courseId}/research-consent-form-user-answers",
            web::get().to(get_research_form_answers_with_user_id),
        )
        .route(
            "/{course_id}/research-consent-form",
            web::get().to(get_research_form_with_course_id),
        )
        .route(
            "/{course_id}/partners-block",
            web::get().to(get_partners_block),
        )
        .route("/{course_id}/privacy-link", web::get().to(get_privacy_link))
        .route(
            "/{course_id}/research-consent-form-questions",
            web::get().to(get_research_form_questions_with_course_id),
        )
        .route(
            "/{course_id}/user-marketing-consent",
            web::post().to(update_marketing_consent),
        )
        .route(
            "/{course_id}/fetch-user-marketing-consent",
            web::get().to(fetch_user_marketing_consent),
        )
        .route(
            "/{course_id}/custom-privacy-policy-checkbox-texts",
            web::get().to(get_custom_privacy_policy_checkbox_texts),
        )
        .route(
            "/{course_id}/user-chapter-locks",
            web::get().to(get_user_chapter_locks),
        )
        .route(
            "/{course_id}/sisu-course-info",
            web::get().to(get_sisu_course_info),
        );
}
