use crate::{
    cache::Cache, error::util_error::SisuErrorVariant, prelude::*,
    url_encoding::percent_encode_component,
};

#[derive(Debug, Clone)]
pub struct SisuClient {
    base_url: String,
}

use chrono::NaiveDate;
use headless_lms_base::config::bool_env_false_by_default;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use std::time::Duration;
use std::{cmp::Ordering, collections::HashMap, collections::HashSet};
use utoipa::ToSchema;
pub type SisuCourseInfo = Vec<SisuCourseInfoElement>;
use url::{ParseError, Url};

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
    #[serde(default)]
    pub responsibility_infos: Option<Vec<ResponsibilityInfo>>,
}

/// One responsible-person entry on a Sisu course unit or course unit realisation. Sisu only
/// links the person by id; [SisuClient::get_course_contacts] resolves it.
#[derive(Serialize, Deserialize, ToSchema, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResponsibilityInfo {
    pub role_urn: String,
    pub person_id: Option<String>,
    pub text: Option<Additional>,
    #[serde(default)]
    pub validity_period: Option<SisuCourseInfoValidityPeriod>,
}

/// A staff member from Sisu's public person API. Holds work contact details only.
#[derive(Serialize, Deserialize, ToSchema, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SisuPerson {
    pub id: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email_address: Option<String>,
    #[serde(default)]
    pub titles: Vec<Additional>,
}

/// Who to contact about a course, as Sisu lists them today.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SisuCourseContacts {
    pub course_code: String,
    pub contacts: Vec<SisuCourseContact>,
    /// The responsible organisations of the course unit, e.g. a degree programme: the next
    /// place to ask when no person is listed.
    pub responsible_organisations: Vec<String>,
}

/// A person, or a free-text contact note, responsible for a course in Sisu.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SisuCourseContact {
    pub name: Option<String>,
    /// Last segment of the Sisu role urn, e.g. `responsible-teacher`, `teacher`,
    /// `administrative-person` or `contact-info`.
    pub role: String,
    pub titles: Vec<String>,
    pub email: Option<String>,
    pub note: Option<String>,
    pub source: SisuContactSource,
}

/// Where in Sisu a contact is listed: on the course unit itself, or on one of its current
/// course unit realisations (an implementation of the course with its own teachers).
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SisuContactSource {
    CourseUnit,
    Realisation {
        realisation_name: Option<String>,
        start_date: Option<String>,
        end_date: Option<String>,
    },
}

#[derive(Serialize, Deserialize, ToSchema, Debug, Clone)]
pub struct Additional {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub fi: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub en: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sv: Option<String>,
}

