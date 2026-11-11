//! The courses a user would lose on each platform their account reaches, shown before account
//! deletion.

use std::collections::{BTreeSet, HashMap};
use std::time::Duration;

use futures_util::future::OptionFuture;
use headless_lms_utils::prelude::UtilResult;
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

/// How querying an external platform for the user's courses went.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExternalPlatformStatus {
    Loaded,
    /// The account has no tmc.mooc.fi id, or the server runs in test mode.
    NotQueried,
    /// The platform failed or timed out; the user may still have progress there.
    Unavailable,
}

/// A course the user is enrolled on in courses.mooc.fi.
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

/// A course the user has progress or a completion on in the old mooc.fi.
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

/// A course the user has submissions or awarded points on in tmc.mooc.fi.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct TmcMoocFiCourseProgress {
    pub name: String,
    /// Number of points awarded, not a score.
    pub awarded_points: i32,
    pub submissions: i32,
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
        }
    }
}

/// Lists the user's courses on courses.mooc.fi, tmc.mooc.fi and the old mooc.fi. The external
/// platforms are queried concurrently, and one failing is reported in its status instead of
/// failing the whole listing.
pub async fn get_progress_by_platform(
    pool: &PgPool,
    tmc_client: &TmcClient,
    user_id: Uuid,
    query_external_platforms: bool,
) -> models::ModelResult<ProgressByPlatform> {
    // Released before the upstream requests so a slow platform does not hold a pool connection.
    let (upstream_id, courses_mooc_fi) = {
        let mut conn = pool.acquire().await?;
        let upstream_id = models::users::get_by_id(&mut conn, user_id)
            .await?
            .upstream_id;
        (
            upstream_id,
            get_courses_mooc_fi_progress(&mut conn, user_id).await?,
        )
    };
    let upstream_id = upstream_id.filter(|_| query_external_platforms);
    let tmc_progress: OptionFuture<_> = upstream_id
        .map(|id| tmc_client.get_user_course_progress(id, UPSTREAM_TIMEOUT))
        .into();
    let moocfi_progress: OptionFuture<_> = upstream_id
        .map(|id| {
            moocfi::get_user_course_progress(
                tmc_client.get_admin_access_token(),
                id,
                UPSTREAM_TIMEOUT,
            )
        })
        .into();
    let (tmc_progress, moocfi_progress) = tokio::join!(tmc_progress, moocfi_progress);

    let (tmc_mooc_fi_status, tmc_courses) = settle(tmc_progress, "tmc.mooc.fi", user_id);
    let (mooc_fi_status, moocfi_courses) = settle(moocfi_progress, "mooc.fi", user_id);
    let (mooc_fi, tmc_mooc_fi) = merge_external_progress(tmc_courses, moocfi_courses);
    Ok(ProgressByPlatform {
        courses_mooc_fi,
        mooc_fi_status,
        mooc_fi,
        tmc_mooc_fi_status,
        tmc_mooc_fi,
    })
}

/// The platform's status and courses; `None` means it was not queried. A failure is logged here
/// and otherwise surfaces only as [`ExternalPlatformStatus::Unavailable`].
fn settle<T>(
    progress: Option<UtilResult<Vec<T>>>,
    platform: &str,
    user_id: Uuid,
) -> (ExternalPlatformStatus, Vec<T>) {
    match progress {
        None => (ExternalPlatformStatus::NotQueried, Vec::new()),
        Some(Ok(courses)) => (ExternalPlatformStatus::Loaded, courses),
        Some(Err(e)) => {
            warn!("Could not list the {platform} courses of user {user_id}: {e}");
            (ExternalPlatformStatus::Unavailable, Vec::new())
        }
    }
}

