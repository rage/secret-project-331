/*!
Handlers for HTTP requests to `/api/v0/main-frontend/moocfi-credit-registrations`.

The mooc.fi registration page's own data: the signed-in student's completions of one mooc.fi course,
read fresh from mooc.fi on every load. Only completions courses registers get an
`external_completion_id`; the per-registration detail is behind the routes keyed on it.
*/

use std::collections::HashSet;

use headless_lms_base::config::MoocfiDelegationConfiguration;
use headless_lms_models::{
    external_completions::{self, ExternalCompletion, UpstreamCompletions},
    external_credit_targets::{self, ExternalCreditTarget},
    library::credit_registration::{PendingPreconditions, StudentFacingCreditRegistrationStatus},
};
use headless_lms_utils::services::moocfi::{DelegatedCompletion, MoocfiClient};
use utoipa::{OpenApi, ToSchema};

use crate::domain::rate_limit_middleware_builder::{RateLimit, RateLimitConfig, RateLimitKey};
use crate::prelude::*;

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

/// One mooc.fi completion and what is happening to its credits.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MoocfiCompletionRegistration {
    pub moocfi_completion_id: Uuid,
    pub completion_date: DateTime<Utc>,
    pub tier: Option<i32>,
    pub status: MoocfiCompletionStatus,
    /// Set for completions courses has taken up.
    pub external_completion_id: Option<Uuid>,
    /// The course code the completion registers as, when a target covers its tier.
    pub credit_unit: Option<MoocfiCreditUnit>,
    /// The live ledger row, once the pipeline has created one.
    pub credit_registration_id: Option<Uuid>,
    pub student_facing_status: Option<StudentFacingCreditRegistrationStatus>,
}

/// Why a completion is or is not registered through courses.
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
    /// Another organization has registered it on mooc.fi.
    RegisteredOnMoocfi,
    /// No target registers the completion's tier.
    NoCreditUnit,
    /// Taken up earlier, but mooc.fi no longer has it.
    RemovedFromMoocfi,
}

/// The study-registry course a completion registers as.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MoocfiCreditUnit {
    pub external_credit_target_id: Uuid,
    pub name: String,
    pub uh_course_code: String,
    pub ects_credits: f32,
}

impl From<&ExternalCreditTarget> for MoocfiCreditUnit {
    fn from(target: &ExternalCreditTarget) -> Self {
        Self {
            external_credit_target_id: target.id,
            name: target.name.clone(),
            uh_course_code: target.uh_course_code.clone(),
            ects_credits: target.ects_credits,
        }
    }
}

