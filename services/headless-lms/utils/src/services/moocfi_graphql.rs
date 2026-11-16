//! Client for the old mooc.fi platform's GraphQL API, which holds per-user course progress.

use std::collections::{BTreeMap, HashMap};
use std::time::Duration;

use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::http::{REQWEST_CLIENT, web_link};
use crate::prelude::*;

const MOOCFI_GRAPHQL_URL: &str = "https://www.mooc.fi/api";

/// Field names follow the mooc.fi backend's Nexus schema (`backend/schema/User/model.ts` in
/// rage/mooc.fi). `user(upstream_id:)` is admin-only, which the TMC admin token satisfies.
const USER_COURSE_PROGRESS_QUERY: &str = r#"
query ($upstreamId: Int) {
  user(upstream_id: $upstreamId) {
    user_course_progresses {
      n_points
      max_points
      course {
        ...CourseFields
      }
    }
    exercise_counts: user_course_progresses {
      course {
        id
      }
      exercise_progress {
        exercise_count
        exercises_attempted_count
      }
    }
    completions {
      course {
        ...CourseFields
      }
    }
  }
}

fragment CourseFields on Course {
  id
  name
  course_translations {
    language
    name
    link
  }
}"#;

/// A course the user has progress or a completion on in the old mooc.fi.
#[derive(Debug, Clone, PartialEq)]
pub struct MoocfiCourseProgress {
    pub course_id: Uuid,
    pub name: String,
    pub completed: bool,
    pub points: Option<f64>,
    pub max_points: Option<f64>,
    /// Where the course's material is, per language version that has a usable link.
    pub material_links: Vec<MoocfiMaterialLink>,
    /// `None` for a course known only from a completion, which has no progress row.
    pub exercise_progress: Option<MoocfiExerciseProgress>,
}

/// How many of a course's exercises the user has attempted on the old version of the platform.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MoocfiExerciseProgress {
    pub exercise_count: i32,
    pub attempted_count: i32,
}

/// A link to one language version of a course's material on the old version of the platform.
#[derive(Debug, Clone, PartialEq)]
pub struct MoocfiMaterialLink {
    /// As mooc.fi spells it, e.g. `fi_FI`.
    pub language: String,
    /// The course's name in this language version.
    pub course_name: String,
    pub url: String,
}

#[derive(Deserialize)]
struct GraphQlResponse {
    data: Option<ResponseData>,
    #[serde(default)]
    errors: Vec<GraphQlError>,
}

#[derive(Deserialize)]
struct GraphQlError {
    message: String,
}

#[derive(Deserialize)]
struct ResponseData {
    user: Option<MoocfiUser>,
}

#[derive(Deserialize)]
struct MoocfiUser {
    user_course_progresses: Vec<UserCourseProgress>,
    /// Asked for apart from `user_course_progresses` because mooc.fi throws on `exercise_progress`
    /// for a progress row without a course, which nulls the whole list it is in.
    exercise_counts: Option<Vec<ExerciseCountRow>>,
    completions: Vec<Completion>,
}

#[derive(Deserialize)]
struct UserCourseProgress {
    n_points: Option<f64>,
    max_points: Option<f64>,
    course: Option<Course>,
}

#[derive(Deserialize)]
struct ExerciseCountRow {
    course: Option<CourseId>,
    exercise_progress: Option<ExerciseProgress>,
}

#[derive(Deserialize)]
struct CourseId {
    id: Uuid,
}

/// Both counts are nullable in mooc.fi's schema, though its resolver always sets them.
#[derive(Deserialize)]
struct ExerciseProgress {
    exercise_count: Option<i32>,
    exercises_attempted_count: Option<i32>,
}

impl ExerciseProgress {
    fn counts(&self) -> Option<MoocfiExerciseProgress> {
        Some(MoocfiExerciseProgress {
            exercise_count: self.exercise_count?,
            attempted_count: self.exercises_attempted_count?,
        })
    }
}

#[derive(Deserialize)]
struct Completion {
    course: Option<Course>,
}

#[derive(Deserialize)]
struct Course {
    id: Uuid,
    name: String,
    /// mooc.fi does not publish its generated schema, so a null list is not ruled out.
    course_translations: Option<Vec<CourseTranslation>>,
}

#[derive(Deserialize)]
struct CourseTranslation {
    language: String,
    name: String,
    link: Option<String>,
}

impl Course {
    fn into_progress(
        self,
        points: Option<f64>,
        max_points: Option<f64>,
        exercise_progress: Option<MoocfiExerciseProgress>,
    ) -> MoocfiCourseProgress {
        let material_links = self
            .course_translations
            .unwrap_or_default()
            .into_iter()
            .filter_map(|translation| {
                Some(MoocfiMaterialLink {
                    url: web_link(translation.link.as_deref()?)?,
                    language: translation.language,
                    course_name: translation.name,
                })
            })
            .collect();
        MoocfiCourseProgress {
            course_id: self.id,
            name: self.name,
            completed: false,
            points,
            max_points,
            material_links,
            exercise_progress,
        }
    }
}