async fn get_courses_mooc_fi_progress(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> models::ModelResult<Vec<CoursesMoocFiCourseProgress>> {
    let course_ids: Vec<Uuid> = models::course_instance_enrollments::get_by_user_id(conn, user_id)
        .await?
        .into_iter()
        .map(|enrollment| enrollment.course_id)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let courses = models::courses::get_by_ids(conn, &course_ids).await?;
    let modules = models::course_modules::get_by_course_ids(conn, &course_ids).await?;
    let completions = models::course_module_completions::get_all_by_user_id(conn, user_id).await?;
    let progress_by_module =
        models::user_exercise_states::get_user_course_module_progress(conn, &course_ids, user_id)
            .await?;

    let mut progress: Vec<CoursesMoocFiCourseProgress> = courses
        .into_iter()
        .map(|course| {
            let course_modules: Vec<_> = modules
                .iter()
                .filter(|module| module.course_id == course.id)
                .collect();
            let completed_modules = course_modules
                .iter()
                .filter(|module| {
                    models::course_module_completions::select_best_completion(
                        completions
                            .iter()
                            .filter(|c| c.course_module_id == module.id && !c.needs_to_be_reviewed),
                    )
                    .is_some_and(|best| best.passed)
                })
                .count();
            let module_progress: Vec<_> = course_modules
                .iter()
                .filter_map(|module| progress_by_module.get(&module.id))
                .collect();
            let max_points = module_progress
                .iter()
                .filter_map(|p| p.score_maximum)
                .reduce(|a, b| a + b);
            CoursesMoocFiCourseProgress {
                course_id: course.id,
                name: course.name,
                completed_modules: completed_modules as u32,
                total_modules: course_modules.len() as u32,
                points: module_progress.iter().map(|p| p.score_given).sum(),
                max_points,
            }
        })
        .collect();
    progress.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(progress)
}

/// Files each TMC course that reports to a listed mooc.fi course under that course, since TMC
/// only forwards its progress there; returns the mooc.fi courses and the remaining TMC courses.
fn merge_external_progress(
    tmc_courses: Vec<TmcCourseProgress>,
    moocfi_courses: Vec<MoocfiCourseProgress>,
) -> (Vec<MoocFiCourseProgress>, Vec<TmcMoocFiCourseProgress>) {
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

    let mut tmc_mooc_fi = Vec::new();
    for tmc_course in tmc_courses {
        let mooc_fi_course = tmc_course
            .moocfi_id
            .as_deref()
            .and_then(|id| Uuid::parse_str(id.trim()).ok())
            .and_then(|id| mooc_fi_index.get(&id));
        match mooc_fi_course {
            Some(&index) => mooc_fi[index].tmc_mooc_fi_courses.push(tmc_course.into()),
            None => tmc_mooc_fi.push(tmc_course.into()),
        }
    }
    (mooc_fi, tmc_mooc_fi)
}

#[cfg(test)]
mod tests {
    use headless_lms_utils::prelude::{UtilError, UtilErrorType};

    use super::*;

    const MOOCFI_COURSE_ID: &str = "00000000-0000-0000-0000-0000000000aa";

    fn tmc_course(name: &str, moocfi_id: Option<&str>) -> TmcCourseProgress {
        TmcCourseProgress {
            name: name.to_string(),
            title: None,
            moocfi_id: moocfi_id.map(str::to_string),
            awarded_points: 3,
            submissions: 7,
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
        let (mooc_fi, tmc_mooc_fi) = merge_external_progress(
            vec![
                tmc_course("java-i", Some(MOOCFI_COURSE_ID)),
                tmc_course("standalone", None),
                tmc_course("free-text-moocfi-id", Some("not-a-uuid")),
            ],
            vec![moocfi_course(MOOCFI_COURSE_ID)],
        );

        assert_eq!(mooc_fi.len(), 1);
        assert_eq!(
            mooc_fi[0].tmc_mooc_fi_courses,
            vec![tmc_course("java-i", None).into()]
        );
        let tmc_names: Vec<&str> = tmc_mooc_fi.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(tmc_names, vec!["standalone", "free-text-moocfi-id"]);
    }

    #[test]
    fn tmc_course_stays_under_tmc_when_its_moocfi_course_is_not_listed() {
        let (mooc_fi, tmc_mooc_fi) =
            merge_external_progress(vec![tmc_course("java-i", Some(MOOCFI_COURSE_ID))], vec![]);

        assert!(mooc_fi.is_empty());
        assert_eq!(tmc_mooc_fi.len(), 1);
    }

    #[test]
    fn platform_status_follows_the_query_outcome() {
        let user_id = Uuid::nil();
        let failure: UtilResult<Vec<TmcCourseProgress>> = Err(UtilError::new(
            UtilErrorType::TmcHttpStatusError(404),
            "test".to_string(),
            None,
        ));

        assert_eq!(
            settle::<TmcCourseProgress>(None, "tmc.mooc.fi", user_id).0,
            ExternalPlatformStatus::NotQueried
        );
        assert_eq!(
            settle(
                Some(Ok(vec![tmc_course("java-i", None)])),
                "tmc.mooc.fi",
                user_id
            ),
            (
                ExternalPlatformStatus::Loaded,
                vec![tmc_course("java-i", None)]
            )
        );
        assert_eq!(
            settle(Some(failure), "tmc.mooc.fi", user_id),
            (ExternalPlatformStatus::Unavailable, vec![])
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
