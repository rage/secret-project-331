use crate::prelude::*;
pub struct SisuClient {}

use serde::{Deserialize, Serialize};
pub type SisuCourseInfo = Vec<SisuCourseInfoElement>;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SisuCourseInfoElement {
    #[serde(rename = "course_unit_id")]
    course_unit_id: String,
    #[serde(rename = "course_unit_group_id")]
    course_unit_group_id: String,
    code: String,
    name: SisuCourseInfoName,
    validity_period: SisuCourseInfoValidityPeriod,
    curriculum_period_ids: Vec<String>,
    descriptions: SisuCourseInfoDescriptions,
    responsibility_infos: Vec<SisuCourseInfoResponsibilityInfo>,
    grade_scale_id: String,
    possible_attainment_languages: Vec<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SisuCourseInfoDescriptions {
    outcomes: Option<serde_json::Value>,
    content: Option<serde_json::Value>,
    prerequisites: SisuCourseInfoAdditional,
    additional: SisuCourseInfoAdditional,
    learning_material: SisuCourseInfoAdditional,
    literature: Vec<Option<serde_json::Value>>,
}

#[derive(Serialize, Deserialize)]
pub struct SisuCourseInfoAdditional {
    fi: String,
}

#[derive(Serialize, Deserialize)]
pub struct SisuCourseInfoName {
    en: String,
    fi: String,
    sv: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SisuCourseInfoResponsibilityInfo {
    text: Option<serde_json::Value>,
    person_id: String,
    role_urn: String,
    validity_period: SisuCourseInfoResponsibilityInfoValidityPeriod,
}

#[derive(Serialize, Deserialize)]
pub struct SisuCourseInfoResponsibilityInfoValidityPeriod {}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SisuCourseInfoValidityPeriod {
    start_date: String,
    end_date: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    id: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseUnitSearchResults {
    pub search_results: Vec<SearchResult>,
}

impl SisuClient {
    pub async fn get_course_code() -> UtilResult<Vec<String>> {
        let url = "https://sisu.helsinki.fi/kori/api/course-unit-search?codeQuery=TKT10003&validity=ALL&returnAllGroupVersions=true";
        let response = REQWEST_CLIENT
            .get(url)
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(|e| util_err!(Other, "Request to Sisu failed", e))?;

        if response.status().is_success() {
            let json: CourseUnitSearchResults =
                serde_json::from_str(&response.text().await.unwrap())?;
            let codes: Vec<String> = json.search_results.iter().map(|x| x.id.clone()).collect();
            Ok(codes)
        } else if response.status() == 404 {
            return Err(UtilError::new(
                UtilErrorType::Other,
                "Course codes not found".to_string(),
                None,
            ));
        } else {
            return Err(UtilError::new(
                UtilErrorType::Other,
                "Something went wrong".to_string(),
                None,
            ));
        }
    }
}