static STRIP_HTML_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"<[^>]*>").expect("invalid regex"));

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

        let max_length = vec
            .iter()
            .map(|n| {
                let value = &n.1;
                if let Some(value) = value {
                    let cleaned = STRIP_HTML_REGEX.replace_all(value, "");
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
                let cleaned = STRIP_HTML_REGEX.replace_all(text, "");
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
    /// English, else Finnish, else Swedish.
    pub fn preferring_english(&self) -> Option<String> {
        [&self.en, &self.fi, &self.sv]
            .into_iter()
            .flatten()
            .find(|text| !text.trim().is_empty())
            .cloned()
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
    pub min: Option<f32>,
    pub max: Option<f32>,
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
    pub share: f64,
    pub validity_period: Option<OrganisationValidityPeriod>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct OrganisationValidityPeriod {}

#[derive(Serialize, Deserialize, ToSchema, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SisuCourseInfoValidityPeriod {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: String,
    #[serde(default)]
    pub code: Option<String>,
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

const TIMEOUT_DURATION: Duration = Duration::from_secs(60);

/// Sisu staff data changes rarely; this keeps repeated support questions from re-fetching it.
const COURSE_CONTACTS_CACHE_TTL: Duration = Duration::from_secs(3 * 60 * 60);

/// The parts of a Sisu course unit version that say who is responsible for it. Kept separate
/// from [SisuCourseInfoElement] so an odd field on an old version cannot break the lookup.
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct CourseUnitResponsibilities {
    code: String,
    validity_period: Option<SisuCourseInfoValidityPeriod>,
    #[serde(default)]
    responsibility_infos: Vec<ResponsibilityInfo>,
    #[serde(default)]
    organisations: Vec<CourseUnitOrganisation>,
    #[serde(default)]
    completion_methods: Vec<CompletionMethodAssessmentItems>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct CourseUnitOrganisation {
    organisation_id: Option<String>,
    role_urn: String,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct CompletionMethodAssessmentItems {
    #[serde(default)]
    assessment_item_ids: Vec<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct RealisationResponsibilities {
    id: String,
    name: Option<Additional>,
    activity_period: Option<SisuCourseInfoValidityPeriod>,
    flow_state: Option<String>,
    #[serde(default)]
    responsibility_infos: Vec<ResponsibilityInfo>,
}

#[derive(Deserialize, Debug)]
struct SisuOrganisation {
    name: Option<Additional>,
}

const RESPONSIBLE_ORGANISATION_ROLE_URN: &str =
    "urn:code:organisation-role:responsible-organisation";

/// Whether `today` falls in a Sisu period. Sisu end dates are exclusive and either bound may
/// be missing.
fn period_contains(period: Option<&SisuCourseInfoValidityPeriod>, today: NaiveDate) -> bool {
    let Some(period) = period else {
        return true;
    };
    let starts_by_today = parse_sisu_date(period.start_date.as_deref()).is_none_or(|d| d <= today);
    let ends_after_today = parse_sisu_date(period.end_date.as_deref()).is_none_or(|d| today < d);
    starts_by_today && ends_after_today
}

fn parse_sisu_date(date: Option<&str>) -> Option<NaiveDate> {
    date.and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
}

fn start_date(period: Option<&SisuCourseInfoValidityPeriod>) -> Option<NaiveDate> {
    parse_sisu_date(period.and_then(|p| p.start_date.as_deref()))
}

impl SisuClient {
    fn get_url(&self) -> Result<Url, ParseError> {
        let base_url = &self.base_url;
        let is_mock_sisu = bool_env_false_by_default("USE_MOCK_SISU_ENDPOINT");
        if is_mock_sisu {
            let mock_path = Url::parse(base_url.as_str())?;
            mock_path.join("/api/v0/mock-sisu/")
        } else {
            Url::parse("https://sisu.helsinki.fi/kori/api/")
        }
    }

    pub fn new(base_url: String) -> UtilResult<Self> {
        if base_url.trim().is_empty() {
            return Err(UtilError::new(
                UtilErrorType::Other,
                "BASE_URL cannot be empty".to_string(),
                None,
            ));
        }
        Ok(Self { base_url })
    }

    async fn get_request_sisu(&self, path: String) -> Result<reqwest::Response, UtilError> {
        let base_url = Self::get_url(self)?;
        let url = base_url.join(path.as_str())?;
        let builder = REQWEST_CLIENT.get(url).timeout(TIMEOUT_DURATION);

        builder.send().await.map_err(|e| {
            util_err!(
                SisuClientError(SisuErrorVariant::GenericSisuError),
                "Request to Sisu failed",
                e
            )
        })
    }

    pub async fn get_course_ids(
        &self,
        course_modules: Vec<String>,
    ) -> UtilResult<Vec<Vec<String>>> {
        let course_codes = course_modules;
        let mut course_ids: Vec<Vec<String>> = vec![];
        let mut invalid_codes: Vec<String> = vec![];
        for code in course_codes {
            let path = format!(
                "course-unit-search?codeQuery={code}&validity=ALL&returnAllGroupVersions=true"
            );
            let response = self.get_request_sisu(path).await?;

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
                return Err(util_err!(
                    SisuClientError(SisuErrorVariant::SisuResourceNotFound),
                    "Course ids not found".to_string()
                ));
            } else {
                return Err(util_err!(
                    SisuClientError(SisuErrorVariant::GenericSisuError),
                    "Something went wrong when fetching course ids".to_string()
                ));
            }
        }

        if !invalid_codes.is_empty() {
            return Err(util_err!(
                SisuClientError(SisuErrorVariant::InvalidCourseCode),
                format!("No data found with codes: {invalid_codes:?}")
            ));
        }
        Ok(course_ids)
    }

    pub async fn get_course_info(
        &self,
        course_ids: Vec<Vec<String>>,
    ) -> UtilResult<Vec<SisuCourseInfoElement>> {
        let mut data_vec: Vec<SisuCourseInfoElement> = vec![];
        for id in course_ids {
            if let Some(first) = id.first() {
                let path = format!("course-units/v1/{first}");
                let response = self.get_request_sisu(path).await?;

                if response.status().is_success() {
                    let json: SisuCourseInfoElement =
                        serde_json::from_str(&response.text().await.unwrap_or("{}".to_string()))?;
                    data_vec.push(json);
                } else if response.status() == 404 {
                    return Err(util_err!(
                        SisuClientError(SisuErrorVariant::SisuResourceNotFound),
                        "Course info not found".to_string()
                    ));
                } else {
                    return Err(util_err!(
                        SisuClientError(SisuErrorVariant::GenericSisuError),
                        "Something went wrong when fetching course info".to_string()
                    ));
                }
            } else {
                return Err(util_err!(
                    SisuClientError(SisuErrorVariant::SisuResourceNotFound),
                    "No courses found with course id".to_string()
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

    /// Who Sisu lists as responsible for a UH course code today: the people on the course unit
    /// version valid today, then the teachers of its ongoing realisations (or the next one when
    /// none is ongoing), each person once, plus the responsible organisations. Errors when the
    /// code is unknown to Sisu or Sisu fails; an empty contact list is a valid answer. Answers
    /// are cached for a few hours.
    pub async fn get_course_contacts(
        &self,
        cache: &Cache,
        uh_course_code: &str,
    ) -> UtilResult<SisuCourseContacts> {
        let cache_key = format!(
            "sisu-course-contacts:{}",
            uh_course_code.trim().to_uppercase()
        );
        cache
            .get_or_set(cache_key, COURSE_CONTACTS_CACHE_TTL, || {
                self.fetch_course_contacts(uh_course_code)
            })
            .await
    }

    async fn fetch_course_contacts(&self, uh_course_code: &str) -> UtilResult<SisuCourseContacts> {
        let today = chrono::Utc::now().date_naive();
        let course_unit = self.get_current_course_unit(uh_course_code, today).await?;

        let mut contacts = Vec::new();
        let mut seen_person_ids = HashSet::new();
        self.push_contacts(
            &mut contacts,
            &mut seen_person_ids,
            &course_unit.responsibility_infos,
            SisuContactSource::CourseUnit,
            today,
        )
        .await?;

        let mut assessment_item_ids: Vec<String> = course_unit
            .completion_methods
            .iter()
            .flat_map(|method| method.assessment_item_ids.iter().cloned())
            .collect();
        assessment_item_ids.sort();
        assessment_item_ids.dedup();
        for realisation in self
            .get_current_realisations(&assessment_item_ids, today)
            .await?
        {
            let source = SisuContactSource::Realisation {
                realisation_name: realisation
                    .name
                    .as_ref()
                    .and_then(Additional::preferring_english),
                start_date: realisation
                    .activity_period
                    .as_ref()
                    .and_then(|p| p.start_date.clone()),
                end_date: realisation
                    .activity_period
                    .as_ref()
                    .and_then(|p| p.end_date.clone()),
            };
            self.push_contacts(
                &mut contacts,
                &mut seen_person_ids,
                &realisation.responsibility_infos,
                source,
                today,
            )
            .await?;
        }

        let mut responsible_organisations = Vec::new();
        for organisation in course_unit
            .organisations
            .iter()
            .filter(|o| o.role_urn == RESPONSIBLE_ORGANISATION_ROLE_URN)
        {
            let Some(organisation_id) = &organisation.organisation_id else {
                continue;
            };
            if let Some(name) = self.get_organisation_name(organisation_id).await? {
                responsible_organisations.push(name);
            }
        }

        Ok(SisuCourseContacts {
            course_code: course_unit.code,
            contacts,
            responsible_organisations,
        })
    }

    /// The latest-starting version of the course unit valid today, else the one that started last.
    async fn get_current_course_unit(
        &self,
        uh_course_code: &str,
        today: NaiveDate,
    ) -> UtilResult<CourseUnitResponsibilities> {
        let path = format!(
            "course-unit-search?codeQuery={}&validity=ALL&returnAllGroupVersions=true",
            percent_encode_component(uh_course_code)
        );
        let search: CourseUnitSearchResults = self.get_sisu_json(path).await?.ok_or_else(|| {
            util_err!(
                SisuClientError(SisuErrorVariant::InvalidCourseCode),
                format!("No course unit found with code {uh_course_code}")
            )
        })?;
        // The code query also matches longer codes that share the prefix.
        let ids = search.search_results.into_iter().filter(|result| {
            result
                .code
                .as_deref()
                .is_none_or(|code| code.eq_ignore_ascii_case(uh_course_code))
        });

        let mut versions = Vec::new();
        for result in ids {
            let version: Option<CourseUnitResponsibilities> = self
                .get_sisu_json(format!(
                    "course-units/v1/{}",
                    percent_encode_component(&result.id)
                ))
                .await?;
            versions.extend(version.filter(|v| v.code.eq_ignore_ascii_case(uh_course_code)));
        }

        // Versions without an end date overlap, so the latest start among the valid ones wins.
        let current = versions
            .iter()
            .enumerate()
            .max_by_key(|(_, v)| {
                (
                    period_contains(v.validity_period.as_ref(), today),
                    start_date(v.validity_period.as_ref()),
                )
            })
            .map(|(index, _)| index);
        match current {
            Some(index) => Ok(versions.swap_remove(index)),
            None => Err(util_err!(
                SisuClientError(SisuErrorVariant::InvalidCourseCode),
                format!("No course unit found with code {uh_course_code}")
            )),
        }
    }

    /// Published realisations of the assessment items that are ongoing today, or the one
    /// starting next when none is.
    async fn get_current_realisations(
        &self,
        assessment_item_ids: &[String],
        today: NaiveDate,
    ) -> UtilResult<Vec<RealisationResponsibilities>> {
        let mut realisations: Vec<RealisationResponsibilities> = Vec::new();
        for assessment_item_id in assessment_item_ids {
            let path = format!(
                "course-unit-realisations-by-assessment-item-id?assessmentItemId={}&activityStatus=ONGOING_AND_FUTURE",
                percent_encode_component(assessment_item_id)
            );
            let found: Vec<RealisationResponsibilities> =
                self.get_sisu_json(path).await?.unwrap_or_default();
            for realisation in found {
                if realisation.flow_state.as_deref() == Some("PUBLISHED")
                    && !realisations.iter().any(|r| r.id == realisation.id)
                {
                    realisations.push(realisation);
                }
            }
        }

        if realisations
            .iter()
            .any(|r| period_contains(r.activity_period.as_ref(), today))
        {
            realisations.retain(|r| period_contains(r.activity_period.as_ref(), today));
        } else {
            realisations.sort_by_key(|r| start_date(r.activity_period.as_ref()));
            realisations.truncate(1);
        }
        Ok(realisations)
    }

    async fn push_contacts(
        &self,
        contacts: &mut Vec<SisuCourseContact>,
        seen_person_ids: &mut HashSet<String>,
        responsibility_infos: &[ResponsibilityInfo],
        source: SisuContactSource,
        today: NaiveDate,
    ) -> UtilResult<()> {
        for info in responsibility_infos {
            if !period_contains(info.validity_period.as_ref(), today) {
                continue;
            }
            let role = info
                .role_urn
                .rsplit(':')
                .next()
                .unwrap_or(&info.role_urn)
                .to_string();
            let note = info
                .text
                .as_ref()
                .and_then(Additional::preferring_english)
                .map(|text| STRIP_HTML_REGEX.replace_all(&text, "").trim().to_string())
                // Sisu requires some text on these, so "-" is a common placeholder.
                .filter(|text| text.chars().any(char::is_alphanumeric));
            let person = match &info.person_id {
                Some(person_id) => {
                    if seen_person_ids.contains(person_id) {
                        continue;
                    }
                    self.get_person(person_id).await?
                }
                None => None,
            };
            if person.is_none() && note.is_none() {
                continue;
            }
            if let Some(person_id) = &info.person_id {
                seen_person_ids.insert(person_id.clone());
            }
            contacts.push(SisuCourseContact {
                name: person.as_ref().and_then(|p| {
                    let full_name = [p.first_name.as_deref(), p.last_name.as_deref()]
                        .into_iter()
                        .flatten()
                        .collect::<Vec<_>>()
                        .join(" ");
                    (!full_name.is_empty()).then_some(full_name)
                }),
                role,
                titles: person
                    .as_ref()
                    .map(|p| {
                        p.titles
                            .iter()
                            .filter_map(Additional::preferring_english)
                            .collect()
                    })
                    .unwrap_or_default(),
                email: person.and_then(|p| p.email_address),
                note,
                source: source.clone(),
            });
        }
        Ok(())
    }

    /// `None` when Sisu no longer has the person.
    async fn get_person(&self, person_id: &str) -> UtilResult<Option<SisuPerson>> {
        self.get_sisu_json(format!(
            "persons/v1/{}",
            percent_encode_component(person_id)
        ))
        .await
    }

    async fn get_organisation_name(&self, organisation_id: &str) -> UtilResult<Option<String>> {
        let organisation: Option<SisuOrganisation> = self
            .get_sisu_json(format!(
                "organisations/{}",
                percent_encode_component(organisation_id)
            ))
            .await?;
        Ok(organisation
            .and_then(|o| o.name)
            .and_then(|name| name.preferring_english()))
    }

    /// GETs a Sisu path as JSON; `None` on 404 or 400, which Sisu answers for unknown ids.
    async fn get_sisu_json<T: serde::de::DeserializeOwned>(
        &self,
        path: String,
    ) -> UtilResult<Option<T>> {
        let response = self.get_request_sisu(path).await?;
        let status = response.status();
        if status == reqwest::StatusCode::NOT_FOUND || status == reqwest::StatusCode::BAD_REQUEST {
            return Ok(None);
        }
        if !status.is_success() {
            return Err(util_err!(
                SisuClientError(SisuErrorVariant::GenericSisuError),
                format!("Sisu answered {status}")
            ));
        }
        let body = response.text().await.map_err(|e| {
            util_err!(
                SisuClientError(SisuErrorVariant::GenericSisuError),
                "Reading a Sisu response failed",
                e
            )
        })?;
        Ok(Some(serde_json::from_str(&body)?))
    }

    pub fn mock_for_test() -> Self {
        Self {
            base_url: String::from("mock-base-url"),
        }
    }
}
