use crate::prelude::*;
use headless_lms_utils::services::sisu::{
    Additional, CourseUnitSearchResults, Credits, Name, Organisation, ResponsibilityInfo,
    SearchResult, SisuCourseInfoElement, SisuCourseInfoValidityPeriod, SisuPerson,
};
use serde_json::json;

const MOCK_COURSE_CODES: [&str; 3] = ["TEST001", "TEST002", "TEST003"];
const MOCK_TEACHER_ID: &str = "mock-person-teacher";
const MOCK_REALISATION_TEACHER_ID: &str = "mock-person-realisation-teacher";
const MOCK_ORGANISATION_ID: &str = "mock-org-programme";
const MOCK_ASSESSMENT_ITEM_ID: &str = "mock-assessment-item";

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MockSisuRequest {
    code_query: String,
}

/// Each mock code has a current version (`-1`) and an ended one (`-2`).
async fn mock_sisu_id_query(
    query_params: web::Query<MockSisuRequest>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<String> {
    assert!(app_conf.test_mode && app_conf.test_sisu);
    let code = query_params.code_query.as_str();
    let search_results = match MOCK_COURSE_CODES.iter().position(|c| *c == code) {
        Some(index) => (1..=2)
            .map(|version| SearchResult {
                id: format!("mock-id-{}-{version}", index + 1),
                code: Some(code.to_string()),
            })
            .collect(),
        None => vec![],
    };
    let res = serde_json::to_string(&CourseUnitSearchResults { search_results })?;
    let token = skip_authorize();
    token.authorized_ok(res)
}

async fn mock_sisu_course_info(
    app_conf: web::Data<ApplicationConfiguration>,
    id: web::Path<String>,
) -> ControllerResult<HttpResponse> {
    assert!(app_conf.test_mode && app_conf.test_sisu);
    let token = skip_authorize();
    let Some((index, version)) = id
        .strip_prefix("mock-id-")
        .and_then(|rest| rest.split_once('-'))
        .and_then(|(index, version)| Some((index.parse::<usize>().ok()?, version)))
        .filter(|(index, version)| {
            (1..=MOCK_COURSE_CODES.len()).contains(index) && matches!(*version, "1" | "2")
        })
    else {
        return token.authorized_ok(HttpResponse::NotFound().finish());
    };
    let validity_period = if version == "1" {
        SisuCourseInfoValidityPeriod {
            start_date: Some("2020-08-01".to_string()),
            end_date: None,
        }
    } else {
        SisuCourseInfoValidityPeriod {
            start_date: Some("2015-08-01".to_string()),
            end_date: Some("2020-08-01".to_string()),
        }
    };
    let course_unit = mock_course_unit(
        id.as_str(),
        MOCK_COURSE_CODES[index - 1],
        &format!("Mock Docker {index}"),
        validity_period,
    );
    token.authorized_ok(HttpResponse::Ok().json(course_unit))
}

fn mock_course_unit(
    id: &str,
    code: &str,
    name: &str,
    validity_period: SisuCourseInfoValidityPeriod,
) -> SisuCourseInfoElement {
    let english = |text: &str| Additional {
        en: Some(text.to_string()),
        fi: None,
        sv: None,
    };
    SisuCourseInfoElement {
        id: id.to_string(),
        university_org_ids: vec!["hy-university".to_string()],
        group_id: "hy-CU-142971304".to_string(),
        credits: Credits {
            min: None,
            max: None,
        },
        completion_methods: vec![Some(json!({
            "studyType": "DEGREE_STUDIES",
            "automaticEvaluation": true,
            "assessmentItemIds": [MOCK_ASSESSMENT_ITEM_ID],
        }))],
        name: Name {
            en: Some(name.to_string()),
            fi: None,
            sv: None,
        },
        code: code.to_string(),
        abbreviation: None,
        validity_period,
        grade_scale_id: "sis-hyl-hyv".to_string(),
        tweet_text: None,
        outcomes: Some(english("Mock outcomes")),
        prerequisites: Some(english("Mock prerequisites")),
        content: Some(english("Mock content")),
        additional: Some(english("Mock additional")),
        learning_material: Some(english("Mock learning materials")),
        literature: vec![],
        study_level: "".to_string(),
        course_unit_type: "".to_string(),
        subject: None,
        cefr_level: None,
        organisations: vec![Organisation {
            organisation_id: Some(MOCK_ORGANISATION_ID.to_string()),
            educational_institution_urn: None,
            role_urn: "urn:code:organisation-role:responsible-organisation".to_string(),
            share: 1.0,
            validity_period: None,
        }],
        possible_attainment_languages: vec![],
        part_of_degree: None,
        responsibility_infos: Some(vec![ResponsibilityInfo {
            role_urn: "urn:code:module-responsibility-info-type:responsible-teacher".to_string(),
            person_id: Some(MOCK_TEACHER_ID.to_string()),
            text: None,
            validity_period: None,
        }]),
    }
}

async fn mock_sisu_person(
    app_conf: web::Data<ApplicationConfiguration>,
    id: web::Path<String>,
) -> ControllerResult<HttpResponse> {
    assert!(app_conf.test_mode && app_conf.test_sisu);
    let token = skip_authorize();
    let (first_name, last_name, email, title) = match id.as_str() {
        MOCK_TEACHER_ID => ("Mock", "Teacher", "mock.teacher@example.com", "Professor"),
        MOCK_REALISATION_TEACHER_ID => (
            "Mock",
            "Lecturer",
            "mock.lecturer@example.com",
            "University Lecturer",
        ),
        _ => return token.authorized_ok(HttpResponse::NotFound().finish()),
    };
    token.authorized_ok(HttpResponse::Ok().json(SisuPerson {
        id: id.into_inner(),
        first_name: Some(first_name.to_string()),
        last_name: Some(last_name.to_string()),
        email_address: Some(email.to_string()),
        titles: vec![Additional {
            en: Some(title.to_string()),
            fi: None,
            sv: None,
        }],
    }))
}

async fn mock_sisu_organisation(
    app_conf: web::Data<ApplicationConfiguration>,
    id: web::Path<String>,
) -> ControllerResult<HttpResponse> {
    assert!(app_conf.test_mode && app_conf.test_sisu);
    let token = skip_authorize();
    if id.as_str() != MOCK_ORGANISATION_ID {
        return token.authorized_ok(HttpResponse::NotFound().finish());
    }
    token.authorized_ok(HttpResponse::Ok().json(json!({
        "id": MOCK_ORGANISATION_ID,
        "name": { "en": "Mock Degree Programme" },
    })))
}

async fn mock_sisu_realisations_by_assessment_item(
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    assert!(app_conf.test_mode && app_conf.test_sisu);
    let token = skip_authorize();
    token.authorized_ok(HttpResponse::Ok().json(json!([{
        "id": "mock-realisation",
        "name": { "en": "Mock implementation" },
        "activityPeriod": { "startDate": "2020-08-01" },
        "flowState": "PUBLISHED",
        "responsibilityInfos": [{
            "roleUrn": "urn:code:course-unit-realisation-responsibility-info-type:teacher",
            "personId": MOCK_REALISATION_TEACHER_ID,
            "text": null,
            "validityPeriod": {},
        }],
    }])))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("course-unit-search", web::get().to(mock_sisu_id_query))
        .route("course-units/v1/{id}", web::get().to(mock_sisu_course_info))
        .route("persons/v1/{id}", web::get().to(mock_sisu_person))
        .route("organisations/{id}", web::get().to(mock_sisu_organisation))
        .route(
            "course-unit-realisations-by-assessment-item-id",
            web::get().to(mock_sisu_realisations_by_assessment_item),
        );
}
