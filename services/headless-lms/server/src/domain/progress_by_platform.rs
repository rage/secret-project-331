//! The courses a user would lose on each platform their account reaches, shown before account
//! deletion.

use std::collections::HashMap;
use std::time::Duration;

use headless_lms_utils::services::moocfi::{self, MoocfiCourseProgress};
use headless_lms_utils::services::tmc::{TmcClient, TmcCourseProgress};
use utoipa::ToSchema;

use crate::prelude::*;

/// Short enough that the deletion dialog does not hang on a slow upstream.
const UPSTREAM_TIMEOUT: Duration = Duration::from_secs(10);

/// The user's courses grouped by platform. Every course appears once: a tmc.mooc.fi course that
/// reports to an old mooc.fi course is listed under that mooc.fi course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ProgressByPlatform {
    pub courses_mooc_fi: Vec<CoursesMoocFiCourseProgress>,
    pub mooc_fi_status: ExternalPlatformStatus,
    pub mooc_fi: Vec<MoocFiCourseProgress>,
    pub tmc_mooc_fi_status: ExternalPlatformStatus,
    pub tmc_mooc_fi: Vec<TmcMoocFiCourseProgress>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExternalPlatformStatus {
    Loaded,
    /// The account has no tmc.mooc.fi id, or the server runs in test mode.
    NotQueried,
    /// The platform failed or timed out; the user may still have progress there.
    Unavailable,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct CoursesMoocFiCourseProgress {
    pub course_id: Uuid,
    pub name: String,
    /// Modules with a passed completion.
    pub completed_modules: u32,
    pub total_modules: u32,
    pub points: f32,
    /// `None` when the course has no exercises.
    pub max_points: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MoocFiCourseProgress {
    pub course_id: Uuid,
    pub name: String,
    pub completed: bool,
    pub points: Option<f64>,
    pub max_points: Option<f64>,
    /// tmc.mooc.fi courses that report their progress to this one.
    pub tmc_mooc_fi_courses: Vec<TmcMoocFiCourseProgress>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct TmcMoocFiCourseProgress {
    pub name: String,
    /// Number of points awarded, not a score.
    pub awarded_points: i32,
    pub submissions: i32,
    pub last_submission_at: Option<DateTime<Utc>>,
}

impl From<TmcCourseProgress> for TmcMoocFiCourseProgress {
    fn from(course: TmcCourseProgress) -> Self {
        Self {
            name: course
                .title
                .filter(|t| !t.trim().is_empty())
                .unwrap_or(course.name),
            awarded_points: course.awarded_points,
            submissions: course.submissions,
            last_submission_at: course.last_submission_at,
        }
    }
}

/// Lists the user's courses on courses.mooc.fi, tmc.mooc.fi and the old mooc.fi. The external
/// platforms are queried concurrently, and one failing is reported in its status instead of
/// failing the whole listing.
pub async fn get_progress_by_platform(
    conn: &mut PgConnection,
    tmc_client: &TmcClient,
    user_id: Uuid,
    upstream_id: Option<i32>,
    query_external_platforms: bool,
) -> models::ModelResult<ProgressByPlatform> {
    let upstream_id = upstream_id.filter(|_| query_external_platforms);
    let tmc_progress = async {
        match upstream_id {
            Some(id) => Some(
                tmc_client
                    .get_user_course_progress(id, UPSTREAM_TIMEOUT)
                    .await,
            ),
            None => None,
        }
    };
    let moocfi_progress = async {
        match upstream_id {
            Some(id) => Some(
                moocfi::get_user_course_progress(
                    tmc_client.get_admin_access_token(),
                    id,
                    UPSTREAM_TIMEOUT,
                )
                .await,
            ),
            None => None,
        }
    };
    let (courses_mooc_fi, tmc_progress, moocfi_progress) = tokio::join!(
        get_courses_mooc_fi_progress(conn, user_id),
        tmc_progress,
        moocfi_progress
    );

    let tmc_progress = tmc_progress.map(|result| {
        result.map_err(|e| warn!("Could not list the tmc.mooc.fi courses of user {user_id}: {e}"))
    });
    let moocfi_progress = moocfi_progress.map(|result| {
        result.map_err(|e| warn!("Could not list the mooc.fi courses of user {user_id}: {e}"))
    });

    let mut progress = merge_external_progress(tmc_progress, moocfi_progress);
    progress.courses_mooc_fi = courses_mooc_fi?;
    Ok(progress)
}

async fn get_courses_mooc_fi_progress(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> models::ModelResult<Vec<CoursesMoocFiCourseProgress>> {
    let enrollments =
        models::course_instance_enrollments::get_course_enrollments_info_for_user(conn, user_id)
            .await?
            .course_enrollments;
    let course_ids: Vec<Uuid> = enrollments.iter().map(|e| e.course_id).collect();
    let progress_by_module =
        models::user_exercise_states::get_user_course_module_progress(conn, &course_ids, user_id)
            .await?;

    let mut courses: Vec<CoursesMoocFiCourseProgress> = enrollments
        .into_iter()
        .map(|enrollment| {
            let completed_modules = enrollment
                .course_modules
                .iter()
                .filter(|module| {
                    enrollment.course_module_completions.iter().any(|c| {
                        c.course_module_id == module.id && c.passed && !c.needs_to_be_reviewed
                    })
                })
                .count();
            let module_progress: Vec<_> = enrollment
                .course_modules
                .iter()
                .filter_map(|module| progress_by_module.get(&module.id))
                .collect();
            let max_points = module_progress
                .iter()
                .filter_map(|p| p.score_maximum)
                .reduce(|a, b| a + b);
            CoursesMoocFiCourseProgress {
                course_id: enrollment.course_id,
                name: enrollment.course.name,
                completed_modules: completed_modules as u32,
                total_modules: enrollment.course_modules.len() as u32,
                points: module_progress.iter().map(|p| p.score_given).sum(),
                max_points,
            }
        })
        .collect();
    courses.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(courses)
}

/// `None` means the platform was not queried, `Err` that it failed.
fn merge_external_progress(
    tmc_progress: Option<Result<Vec<TmcCourseProgress>, ()>>,
    moocfi_progress: Option<Result<Vec<MoocfiCourseProgress>, ()>>,
) -> ProgressByPlatform {
    let tmc_mooc_fi_status = external_platform_status(&tmc_progress);
    let mooc_fi_status = external_platform_status(&moocfi_progress);
    let mut tmc_courses = tmc_progress.and_then(Result::ok).unwrap_or_default();
    let moocfi_courses = moocfi_progress.and_then(Result::ok).unwrap_or_default();

    let mut mooc_fi: Vec<MoocFiCourseProgress> = moocfi_courses
        .into_iter()
        .map(|course| MoocFiCourseProgress {
            course_id: course.course_id,
            name: course.name,
            completed: course.completed,
            points: course.points,
            max_points: course.max_points,
            tmc_mooc_fi_courses: Vec::new(),
        })
        .collect();
    let mooc_fi_index: HashMap<Uuid, usize> = mooc_fi
        .iter()
        .enumerate()
        .map(|(index, course)| (course.course_id, index))
        .collect();

    // A TMC course with a moocfi_id only reports its progress to that mooc.fi course, so listing it
    // under both would count one course twice.
    tmc_courses.retain(|tmc_course| {
        let mooc_fi_course = tmc_course
            .moocfi_id
            .as_deref()
            .and_then(|id| Uuid::parse_str(id.trim()).ok())
            .and_then(|id| mooc_fi_index.get(&id));
        match mooc_fi_course {
            Some(&index) => {
                mooc_fi[index]
                    .tmc_mooc_fi_courses
                    .push(tmc_course.clone().into());
                false
            }
            None => true,
        }
    });

    ProgressByPlatform {
        courses_mooc_fi: Vec::new(),
        mooc_fi_status,
        mooc_fi,
        tmc_mooc_fi_status,
        tmc_mooc_fi: tmc_courses.into_iter().map(Into::into).collect(),
    }
}

fn external_platform_status<T>(progress: &Option<Result<T, ()>>) -> ExternalPlatformStatus {
    match progress {
        None => ExternalPlatformStatus::NotQueried,
        Some(Ok(_)) => ExternalPlatformStatus::Loaded,
        Some(Err(())) => ExternalPlatformStatus::Unavailable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MOOCFI_COURSE_ID: &str = "00000000-0000-0000-0000-0000000000aa";

    fn tmc_course(name: &str, moocfi_id: Option<&str>) -> TmcCourseProgress {
        TmcCourseProgress {
            id: 1,
            name: name.to_string(),
            title: None,
            moocfi_id: moocfi_id.map(str::to_string),
            awarded_points: 3,
            submissions: 7,
            last_submission_at: None,
        }
    }

    fn moocfi_course(id: &str) -> MoocfiCourseProgress {
        MoocfiCourseProgress {
            course_id: Uuid::parse_str(id).unwrap(),
            name: "Java Programming I".to_string(),
            completed: false,
            points: Some(1.0),
            max_points: Some(2.0),
        }
    }

    #[test]
    fn tmc_course_reporting_to_a_listed_moocfi_course_is_listed_once_under_it() {
        let progress = merge_external_progress(
            Some(Ok(vec![
                tmc_course("java-i", Some(MOOCFI_COURSE_ID)),
                tmc_course("standalone", None),
                tmc_course("free-text-moocfi-id", Some("not-a-uuid")),
            ])),
            Some(Ok(vec![moocfi_course(MOOCFI_COURSE_ID)])),
        );

        assert_eq!(progress.mooc_fi.len(), 1);
        assert_eq!(
            progress.mooc_fi[0].tmc_mooc_fi_courses,
            vec![tmc_course("java-i", None).into()]
        );
        let tmc_names: Vec<&str> = progress
            .tmc_mooc_fi
            .iter()
            .map(|c| c.name.as_str())
            .collect();
        assert_eq!(tmc_names, vec!["standalone", "free-text-moocfi-id"]);
    }

    #[test]
    fn tmc_course_stays_under_tmc_when_moocfi_is_unavailable() {
        let progress = merge_external_progress(
            Some(Ok(vec![tmc_course("java-i", Some(MOOCFI_COURSE_ID))])),
            Some(Err(())),
        );

        assert_eq!(progress.mooc_fi_status, ExternalPlatformStatus::Unavailable);
        assert_eq!(progress.tmc_mooc_fi_status, ExternalPlatformStatus::Loaded);
        assert!(progress.mooc_fi.is_empty());
        assert_eq!(progress.tmc_mooc_fi.len(), 1);
    }

    #[test]
    fn unqueried_platforms_are_reported_as_such() {
        let progress = merge_external_progress(None, None);

        assert_eq!(progress.mooc_fi_status, ExternalPlatformStatus::NotQueried);
        assert_eq!(
            progress.tmc_mooc_fi_status,
            ExternalPlatformStatus::NotQueried
        );
    }

    #[test]
    fn tmc_title_is_preferred_over_its_name() {
        let mut course = tmc_course("mooc-java-programming-i", None);
        course.title = Some("Java Programming I".to_string());

        assert_eq!(
            TmcMoocFiCourseProgress::from(course).name,
            "Java Programming I"
        );
    }
}
