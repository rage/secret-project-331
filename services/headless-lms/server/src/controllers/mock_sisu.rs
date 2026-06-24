use crate::prelude::*;
use headless_lms_utils::services::sisu::{
    Additional, CourseUnitSearchResults, Credits, Name, SearchResult, SisuCourseInfoElement,
    SisuCourseInfoValidityPeriod,
};
use serde_json;

async fn mock_sisu_id_query(
    app_conf: web::Data<ApplicationConfiguration>,
    code: web::Path<String>,
) -> ControllerResult<String> {
    assert!(app_conf.test_mode && app_conf.test_sisu);

    let res = match code.as_str() {
        "TEST001" => {
            let sisu_ids: Vec<SearchResult> = vec![
                SearchResult {
                    id: "mock-id-1-1".to_string(),
                },
                SearchResult {
                    id: "mock-id-1-2".to_string(),
                },
            ];
            serde_json::to_string(
                &(CourseUnitSearchResults {
                    search_results: sisu_ids,
                }),
            )
        }
        "TEST002" => {
            let sisu_ids: Vec<SearchResult> = vec![
                SearchResult {
                    id: "mock-id-2-1".to_string(),
                },
                SearchResult {
                    id: "mock-id-2-2".to_string(),
                },
            ];
            serde_json::to_string(
                &(CourseUnitSearchResults {
                    search_results: sisu_ids,
                }),
            )
        }
        "TEST003" => {
            let sisu_ids: Vec<SearchResult> = vec![
                SearchResult {
                    id: "mock-id-3-1".to_string(),
                },
                SearchResult {
                    id: "mock-id-3-2".to_string(),
                },
            ];
            serde_json::to_string(
                &(CourseUnitSearchResults {
                    search_results: sisu_ids,
                }),
            )
        }

        _ => serde_json::to_string(
            &(CourseUnitSearchResults {
                search_results: vec![],
            }),
        ),
    }?;
    let token = skip_authorize();
    token.authorized_ok(res)
}

async fn mock_sisu_course_info(
    app_conf: web::Data<ApplicationConfiguration>,
    id: web::Path<String>,
) -> ControllerResult<String> {
    assert!(app_conf.test_mode && app_conf.test_sisu);
    let res = match id.as_str() {
        "mock-id-1-1" => serde_json::to_string(
            &(SisuCourseInfoElement {
                id: String::from("mock-id-1-1"),
                university_org_ids: vec!["hy-university".to_string()],
                group_id: "hy-CU-142971304".to_string(),
                credits: Credits {
                    min: None,
                    max: None,
                },
                completion_methods: vec![],
                name: Name {
                    en: Some("Mock Docker 1".to_string()),
                    fi: None,
                    sv: None,
                },
                code: "TEST001".to_string(),
                abbreviation: None,
                validity_period: SisuCourseInfoValidityPeriod {
                    start_date: None,
                    end_date: None,
                },
                grade_scale_id: "sis-hyl-hyv".to_string(),
                tweet_text: None,
                outcomes: Some(Additional {
                    en: Some("Mock outcomes".to_string()),
                    fi: None,
                    sv: None,
                }),
                prerequisites: Some(Additional {
                    en: Some("Mock prerequisites".to_string()),
                    fi: None,
                    sv: None,
                }),
                content: Some(Additional {
                    en: Some("Mock content".to_string()),
                    fi: None,
                    sv: None,
                }),
                additional: Some(Additional {
                    en: Some("Mock additional".to_string()),
                    fi: None,
                    sv: None,
                }),
                learning_material: Some(Additional {
                    en: Some("Mock learning materials".to_string()),
                    fi: None,
                    sv: None,
                }),
                literature: vec![],
                study_level: "".to_string(),
                course_unit_type: "".to_string(),
                subject: None,
                cefr_level: None,
                organisations: vec![],
                possible_attainment_languages: vec![],
                part_of_degree: None,
            }),
        ),
        "mock-id-2-1" => serde_json::to_string(
            &(SisuCourseInfoElement {
                id: String::from("mock-id-2-1"),
                university_org_ids: vec!["hy-university".to_string()],
                group_id: "hy-CU-142971304".to_string(),
                credits: Credits {
                    min: None,
                    max: None,
                },
                completion_methods: vec![],
                name: Name {
                    en: Some("Mock Docker 2".to_string()),
                    fi: None,
                    sv: None,
                },
                code: "TEST002".to_string(),
                abbreviation: None,
                validity_period: SisuCourseInfoValidityPeriod {
                    start_date: None,
                    end_date: None,
                },
                grade_scale_id: "sis-hyl-hyv".to_string(),
                tweet_text: None,
                outcomes: Some(Additional {
                    en: Some("Mock outcomes".to_string()),
                    fi: None,
                    sv: None,
                }),
                prerequisites: Some(Additional {
                    en: Some("Mock prerequisites".to_string()),
                    fi: None,
                    sv: None,
                }),
                content: Some(Additional {
                    en: Some("Mock content".to_string()),
                    fi: None,
                    sv: None,
                }),
                additional: Some(Additional {
                    en: Some("Mock additional".to_string()),
                    fi: None,
                    sv: None,
                }),
                learning_material: Some(Additional {
                    en: Some("Mock learning materials".to_string()),
                    fi: None,
                    sv: None,
                }),
                literature: vec![],
                study_level: "".to_string(),
                course_unit_type: "".to_string(),
                subject: None,
                cefr_level: None,
                organisations: vec![],
                possible_attainment_languages: vec![],
                part_of_degree: None,
            }),
        ),
        "mock-id-3-1" => serde_json::to_string(
            &(SisuCourseInfoElement {
                id: String::from("mock-id-3-1"),
                university_org_ids: vec!["hy-university".to_string()],
                group_id: "hy-CU-142971304".to_string(),
                credits: Credits {
                    min: None,
                    max: None,
                },
                completion_methods: vec![],
                name: Name {
                    en: Some("Mock Docker 3".to_string()),
                    fi: None,
                    sv: None,
                },
                code: "TEST003".to_string(),
                abbreviation: None,
                validity_period: SisuCourseInfoValidityPeriod {
                    start_date: None,
                    end_date: None,
                },
                grade_scale_id: "sis-hyl-hyv".to_string(),
                tweet_text: None,
                outcomes: Some(Additional {
                    en: Some("Mock outcomes".to_string()),
                    fi: None,
                    sv: None,
                }),
                prerequisites: Some(Additional {
                    en: Some("Mock prerequisites".to_string()),
                    fi: None,
                    sv: None,
                }),
                content: Some(Additional {
                    en: Some("Mock content".to_string()),
                    fi: None,
                    sv: None,
                }),
                additional: Some(Additional {
                    en: Some("Mock additional".to_string()),
                    fi: None,
                    sv: None,
                }),
                learning_material: Some(Additional {
                    en: Some("Mock learning materials".to_string()),
                    fi: None,
                    sv: None,
                }),
                literature: vec![],
                study_level: "".to_string(),
                course_unit_type: "".to_string(),
                subject: None,
                cefr_level: None,
                organisations: vec![],
                possible_attainment_languages: vec![],
                part_of_degree: None,
            }),
        ),

        _ => Ok("{}".to_string()),
    }?;
    let token = skip_authorize();
    token.authorized_ok(res)
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/kori/api/{code}", web::get().to(mock_sisu_id_query))
        .route(
            "/kori/api/course-units/{id}",
            web::get().to(mock_sisu_course_info),
        );
}
