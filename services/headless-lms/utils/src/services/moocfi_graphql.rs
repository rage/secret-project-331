//! Client for the old mooc.fi platform's GraphQL API, which holds per-user course progress.

use std::collections::BTreeMap;
use std::time::Duration;

use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::http::REQWEST_CLIENT;
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
        id
        name
      }
    }
    completions {
      course {
        id
        name
      }
    }
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
    completions: Vec<Completion>,
}

#[derive(Deserialize)]
struct UserCourseProgress {
    n_points: Option<f64>,
    max_points: Option<f64>,
    course: Option<Course>,
}

#[derive(Deserialize)]
struct Completion {
    course: Option<Course>,
}

#[derive(Deserialize)]
struct Course {
    id: Uuid,
    name: String,
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

    let mut courses: BTreeMap<Uuid, MoocfiCourseProgress> = BTreeMap::new();
    for progress in user.user_course_progresses {
        let Some(course) = progress.course else {
            continue;
        };
        courses.insert(
            course.id,
            MoocfiCourseProgress {
                course_id: course.id,
                name: course.name,
                completed: false,
                points: progress.n_points,
                max_points: progress.max_points,
            },
        );
    }
    for course in user.completions.into_iter().filter_map(|c| c.course) {
        courses
            .entry(course.id)
            .or_insert_with(|| MoocfiCourseProgress {
                course_id: course.id,
                name: course.name,
                completed: false,
                points: None,
                max_points: None,
            })
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
                    { "n_points": 12.5, "max_points": 20.0, "course": { "id": COURSE_B, "name": "B" } },
                    { "n_points": null, "max_points": null, "course": null }
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
                },
                MoocfiCourseProgress {
                    course_id: Uuid::parse_str(COURSE_B).unwrap(),
                    name: "B".to_string(),
                    completed: true,
                    points: Some(12.5),
                    max_points: Some(20.0),
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
