/*!
Handlers for HTTP requests to `/api/v0/main-frontend/moocfi-credit-registrations`.

The mooc.fi registration page's data: the signed-in student's completions of one mooc.fi course,
read from mooc.fi on every load. Per-registration detail is behind the routes keyed on a
completion's `external_completion_id`, which only completions courses registers have.
*/

use headless_lms_base::config::MoocfiDelegationConfiguration;
use headless_lms_models::{
    completion_registration_credit_justifications,
    external_completions::{self, ExternalCompletion, UpstreamCompletions},
    external_credit_target_codes::{self, ExternalCreditTargetCode},
    external_credit_targets::{self, ExternalCreditTarget},
    library::credit_registration::{PendingPreconditions, StudentFacingCreditRegistrationStatus},
};
use headless_lms_utils::services::moocfi::{DelegatedCompletion, MoocfiClient};
use utoipa::{IntoParams, OpenApi, ToSchema};

use crate::domain::rate_limit_middleware_builder::{RateLimit, RateLimitConfig, RateLimitKey};
use crate::prelude::*;

/// How old mooc.fi's course details may get before a page load asks again. The daily configuration
/// check refreshes them too.
const COURSE_DETAILS_MAX_AGE: chrono::TimeDelta = chrono::TimeDelta::hours(1);

#[derive(OpenApi)]
#[openapi(paths(get_my_moocfi_credit_registrations, get_moocfi_course_link))]
pub(crate) struct MainFrontendMoocfiCreditRegistrationsApiDoc;

/// What the registration page shows for one mooc.fi course.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MoocfiCreditRegistrations {
    pub moocfi_course_id: Uuid,
    /// The page must show it: a handoff signs in whichever account the TMC token belongs to.
    pub signed_in_email: String,
    /// `None` when no target is configured for the course.
    pub course_name: Option<String>,
    /// The course's registration page on mooc.fi, for links back.
    pub moocfi_course_url: Option<String>,
    /// False when mooc.fi could not be asked just now, so `completions` is only what was stored
    /// earlier and the page should offer to try again.
    pub is_up_to_date: bool,
    /// Newest first.
    pub completions: Vec<MoocfiCompletionRegistration>,
}

/// One mooc.fi completion and what is happening to the credits its tier earns.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MoocfiCompletionRegistration {
    pub moocfi_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub tier: Option<i32>,
    /// One per course code the tier earns, lowest minimum tier first, each registered on its own.
    /// Empty when the tier earns none. A code the tier no longer earns is listed while it has a
    /// ledger row, so credits already registered do not vanish.
    pub credit_units: Vec<MoocfiCreditUnitRegistration>,
    /// Whether the student may take mooc.fi's certificate instead of credits. True while mooc.fi's
    /// answer is unknown: its certificate page copes with a course that has none.
    pub offers_certificate: bool,
    /// The student's saved reason for needing the credits rather than the certificate.
    pub credit_justification: Option<String>,
}

/// One course code of a completion and what is happening to its credits.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MoocfiCreditUnitRegistration {
    pub credit_unit: MoocfiCreditUnit,
    pub status: MoocfiCompletionStatus,
    /// Set once courses has taken the completion up under this code.
    pub external_completion_id: Option<Uuid>,
    /// The live ledger row, once the pipeline has created one.
    pub credit_registration_id: Option<Uuid>,
    pub student_facing_status: Option<StudentFacingCreditRegistrationStatus>,
}

/// Why a completion is or is not registered under a code through courses.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum MoocfiCompletionStatus {
    /// Courses registers it; `student_facing_status` says how far it is.
    RegisteringOnCourses,
    /// Courses would register it, but the target is paused or not switched on, so nothing moves.
    RegistrationPaused,
    /// Dated before the cutoff, so mooc.fi's own registration process handles it.
    BeforeCutoff,
    NotEligible,
    /// Another organization has registered it under the code on mooc.fi.
    RegisteredOnMoocfi,
    /// An earlier completion with the same grade is registered under the code, so this one is not
    /// registered under it again.
    EquivalentRegistered,
    /// Taken up earlier, but mooc.fi no longer has it.
    RemovedFromMoocfi,
}

