use crate::{error::util_error::SisuErrorVariant, prelude::*};
pub struct SisuClient {}

use regex::Regex;
use utoipa::ToSchema;

use serde::{Deserialize, Serialize};
use std::{cmp::Ordering, collections::HashMap};
pub type SisuCourseInfo = Vec<SisuCourseInfoElement>;

#[derive(Serialize, Deserialize, ToSchema, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SisuCourseInfoElement {
    pub id: String,
    pub university_org_ids: Vec<String>,
    pub group_id: String,
    pub credits: Credits,
    pub completion_methods: Vec<Option<serde_json::Value>>,
    pub name: Name,
    pub code: String,
    pub abbreviation: Option<String>,
    pub validity_period: SisuCourseInfoValidityPeriod,
    pub grade_scale_id: String,
    pub tweet_text: Option<serde_json::Value>,
    pub outcomes: Option<Additional>,
    pub prerequisites: Option<Additional>,
    pub content: Option<Additional>,
    pub additional: Option<Additional>,
    pub learning_material: Option<Additional>,
    pub literature: Vec<Option<serde_json::Value>>,
    pub study_level: String,
    pub course_unit_type: String,
    pub subject: Option<serde_json::Value>,
    pub cefr_level: Option<serde_json::Value>,
    pub organisations: Vec<Organisation>,
    pub possible_attainment_languages: Vec<String>,
    pub part_of_degree: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct Additional {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub fi: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub en: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sv: Option<String>,
}

