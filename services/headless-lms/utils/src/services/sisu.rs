use crate::prelude::*;
pub struct SisuClient {}

use regex::Regex;
use utoipa::ToSchema;

use serde::{Deserialize, Serialize};
use std::{cmp::Ordering, collections::HashMap};
pub type SisuCourseInfo = Vec<SisuCourseInfoElement>;

#[derive(Serialize, Deserialize, ToSchema, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SisuCourseInfoElement {
    id: String,
    university_org_ids: Vec<String>,
    group_id: String,
    credits: Credits,
    completion_methods: Vec<Option<serde_json::Value>>,
    name: Name,
    code: String,
    abbreviation: Option<String>,
    validity_period: SisuCourseInfoValidityPeriod,
    grade_scale_id: String,
    tweet_text: Option<serde_json::Value>,
    outcomes: Option<Additional>,
    prerequisites: Option<Additional>,
    content: Option<Additional>,
    additional: Option<Additional>,
    learning_material: Option<Additional>,
    literature: Vec<Option<serde_json::Value>>,
    study_level: String,
    course_unit_type: String,
    subject: Option<serde_json::Value>,
    cefr_level: Option<serde_json::Value>,
    organisations: Vec<Organisation>,
    possible_attainment_languages: Vec<String>,
    part_of_degree: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct Additional {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    fi: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    en: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    sv: Option<String>,
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
            return Ordering::Equal;
        });
        let strip_html_regex = Regex::new(r"<[^>]*>").unwrap();
        let max_length = vec
            .iter()
            .map(|n| {
                let value = &n.1;
                if let Some(value) = value {
                    let cleaned = strip_html_regex.replace_all(&value, "");
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
                let cleaned = strip_html_regex.replace_all(&text, "");
                let len = cleaned.len();
                if len < max_length / 2 {
                    return false;
                }
                return true;
            } else {
                return false;
            }
        });
        return best.and_then(|o| o.1.clone());
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
    min: Option<i64>,
    max: Option<i64>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct Name {
    en: Option<String>,
    fi: Option<String>,
    sv: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Organisation {
    organisation_id: Option<String>,
    educational_institution_urn: Option<serde_json::Value>,
    role_urn: String,
    share: i64,
    validity_period: Option<OrganisationValidityPeriod>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct OrganisationValidityPeriod {}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SisuCourseInfoValidityPeriod {
    start_date: Option<String>,
    end_date: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    id: String,
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
    pub async fn get_course_codes(course_modules: Vec<String>) -> UtilResult<Vec<Vec<String>>> {
        let course_codes = course_modules;
        //let course_codes = vec!["TKT21036", "TKT21037", "TKT21038"];
        let mut code_vec: Vec<Vec<String>> = vec![];
        for code in course_codes {
            let url = format!(
                "https://sisu.helsinki.fi/kori/api/course-unit-search?codeQuery={code}&validity=ALL&returnAllGroupVersions=true"
            );
            let response = REQWEST_CLIENT
                .get(url)
                .header("Content-Type", "application/json")
                .send()
                .await
                .map_err(|e| util_err!(Other, "Request to Sisu failed", e))?;

            if response.status().is_success() {
                let json: CourseUnitSearchResults =
                    serde_json::from_str(&response.text().await.unwrap())?;
                let codes: Vec<String> = json.search_results.into_iter().map(|x| x.id).collect();
                code_vec.push(codes);
            } else if response.status() == 404 {
                return Err(UtilError::new(
                    UtilErrorType::Other,
                    "Course codes not found".to_string(),
                    None,
                ));
            } else {
                return Err(UtilError::new(
                    UtilErrorType::Other,
                    "Something went wrong when fetching course codes".to_string(),
                    None,
                ));
            }
        }
        Ok(code_vec)
    }

    pub async fn get_course_info(
        course_codes: Vec<Vec<String>>,
    ) -> UtilResult<Vec<SisuCourseInfoElement>> {
        //let course_codes = course_codes;

        //TODO: remove
        let mut data_vec: Vec<SisuCourseInfoElement> = vec![];

        let course_codes = vec![
            vec!["otm-bf6ac455-c74b-48a9-8079-1e26272d8594"],
            vec!["otm-a93149ca-6bc1-4abe-b18e-ecaaa673deb9"],
            vec!["otm-9a150d40-7a51-46db-a926-39d8e7d19141"],
        ];

        //let course_codes = vec![vec!["otm-bf6ac455-c74b-48a9-8079-1e26272d8594"]];

        for code in course_codes {
            let last = code.last().unwrap();
            //"https://sisu.helsinki.fi/kori/api/course-units/v1/otm-a93149ca-6bc1-4abe-b18e-ecaaa673deb9"

            let url = format!("https://sisu.helsinki.fi/kori/api/course-units/v1/{last}");
            let response = REQWEST_CLIENT
                .get(url)
                .header("Content-Type", "application/json")
                .send()
                .await
                .map_err(|e| util_err!(Other, "Request to Sisu failed", e))?;

            if response.status().is_success() {
                let json: SisuCourseInfoElement =
                    serde_json::from_str(&response.text().await.unwrap())?;
                data_vec.push(json);
            } else if response.status() == 404 {
                return Err(UtilError::new(
                    UtilErrorType::Other,
                    "Course info not found".to_string(),
                    None,
                ));
            } else {
                return Err(UtilError::new(
                    UtilErrorType::Other,
                    "Something went wrong when fetching course info".to_string(),
                    None,
                ));
            }
        }
        Ok(data_vec)
    }
    pub fn parse_sisu_info(
        course_info: Vec<SisuCourseInfoElement>,
        course_language: String,
    ) -> HashMap<String, SisuDescriptions> {
        let course_language: String = String::from("fi");

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
                content: content,
                prerequisites: preq,
                learning_material: material,
                additional: add,
            };
            course_desc.insert(module.code, descriptions);
        }
        course_desc
    }
}