/// A study-registry course a completion registers as.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MoocfiCreditUnit {
    pub external_credit_target_code_id: Uuid,
    /// The name students see for these credits.
    pub name: String,
    pub uh_course_code: String,
    pub ects_credits: f32,
    /// Where an Open University student enrols.
    pub enrolment_link: Option<String>,
    /// A code of the same completion that must be registered before this one is sent to Sisu.
    pub prerequisite_code_id: Option<Uuid>,
}

impl From<&ExternalCreditTargetCode> for MoocfiCreditUnit {
    fn from(code: &ExternalCreditTargetCode) -> Self {
        Self {
            external_credit_target_code_id: code.id,
            name: code.name.clone(),
            uh_course_code: code.uh_course_code.clone(),
            ects_credits: code.ects_credits,
            enrolment_link: code.enrolment_link.clone(),
            prerequisite_code_id: code.prerequisite_code_id,
        }
    }
}

/**
GET `/api/v0/main-frontend/moocfi-credit-registrations/{moocfi_course_id}` - Syncs the caller's
completions of a mooc.fi course from mooc.fi and returns them with their registration status.

When mooc.fi cannot be reached the answer is still 200, from the rows stored earlier, with
`is_up_to_date` false.
*/
#[instrument(skip(pool, app_conf, language))]
#[utoipa::path(
    get,
    path = "/{moocfi_course_id}",
    operation_id = "getMyMoocfiCreditRegistrations",
    tag = "moocfi-credit-registrations",
    params(
        ("moocfi_course_id" = Uuid, Path, description = "The handler course id on mooc.fi"),
        UiLanguageQuery
    ),
    responses(
        (status = 200, description = "The caller's completions of the course", body = MoocfiCreditRegistrations)
    )
)]
pub async fn get_my_moocfi_credit_registrations(
    user: AuthUser,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    moocfi_course_id: web::Path<Uuid>,
    language: web::Query<UiLanguageQuery>,
) -> ControllerResult<web::Json<MoocfiCreditRegistrations>> {
    let token = skip_authorize();
    let moocfi_course_id = moocfi_course_id.into_inner();
    let moocfi = &app_conf.moocfi_configuration;

    let mut conn = pool.acquire().await?;
    let signed_in_email = models::user_details::get_user_details_by_user_id(&mut conn, user.id)
        .await?
        .email;
    let target =
        external_credit_targets::get_by_moocfi_course_id(&mut conn, moocfi_course_id).await?;
    let codes = match &target {
        Some(target) => {
            external_credit_target_codes::get_by_target_id(&mut conn, target.id).await?
        }
        None => Vec::new(),
    };
    // Not held across the lookup, which may take its whole 10 s timeout.
    drop(conn);

    let lookup = match (&moocfi.delegation, user.upstream_id()) {
        (None, _) => Lookup::Unavailable,
        // A courses-only account has no mooc.fi completions.
        (Some(_), None) => Lookup::NothingToLookUp,
        (Some(_), Some(_)) if target.is_none() => Lookup::NothingToLookUp,
        (Some(delegation), Some(upstream_id)) => match MoocfiClient::new(delegation)
            .get_user_completions(moocfi_course_id, upstream_id)
            .await
        {
            Ok(completions) => Lookup::Fetched {
                delegation,
                upstream_id,
                completions,
            },
            Err(error) => {
                warn!(%error, "Showing stored mooc.fi completions: the lookup failed");
                Lookup::Unavailable
            }
        },
    };

    // `None` when no lookup was due; `Some(None)` when mooc.fi gave no usable answer. Not after a
    // failed completions lookup, so an unreachable mooc.fi costs one timeout, not two.
    let course_lookup = match &moocfi.delegation {
        Some(delegation)
            if are_course_details_stale(target.as_ref())
                && !matches!(lookup, Lookup::Unavailable) =>
        {
            Some(
                match MoocfiClient::new(delegation)
                    .get_delegated_course(moocfi_course_id)
                    .await
                {
                    Ok(course) => course,
                    Err(error) => {
                        warn!(%error, "Keeping the stored mooc.fi course details: the lookup failed");
                        None
                    }
                },
            )
        }
        _ => None,
    };

    let mut conn = pool.acquire().await?;
    match &course_lookup {
        Some(Some(course)) => {
            external_credit_targets::record_moocfi_course_details(
                &mut conn,
                moocfi_course_id,
                course.has_certificate,
            )
            .await?
        }
        Some(None) => {
            external_credit_targets::record_moocfi_course_check_failure(&mut conn, moocfi_course_id)
                .await?
        }
        None => {}
    }
    let has_certificate = course_lookup
        .flatten()
        .map(|course| course.has_certificate)
        .or_else(|| {
            target
                .as_ref()
                .and_then(|target| target.moocfi_has_certificate)
        });
    if let Lookup::Fetched {
        delegation,
        upstream_id,
        completions,
    } = &lookup
    {
        external_completions::sync_from_upstream(
            &mut conn,
            UpstreamCompletions {
                user_id: user.id,
                moocfi_user_upstream_id: *upstream_id,
                moocfi_course_id,
                completions,
                organization_slug: &delegation.organization_slug,
            },
        )
        .await?;
    }
    let stored =
        external_completions::get_by_user_and_moocfi_course(&mut conn, user.id, moocfi_course_id)
            .await?;
    let registration_states =
        external_completions::get_registration_states_by_user_and_moocfi_course(
            &mut conn,
            user.id,
            moocfi_course_id,
        )
        .await?;
    let registered_equivalents = external_completions::get_registered_equivalents(
        &mut conn,
        &stored.iter().map(|row| row.id).collect::<Vec<_>>(),
    )
    .await?;
    let moocfi_completion_ids: Vec<Uuid> =
        stored.iter().map(|row| row.moocfi_completion_id).collect();
    let justifications =
        completion_registration_credit_justifications::get_by_user_and_moocfi_completion_ids(
            &mut conn,
            user.id,
            &moocfi_completion_ids,
        )
        .await?;
    let justification_of = |moocfi_completion_id: Uuid| {
        justifications
            .iter()
            .find(|row| row.moocfi_completion_id == Some(moocfi_completion_id))
            .map(|row| row.justification.clone())
    };
    let offers_certificate = has_certificate != Some(false);

    let fetched = match &lookup {
        Lookup::Fetched {
            delegation,
            completions,
            ..
        } => Some((
            completions.as_slice(),
            delegation.organization_slug.as_str(),
        )),
        _ => None,
    };
    let mut moocfi_completion_ids: Vec<Uuid> = fetched
        .map(|(completions, _)| completions.iter().map(|completion| completion.id).collect())
        .unwrap_or_default();
    for row in &stored {
        if !moocfi_completion_ids.contains(&row.moocfi_completion_id) {
            moocfi_completion_ids.push(row.moocfi_completion_id);
        }
    }

    let mut completions = Vec::new();
    for moocfi_completion_id in moocfi_completion_ids {
        let upstream = fetched.and_then(|(completions, _)| {
            completions
                .iter()
                .find(|completion| completion.id == moocfi_completion_id)
        });
        let rows: Vec<&ExternalCompletion> = stored
            .iter()
            .filter(|row| row.moocfi_completion_id == moocfi_completion_id)
            .collect();
        let (completion_date, tier) = match (upstream, rows.first()) {
            (Some(completion), _) => (completion.effective_date(), completion.tier),
            (None, Some(row)) => (row.completion_date, row.tier),
            (None, None) => continue,
        };
        let mut credit_units = Vec::new();
        for code in &codes {
            let row = rows
                .iter()
                .find(|row| row.external_credit_target_code_id == code.id);
            let registration_state = row.and_then(|row| {
                registration_states
                    .iter()
                    .find(|state| state.external_completion_id == row.id)
            });
            if !code.is_earned_by(tier) && registration_state.is_none() {
                continue;
            }
            let student_facing_status = registration_state.map(|state| {
                StudentFacingCreditRegistrationStatus::of(
                    state.state,
                    PendingPreconditions {
                        completion_eligible: state.completion_eligible,
                        has_verified_student_number: state.has_verified_student_number,
                        course_code_allowed: state.course_code_allowed,
                    },
                    state.enrolment_resolved,
                )
                .held_for_prerequisite(state.state, state.prerequisite_met)
            });
            let status = match (row, upstream, &target) {
                (Some(row), _, Some(target)) => {
                    stored_status(row, target, registered_equivalents.contains_key(&row.id))
                }
                (None, Some(completion), Some(target)) => unstored_status(
                    completion,
                    code,
                    target,
                    fetched.map(|(_, slug)| slug).unwrap_or_default(),
                ),
                _ => continue,
            };
            credit_units.push(MoocfiCreditUnitRegistration {
                credit_unit: MoocfiCreditUnit::from(code),
                status: held_by_pause(status, target.as_ref(), student_facing_status),
                external_completion_id: row.map(|row| row.id),
                credit_registration_id: registration_state
                    .map(|state| state.credit_registration_id),
                student_facing_status,
            });
        }
        completions.push(MoocfiCompletionRegistration {
            moocfi_completion_id,
            completion_date,
            tier,
            credit_units,
            offers_certificate,
            credit_justification: justification_of(moocfi_completion_id),
        });
    }
    completions.sort_by_key(|completion| std::cmp::Reverse(completion.completion_date));

    let link = MoocfiCourseLink::of(&app_conf, target.as_ref(), language.ui_language.as_deref());
    token.authorized_ok(web::Json(MoocfiCreditRegistrations {
        moocfi_course_id,
        signed_in_email,
        course_name: link.course_name,
        moocfi_course_url: link.moocfi_course_url,
        is_up_to_date: !matches!(lookup, Lookup::Unavailable),
        completions,
    }))
}