/// Every course the user behind `upstream_id` (their tmc.mooc.fi id) has progress or a completion
/// on in the old mooc.fi. A user mooc.fi does not know has none.
///
/// `access_token` must be a TMC admin token.
pub async fn get_user_course_progress(
    access_token: &SecretString,
    upstream_id: i32,
    timeout: Duration,
) -> UtilResult<Vec<MoocfiCourseProgress>> {
    let response = REQWEST_CLIENT
        .post(MOOCFI_GRAPHQL_URL)
        .timeout(timeout)
        .bearer_auth(access_token.expose_secret())
        .json(&json!({
            "query": USER_COURSE_PROGRESS_QUERY,
            "variables": { "upstreamId": upstream_id },
        }))
        .send()
        .await?
        .error_for_status()?;
    let body = response.text().await?;
    parse_user_course_progress(&body)
}

fn parse_user_course_progress(body: &str) -> UtilResult<Vec<MoocfiCourseProgress>> {
    let response: GraphQlResponse = serde_json::from_str(body)?;
    let user = match response.data.and_then(|data| data.user) {
        Some(user) => user,
        // The resolver throws this rather than returning null for an unknown user.
        None if response
            .errors
            .iter()
            .any(|error| error.message == "user not found") =>
        {
            return Ok(Vec::new());
        }
        None => {
            let messages: Vec<&str> = response.errors.iter().map(|e| e.message.as_str()).collect();
            return Err(UtilError::new(
                UtilErrorType::Other,
                format!("mooc.fi returned no user: {}", messages.join("; ")),
                None,
            ));
        }
    };

    let exercise_counts: HashMap<Uuid, MoocfiExerciseProgress> = user
        .exercise_counts
        .unwrap_or_default()
        .into_iter()
        .filter_map(|row| Some((row.course?.id, row.exercise_progress?.counts()?)))
        .collect();
    let mut courses: BTreeMap<Uuid, MoocfiCourseProgress> = BTreeMap::new();
    for progress in user.user_course_progresses {
        let Some(course) = progress.course else {
            continue;
        };
        let course_exercise_counts = exercise_counts.get(&course.id).copied();
        courses.insert(
            course.id,
            course.into_progress(
                progress.n_points,
                progress.max_points,
                course_exercise_counts,
            ),
        );
    }
    for course in user.completions.into_iter().filter_map(|c| c.course) {
        courses
            .entry(course.id)
            .or_insert_with(|| course.into_progress(None, None, None))
            .completed = true;
    }

    let mut courses: Vec<MoocfiCourseProgress> = courses.into_values().collect();
    courses.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(courses)
}

#[cfg(test)]
mod tests {
    use super::*;

    const COURSE_A: &str = "00000000-0000-0000-0000-00000000000a";
    const COURSE_B: &str = "00000000-0000-0000-0000-00000000000b";

    #[test]
    fn merges_progress_and_completions_per_course() {
        let body = json!({
            "data": { "user": {
                "user_course_progresses": [
                    { "n_points": 12.5, "max_points": 20.0, "course": { "id": COURSE_B, "name": "B", "course_translations": [
                        { "language": "fi_FI", "name": "B fi", "link": " https://b.mooc.fi " },
                        { "language": "en_US", "name": "B en", "link": "javascript:alert(1)" },
                        { "language": "sv_SE", "name": "B sv", "link": null }
                    ] } },
                    { "n_points": null, "max_points": null, "course": null }
                ],
                "exercise_counts": [
                    { "course": { "id": COURSE_B }, "exercise_progress": { "exercise_count": 10, "exercises_attempted_count": 4 } }
                ],
                "completions": [
                    { "course": { "id": COURSE_B, "name": "B" } },
                    { "course": { "id": COURSE_A, "name": "A" } }
                ]
            }}
        })
        .to_string();

        let courses = parse_user_course_progress(&body).unwrap();

        assert_eq!(
            courses,
            vec![
                MoocfiCourseProgress {
                    course_id: Uuid::parse_str(COURSE_A).unwrap(),
                    name: "A".to_string(),
                    completed: true,
                    points: None,
                    max_points: None,
                    material_links: vec![],
                    exercise_progress: None,
                },
                MoocfiCourseProgress {
                    course_id: Uuid::parse_str(COURSE_B).unwrap(),
                    name: "B".to_string(),
                    completed: true,
                    points: Some(12.5),
                    max_points: Some(20.0),
                    material_links: vec![MoocfiMaterialLink {
                        language: "fi_FI".to_string(),
                        course_name: "B fi".to_string(),
                        url: "https://b.mooc.fi".to_string(),
                    }],
                    exercise_progress: Some(MoocfiExerciseProgress {
                        exercise_count: 10,
                        attempted_count: 4,
                    }),
                },
            ]
        );
    }

    #[test]
    fn unknown_user_has_no_courses() {
        let body = json!({
            "data": { "user": null },
            "errors": [{ "message": "user not found", "extensions": { "code": "BAD_USER_INPUT" } }]
        })
        .to_string();

        assert_eq!(parse_user_course_progress(&body).unwrap(), vec![]);
    }

    #[test]
    fn other_errors_fail() {
        let body = json!({
            "data": null,
            "errors": [{ "message": "Not authorized" }]
        })
        .to_string();

        assert!(parse_user_course_progress(&body).is_err());
    }
}