/**
GET `/api/v0/main-frontend/moocfi-credit-registrations/{moocfi_course_id}` - Syncs the caller's
completions of a mooc.fi course from mooc.fi and returns them with their registration status.

When mooc.fi cannot be reached the answer is still 200, from the rows stored earlier, with
`is_up_to_date` false.
*/
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    get,
    path = "/{moocfi_course_id}",
    operation_id = "getMyMoocfiCreditRegistrations",
    tag = "moocfi-credit-registrations",
    params(("moocfi_course_id" = Uuid, Path, description = "The handler course id on mooc.fi")),
    responses(
        (status = 200, description = "The caller's completions of the course", body = MoocfiCreditRegistrations)
    )
)]
pub async fn get_my_moocfi_credit_registrations(
    user: AuthUser,
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    moocfi_course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<MoocfiCreditRegistrations>> {
    let token = skip_authorize();
    let moocfi_course_id = moocfi_course_id.into_inner();
    let moocfi = &app_conf.moocfi_configuration;

    let mut conn = pool.acquire().await?;
    let signed_in_email = models::user_details::get_user_details_by_user_id(&mut conn, user.id)
        .await?
        .email;
    let targets =
        external_credit_targets::get_by_moocfi_course_id(&mut conn, moocfi_course_id).await?;
    // Not held across the lookup, which may take its whole 10 s timeout.
    drop(conn);

    let lookup = match (&moocfi.delegation, user.upstream_id()) {
        (None, _) => Lookup::Unavailable,
        // A courses-only account has no mooc.fi completions.
        (Some(_), None) => Lookup::NothingToLookUp,
        (Some(_), Some(_)) if targets.is_empty() => Lookup::NothingToLookUp,
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

    let mut conn = pool.acquire().await?;
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

    let mut completions = Vec::new();
    let mut listed = HashSet::new();
    for row in preferred_rows(&stored, &targets) {
        listed.insert(row.moocfi_completion_id);
        let target = targets
            .iter()
            .find(|target| target.id == row.external_credit_target_id);
        let registration_state = registration_states
            .iter()
            .find(|state| state.external_completion_id == row.id);
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
        });
        completions.push(MoocfiCompletionRegistration {
            moocfi_completion_id: row.moocfi_completion_id,
            completion_date: row.completion_date,
            tier: row.tier,
            status: held_by_pause(stored_status(row, target), target, student_facing_status),
            external_completion_id: Some(row.id),
            credit_unit: target.map(MoocfiCreditUnit::from),
            credit_registration_id: registration_state.map(|state| state.credit_registration_id),
            student_facing_status,
        });
    }
    if let Lookup::Fetched {
        delegation,
        completions: fetched_completions,
        ..
    } = &lookup
    {
        for completion in fetched_completions
            .iter()
            .filter(|completion| !listed.contains(&completion.id))
        {
            let target = targets
                .iter()
                .find(|target| external_completions::admits_tier(target.tiers, completion.tier));
            completions.push(MoocfiCompletionRegistration {
                moocfi_completion_id: completion.id,
                completion_date: completion.effective_date(),
                tier: completion.tier,
                status: held_by_pause(
                    unstored_status(completion, target, &delegation.organization_slug),
                    target,
                    None,
                ),
                external_completion_id: None,
                credit_unit: target.map(MoocfiCreditUnit::from),
                credit_registration_id: None,
                student_facing_status: None,
            });
        }
    }
    completions.sort_by_key(|completion| std::cmp::Reverse(completion.completion_date));

    let link = MoocfiCourseLink::of(&app_conf, &targets);
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
    fn of(app_conf: &ApplicationConfiguration, targets: &[ExternalCreditTarget]) -> Self {
        let first_target = targets.first();
        Self {
            course_name: first_target.map(|target| target.name.clone()),
            moocfi_course_url: first_target.and_then(|target| {
                app_conf
                    .moocfi_configuration
                    .frontend_url
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
#[instrument(skip(pool, app_conf))]
#[utoipa::path(
    get,
    path = "/{moocfi_course_id}/course-link",
    operation_id = "getMoocfiCourseLink",
    tag = "moocfi-credit-registrations",
    params(("moocfi_course_id" = Uuid, Path, description = "The handler course id on mooc.fi")),
    responses(
        (status = 200, description = "The course's name and registration page", body = MoocfiCourseLink)
    )
)]
pub async fn get_moocfi_course_link(
    pool: web::Data<PgPool>,
    app_conf: web::Data<ApplicationConfiguration>,
    moocfi_course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<MoocfiCourseLink>> {
    let token = skip_authorize();
    let mut conn = pool.acquire().await?;
    let targets =
        external_credit_targets::get_by_moocfi_course_id(&mut conn, *moocfi_course_id).await?;
    token.authorized_ok(web::Json(MoocfiCourseLink::of(&app_conf, &targets)))
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

/// One row per completion: after a tier change a completion has a withdrawn row on its old target
/// beside the live one, and only the one whose target still covers its tier is shown.
fn preferred_rows<'a>(
    stored: &'a [ExternalCompletion],
    targets: &[ExternalCreditTarget],
) -> Vec<&'a ExternalCompletion> {
    let covers = |row: &ExternalCompletion| {
        targets.iter().any(|target| {
            target.id == row.external_credit_target_id
                && external_completions::admits_tier(target.tiers, row.tier)
        })
    };
    let mut rows: Vec<&ExternalCompletion> = Vec::new();
    for row in stored {
        match rows
            .iter_mut()
            .find(|kept| kept.moocfi_completion_id == row.moocfi_completion_id)
        {
            Some(kept) if !covers(kept) && covers(row) => *kept = row,
            Some(_) => {}
            None => rows.push(row),
        }
    }
    rows
}

/// Mirrors the order in which the subjects view withdraws a stored row.
fn stored_status(
    row: &ExternalCompletion,
    target: Option<&ExternalCreditTarget>,
) -> MoocfiCompletionStatus {
    if row.upstream_missing_at.is_some() {
        return MoocfiCompletionStatus::RemovedFromMoocfi;
    }
    if row.registered_upstream_at.is_some() {
        return MoocfiCompletionStatus::RegisteredOnMoocfi;
    }
    let Some(target) =
        target.filter(|target| external_completions::admits_tier(target.tiers, row.tier))
    else {
        return MoocfiCompletionStatus::NoCreditUnit;
    };
    if !row.eligible_for_ects {
        return MoocfiCompletionStatus::NotEligible;
    }
    if row.completion_date < target.delegated_at {
        return MoocfiCompletionStatus::BeforeCutoff;
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

/// Why a completion mooc.fi returned has no row: the sync takes up every other one.
fn unstored_status(
    completion: &DelegatedCompletion,
    target: Option<&ExternalCreditTarget>,
    organization_slug: &str,
) -> MoocfiCompletionStatus {
    if completion
        .registrations
        .iter()
        .any(|registration| registration.organization_slug.as_deref() != Some(organization_slug))
    {
        return MoocfiCompletionStatus::RegisteredOnMoocfi;
    }
    let Some(target) = target else {
        return MoocfiCompletionStatus::NoCreditUnit;
    };
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