/// A mooc.fi course's name and registration page, for pages that only link back to it.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MoocfiCourseLink {
    /// `None` when no target is configured for the course, as is the URL.
    pub course_name: Option<String>,
    pub moocfi_course_url: Option<String>,
}

impl MoocfiCourseLink {
    fn of(
        app_conf: &ApplicationConfiguration,
        target: Option<&ExternalCreditTarget>,
        ui_language: Option<&str>,
    ) -> Self {
        Self {
            course_name: target.map(|target| target.name.clone()),
            moocfi_course_url: target.and_then(|target| {
                app_conf
                    .moocfi_configuration
                    .localized_frontend_url(ui_language)
                    .ok()?
                    .join(&format!(
                        "register-completion/{}",
                        target.moocfi_course_slug
                    ))
                    .ok()
                    .map(|url| url.to_string())
            }),
        }
    }
}

/**
GET `/api/v0/main-frontend/moocfi-credit-registrations/{moocfi_course_id}/course-link` - The mooc.fi
course's name and registration page, without reading mooc.fi.

Needs no sign-in: the handoff error page uses it while the wrong account, or none, is signed in.
*/
#[instrument(skip(pool, app_conf, language))]
#[utoipa::path(
    get,
    path = "/{moocfi_course_id}/course-link",
    operation_id = "getMoocfiCourseLink",
    tag = "moocfi-credit-registrations",
    params(
        ("moocfi_course_id" = Uuid, Path, description = "The handler course id on mooc.fi"),
        UiLanguageQuery
    ),
    responses(
        (status = 200, description = "The course's name and registration page", body = MoocfiCourseLink)
    )
)]
pub async fn get_moocfi_course_link(
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    moocfi_course_id: web::Path<Uuid>,
    language: web::Query<UiLanguageQuery>,
) -> ControllerResult<web::Json<MoocfiCourseLink>> {
    let token = skip_authorize();
    let mut conn = pool.acquire().await?;
    let target =
        external_credit_targets::get_by_moocfi_course_id(&mut conn, *moocfi_course_id).await?;
    token.authorized_ok(web::Json(MoocfiCourseLink::of(
        &app_conf,
        target.as_ref(),
        language.ui_language.as_deref(),
    )))
}