impl Additional {
    pub fn choose_language(&self, language_code: &String) -> Option<String> {
        let mut vec = self.as_vec();
        vec.sort_by(|o1, o2| {
            if &o1.0 == language_code {
                return Ordering::Less;
            }
            if &o2.0 == language_code {
                return Ordering::Greater;
            }
            if o1.0 == "en" {
                return Ordering::Less;
            }
            if o2.0 == "en" {
                return Ordering::Greater;
            }
            Ordering::Equal
        });
        let strip_html_regex = Regex::new(r"<[^>]*>").expect("invalid regex");
        let max_length = vec
            .iter()
            .map(|n| {
                let value = &n.1;
                if let Some(value) = value {
                    let cleaned = strip_html_regex.replace_all(value, "");
                    cleaned.len()
                } else {
                    0
                }
            })
            .max()
            .unwrap_or(0);

        let best = vec.iter().find(|o| {
            let text = &o.1;
            if let Some(text) = text {
                let cleaned = strip_html_regex.replace_all(text, "");
                let len = cleaned.len();
                if len < max_length / 2 {
                    return false;
                }
                true
            } else {
                false
            }
        });
        best.and_then(|o| o.1.clone())
    }
    fn as_vec(&self) -> Vec<(String, Option<String>)> {
        vec![
            ("en".to_string(), self.en.clone()),
            ("fi".to_string(), self.fi.clone()),
            ("sv".to_string(), self.sv.clone()),
        ]
    }
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct Credits {
    pub min: Option<i64>,
    pub max: Option<i64>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct Name {
    pub en: Option<String>,
    pub fi: Option<String>,
    pub sv: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Organisation {
    pub organisation_id: Option<String>,
    pub educational_institution_urn: Option<serde_json::Value>,
    pub role_urn: String,
    pub share: i64,
    pub validity_period: Option<OrganisationValidityPeriod>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct OrganisationValidityPeriod {}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SisuCourseInfoValidityPeriod {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: String,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CourseUnitSearchResults {
    pub search_results: Vec<SearchResult>,
}
#[derive(Debug, ToSchema, Serialize, Deserialize, Clone)]
pub struct SisuDescriptions {
    outcomes: Option<String>,
    content: Option<String>,
    prerequisites: Option<String>,
    additional: Option<String>,
    learning_material: Option<String>,
}

impl SisuClient {
    pub async fn get_course_ids(
        is_mock_sisu: bool,
        base_url: &String,
        course_modules: Vec<String>,
    ) -> UtilResult<Vec<Vec<String>>> {
        let course_codes = course_modules;
        let mut course_ids: Vec<Vec<String>> = vec![];
        let mut invalid_codes: Vec<String> = vec![];
        for code in course_codes {
            let url = if is_mock_sisu {
                format!("{base_url}/api/v0/mock-sisu/kori/api/{code}")
            } else {
                format!(
                    "https://sisu.helsinki.fi/kori/api/course-unit-search?codeQuery={code}&validity=ALL&returnAllGroupVersions=true"
                )
            };

            let response = REQWEST_CLIENT
                .get(url)
                .header("Content-Type", "application/json")
                .send()
                .await
                .map_err(|e| {
                    util_err!(
                        SisuClientError(SisuErrorVariant::GenericSisuError),
                        "Request to Sisu failed",
                        e
                    )
                })?;

            if response.status().is_success() {
                let json: CourseUnitSearchResults =
                    serde_json::from_str(&response.text().await.unwrap_or("{}".to_string()))?;
                let ids: Vec<String> = json.search_results.into_iter().map(|x| x.id).collect();

                if ids.is_empty() {
                    invalid_codes.push(code);
                } else {
                    course_ids.push(ids);
                }
            } else if response.status() == 404 {
                return Err(UtilError::new(
                    UtilErrorType::SisuClientError(SisuErrorVariant::GenericSisuError),
                    "Course ids not found".to_string(),
                    None,
                ));
            } else {
                return Err(UtilError::new(
                    UtilErrorType::SisuClientError(SisuErrorVariant::GenericSisuError),
                    "Something went wrong when fetching course ids".to_string(),
                    None,
                ));
            }
        }

        if !invalid_codes.is_empty() {
            return Err(UtilError::new(
                UtilErrorType::SisuClientError(SisuErrorVariant::InvalidCourseCode),
                format!("No data found with codes: {invalid_codes:?}"),
                None,
            ));
        }
        Ok(course_ids)
    }

    pub async fn get_course_info(
        is_mock_sisu: bool,
        base_url: &String,
        course_codes: Vec<Vec<String>>,
    ) -> UtilResult<Vec<SisuCourseInfoElement>> {
        let mut data_vec: Vec<SisuCourseInfoElement> = vec![];
        for code in course_codes {
            if let Some(first) = code.first() {
                let url = if is_mock_sisu {
                    format!("{base_url}/api/v0/mock-sisu/kori/api/course-units/{first}")
                } else {
                    format!("https://sisu.helsinki.fi/kori/api/course-units/v1/{first}")
                };

                let response = REQWEST_CLIENT
                    .get(url)
                    .header("Content-Type", "application/json")
                    .send()
                    .await
                    .map_err(|e| {
                        util_err!(
                            SisuClientError(SisuErrorVariant::GenericSisuError),
                            "Request to Sisu failed",
                            e
                        )
                    })?;

                if response.status().is_success() {
                    let json: SisuCourseInfoElement =
                        serde_json::from_str(&response.text().await.unwrap_or("{}".to_string()))?;
                    data_vec.push(json);
                } else if response.status() == 404 {
                    return Err(UtilError::new(
                        UtilErrorType::SisuClientError(SisuErrorVariant::GenericSisuError),
                        "Course info not found".to_string(),
                        None,
                    ));
                } else {
                    return Err(UtilError::new(
                        UtilErrorType::SisuClientError(SisuErrorVariant::GenericSisuError),
                        "Something went wrong when fetching course info".to_string(),
                        None,
                    ));
                }
            } else {
                return Err(UtilError::new(
                    UtilErrorType::SisuClientError(SisuErrorVariant::GenericSisuError),
                    "No courses found with course code".to_string(),
                    None,
                ));
            }
        }
        Ok(data_vec)
    }
    pub fn parse_course_info(
        course_info: Vec<SisuCourseInfoElement>,
        course_language: String,
    ) -> HashMap<String, SisuDescriptions> {
        let mut course_desc: HashMap<String, SisuDescriptions> = HashMap::new();

        for module in course_info {
            let outcome = module
                .outcomes
                .and_then(|x| x.choose_language(&course_language).to_owned());
            let content = module
                .content
                .and_then(|x| x.choose_language(&course_language).to_owned());
            let preq = module
                .prerequisites
                .and_then(|x| x.choose_language(&course_language).to_owned());
            let material = module
                .learning_material
                .and_then(|x| x.choose_language(&course_language).to_owned());

            let add = module
                .additional
                .and_then(|x| x.choose_language(&course_language).to_owned());

            let descriptions = SisuDescriptions {
                outcomes: outcome,
                content,
                prerequisites: preq,
                learning_material: material,
                additional: add,
            };
            course_desc.insert(module.code, descriptions);
        }
        course_desc
    }
}
