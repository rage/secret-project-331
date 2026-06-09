use crate::prelude::*;
pub struct SisuClient {}

use utoipa::ToSchema;

use serde::{Deserialize, Serialize};
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
    outcomes: Option<serde_json::Value>,
    prerequisites: Option<Additional>,
    content: Option<serde_json::Value>,
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
    fi: Option<String>,
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

impl SisuClient {
    pub async fn get_course_codes(course_modules: Vec<String>) -> UtilResult<Vec<Vec<String>>> {
        let course_codes = course_modules;
        //let course_codes = vec!["TKT21036", "TKT21037", "TKT21038"];
        let mut id_vec: Vec<Vec<String>> = vec![];
        //dbg!(&course_codes);
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
                let codes: Vec<String> = json.search_results.iter().map(|x| x.id.clone()).collect();
                id_vec.push(codes);
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
        //dbg!(&id_vec);
        Ok(id_vec)
    }

    pub async fn get_course_info(
        course_codes: Vec<Vec<String>>,
    ) -> UtilResult<Vec<SisuCourseInfoElement>> {
        //let course_codes = course_codes;

        let mut data_vec: Vec<SisuCourseInfoElement> = vec![];

        let course_codes = vec![
            vec!["otm-bf6ac455-c74b-48a9-8079-1e26272d8594"],
            vec!["otm-a93149ca-6bc1-4abe-b18e-ecaaa673deb9"],
            vec!["otm-9a150d40-7a51-46db-a926-39d8e7d19141"],
        ];

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
                dbg!("{json:?}");
                data_vec.push(json);
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
        Ok(data_vec)

        //dbg!(&id_vec);
    }
}