/// Whether the course's target lacks mooc.fi's details or has them older than
/// [`COURSE_DETAILS_MAX_AGE`].
fn are_course_details_stale(target: Option<&ExternalCreditTarget>) -> bool {
    let fresh_since = Utc::now() - COURSE_DETAILS_MAX_AGE;
    target.is_some_and(|target| {
        target
            .moocfi_course_checked_at
            .is_none_or(|checked_at| checked_at < fresh_since)
    })
}

/// The courses UI language, which picks the language of the mooc.fi links in the answer.
#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct UiLanguageQuery {
    pub ui_language: Option<String>,
}

/// What reading the student's completions from mooc.fi gave.
enum Lookup<'a> {
    Fetched {
        delegation: &'a MoocfiDelegationConfiguration,
        upstream_id: i32,
        completions: Vec<DelegatedCompletion>,
    },
    NothingToLookUp,
    /// mooc.fi did not answer, or delegation is not configured.
    Unavailable,
}

/// Mirrors the order in which the subjects view withdraws a stored row.
fn stored_status(
    row: &ExternalCompletion,
    target: &ExternalCreditTarget,
    has_registered_equivalent: bool,
) -> MoocfiCompletionStatus {
    if row.upstream_missing_at.is_some() {
        return MoocfiCompletionStatus::RemovedFromMoocfi;
    }
    if row.registered_upstream_at.is_some() {
        return MoocfiCompletionStatus::RegisteredOnMoocfi;
    }
    if !row.eligible_for_ects {
        return MoocfiCompletionStatus::NotEligible;
    }
    if row.completion_date < target.delegated_at {
        return MoocfiCompletionStatus::BeforeCutoff;
    }
    if has_registered_equivalent {
        return MoocfiCompletionStatus::EquivalentRegistered;
    }
    MoocfiCompletionStatus::RegisteringOnCourses
}

/// A row of an inactive target would otherwise read as under way forever. One whose credit is
/// already settled keeps its real status.
fn held_by_pause(
    status: MoocfiCompletionStatus,
    target: Option<&ExternalCreditTarget>,
    student_facing_status: Option<StudentFacingCreditRegistrationStatus>,
) -> MoocfiCompletionStatus {
    use StudentFacingCreditRegistrationStatus as Facing;
    let is_settled = matches!(
        student_facing_status,
        Some(Facing::Registered | Facing::Failed | Facing::NotRegistering)
    );
    if status == MoocfiCompletionStatus::RegisteringOnCourses
        && target.is_some_and(|target| !target.is_active())
        && !is_settled
    {
        MoocfiCompletionStatus::RegistrationPaused
    } else {
        status
    }
}

/// Why a completion mooc.fi returned has no row under a code its tier earns: the sync takes up
/// every other one.
fn unstored_status(
    completion: &DelegatedCompletion,
    code: &ExternalCreditTargetCode,
    target: &ExternalCreditTarget,
    organization_slug: &str,
) -> MoocfiCompletionStatus {
    let is_registered_elsewhere = completion.registrations.iter().any(|registration| {
        registration.organization_slug.as_deref() != Some(organization_slug)
            && registration
                .course_code
                .as_deref()
                .is_none_or(|course_code| {
                    course_code
                        .trim()
                        .eq_ignore_ascii_case(code.uh_course_code.trim())
                })
    });
    if is_registered_elsewhere {
        return MoocfiCompletionStatus::RegisteredOnMoocfi;
    }
    if completion.eligible_for_ects != Some(true) {
        return MoocfiCompletionStatus::NotEligible;
    }
    if completion.effective_date() < target.delegated_at {
        return MoocfiCompletionStatus::BeforeCutoff;
    }
    MoocfiCompletionStatus::RegisteringOnCourses
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(
        web::resource("/{moocfi_course_id}")
            // Each load calls mooc.fi.
            .wrap(
                RateLimit::new(RateLimitConfig {
                    per_minute: Some(10),
                    per_hour: Some(100),
                    ..Default::default()
                })
                .keyed_by(RateLimitKey::User),
            )
            .route(web::get().to(get_my_moocfi_credit_registrations)),
    )
    .route(
        "/{moocfi_course_id}/course-link",
        web::get().to(get_moocfi_course_link),
    );
}
