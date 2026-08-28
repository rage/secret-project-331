/*!
Handlers for HTTP requests to `/api/v0/main-frontend/credit-registrations`.

Every handler filters by `user.id` in SQL and re-checks ownership before it writes. The stage a
student is shown is [`StudentFacingCreditRegistrationStatus`], computed in the models crate and never
re-derived here.
*/

use std::collections::HashMap;

use headless_lms_models::{
    credit_registration_account_linking_emails::{self, CreditRegistrationAccountLinkingEmail},
    credit_registration_events::{CreditRegistrationEventKind, NewCreditRegistrationEvent},
    credit_registrations::{
        CreditRegistrationErrorCode, CreditRegistrationState, RegistrationScope,
        StudentCreditRegistration, StudentRegistrationFilter,
    },
    email_deliveries::{EmailSendStatus, EmailSendStatusReport},
    library::credit_registration::StudentFacingCreditRegistrationStatus,
    library::credit_registration::student_notifications::{
        self, CreditRegistrationNotificationKind, RegistrationNotificationEmail,
    },
    open_university_product_access_tokens,
    student_number_verification_tokens::{self, StudentNumberVerificationToken},
    verified_student_numbers::{
        self, NewVerifiedStudentNumber, StudentNumberVerificationMethod, VerifiedStudentNumber,
    },
};
use models::library::credit_registration::preconditions::{
    PRECONDITIONS_LIMIT, recompute_preconditions,
};
use models::library::credit_registration::student_number_change;
use utoipa::{OpenApi, ToSchema};

use crate::domain::rate_limit_middleware_builder::{RateLimit, RateLimitConfig};
use crate::prelude::*;

/// How long after the last enrolment check the student may ask us to look again. The pipeline's own
/// recheck is daily, so this only bounds the button.
const ENROLMENT_RECHECK_MIN_INTERVAL_SECS: i64 = 60 * 60;

#[derive(OpenApi)]
#[openapi(paths(
    get_my_credit_registrations,
    get_my_credit_registration_for_course_module,
    get_my_credit_registration_enrolment_banners,
    request_credit_registration_enrolment_recheck,
    dismiss_credit_registration_enrolment_banner,
    get_my_verified_student_number,
    dismiss_my_auto_link_notice,
    unlink_my_student_number,
    preview_student_number_verification_token,
    claim_student_number_verification_token
))]
pub(crate) struct MainFrontendCreditRegistrationsApiDoc;

/// What we can honestly say about the linking mail: our send status, never a delivery.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct LinkingEmailStatus {
    pub email_send_status: EmailSendStatus,
    pub sent_at: Option<DateTime<Utc>>,
    pub emailed_to_masked: String,
}

/// The same, for one of the two terminal-state mails. No address: these go to the account's own,
/// which the reader either owns or already sees.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct NotificationEmailStatus {
    pub kind: CreditRegistrationNotificationKind,
    pub email_send_status: EmailSendStatus,
    pub sent_at: Option<DateTime<Utc>>,
}

impl NotificationEmailStatus {
    /// The mail that belongs with the row's current state, or `None` for a state that has none: a
    /// row shows at most one line, and an old action-needed mail on a since-registered row would
    /// contradict the badge above it.
    pub(crate) fn for_state(
        state: CreditRegistrationState,
        credit_registration_id: Uuid,
        mails: &[RegistrationNotificationEmail],
    ) -> Option<Self> {
        let wanted = CreditRegistrationNotificationKind::for_state(state)?;
        let mail = mails.iter().find(|mail| {
            mail.credit_registration_id == credit_registration_id && mail.kind == wanted
        })?;
        Some(Self {
            kind: mail.kind,
            email_send_status: mail.send_status.email_send_status,
            sent_at: mail.send_status.sent_at,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MyCreditRegistration {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_name: String,
    pub course_slug: String,
    pub course_module_id: Uuid,
    pub course_module_name: Option<String>,
    pub uh_course_code: Option<String>,
    pub ects_credits: Option<f32>,
    pub completion_date: DateTime<Utc>,
    pub student_facing_status: StudentFacingCreditRegistrationStatus,
    /// The registry declined this attempt because it already holds an equal or better grade. Still a
    /// `registered` stage — the credit exists — but the student raised a grade and nothing changed,
    /// so it earns a line of its own. Unlike the ledger state, this one is safe to expose: it says
    /// something about the student's own transcript and nothing about how we treat them.
    pub registry_already_held_equal_or_better: bool,
    /// Whether the pipeline is still expected to move this row: drives the status page's polling.
    pub status_is_moving: bool,
    pub error_code: Option<CreditRegistrationErrorCode>,
    pub next_attempt_at: DateTime<Utc>,
    pub registered_at: Option<DateTime<Utc>>,
    pub sisu_attainment_id: Option<String>,
    pub grade_id: Option<String>,
    /// Names the scale `grade_id` is on, without which "1" reads as a one out of five when it means
    /// a pass.
    pub grade_scale_id: Option<String>,
    pub credits: Option<f32>,
    pub attempt_number: i32,
    pub superseded: bool,
    pub can_request_enrolment_recheck: bool,
    pub enrolment_realisation_name: Option<String>,
    /// The open university enrolment page, for a row the study registry has no enrolment for.
    pub enrolment_link: Option<String>,
    /// Only on a row waiting for a student number whose account was linked at some point: the mail is
    /// addressed to a Sisu person, and a never-linked account names none.
    pub linking_email: Option<LinkingEmailStatus>,
    /// The terminal-state mail this row's status has, if one has been queued.
    pub notification_email: Option<NotificationEmailStatus>,
}

/// The live registration for one course module, with the attempts a newer one replaced.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MyCreditRegistrationForCourseModule {
    pub registration: MyCreditRegistration,
    /// The module's other rows, newest completion first. Shown because the study registry may hold an
    /// earlier attempt's attainment as well as the current one's.
    pub earlier_attempts: Vec<MyCreditRegistration>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct RequestCreditRegistrationEnrolmentRecheckResult {
    /// False when we looked so recently that asking again would tell the student nothing new.
    pub recheck_started: bool,
    pub next_recheck_allowed_at: Option<DateTime<Utc>>,
}

/// The account's linked student number, unmasked: it is the holder's own.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct MyVerifiedStudentNumber {
    pub student_number: String,
    pub verified_at: DateTime<Utc>,
    pub verified_via: StudentNumberVerificationMethod,
    /// The Sisu-held address the proof rests on, masked; `None` when support linked it by hand.
    pub verified_via_email_masked: Option<String>,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    /// Whether the pipeline linked this without asking, because the study registry holds this
    /// account's verified address for the student number. True until the student puts the notice
    /// away, and the notice is what makes a wrong automatic link noticeable.
    pub linked_automatically: bool,
    pub auto_link_notice_dismissed: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct UnlinkMyStudentNumberResult {
    /// Registrations that went back to waiting for a student number.
    pub affected_registration_count: i64,
}

/// What a mailed link would do, without doing it. Read-only on purpose: a mail scanner must not be
/// able to spend the token.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct StudentNumberVerificationTokenPreview {
    pub student_number: String,
    pub first_names: Option<String>,
    pub last_name: Option<String>,
    pub course_name: Option<String>,
    pub emailed_to_masked: String,
    pub expires_at: DateTime<Utc>,
    pub expired: bool,
    pub already_used: bool,
    /// So the page can say "you already used this link" rather than accusing someone else.
    pub already_used_by_this_account: bool,
    /// A support case, not something the student can resolve: moving a number between accounts on
    /// mailbox access alone would let anyone detach another account's link.
    pub conflicts_with_other_account: bool,
    /// What this account is linked to now. Claiming replaces it.
    pub current_student_number: Option<String>,
    /// Shown in the confirmation: being signed in to the wrong account is the common mistake.
    pub target_account_email: String,
    pub claimable: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ClaimStudentNumberVerificationTokenOutcome {
    Linked,
    /// The token named the number this account already holds. Consumed, and nothing changed.
    AlreadyLinkedToThisAccount,
    Expired,
    AlreadyUsed,
    /// Refused without consuming the token, so support can still act on it.
    StudentNumberAlreadyLinkedToAnotherAccount,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct ClaimStudentNumberVerificationTokenResult {
    pub outcome: ClaimStudentNumberVerificationTokenOutcome,
    pub student_number: Option<String>,
    pub linked_course_name: Option<String>,
    /// Completions that stopped waiting for a student number because of this claim.
    pub newly_unblocked_registration_count: i64,
}

/**
GET `/api/v0/main-frontend/credit-registrations/my` - Every credit registration of the signed-in
account, newest completion first.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/my",
    operation_id = "getMyCreditRegistrations",
    tag = "credit-registrations",
    responses(
        (status = 200, description = "The caller's credit registrations", body = Vec<MyCreditRegistration>)
    )
)]
pub async fn get_my_credit_registrations(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Vec<MyCreditRegistration>>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let res =
        build_my_credit_registrations(&mut conn, user.id, StudentRegistrationFilter::default())
            .await?;

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/credit-registrations/my/by-course-module/{course_module_id}` - The
signed-in account's registration for one course module, or null when the pipeline has not created one
yet.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/my/by-course-module/{course_module_id}",
    operation_id = "getMyCreditRegistrationForCourseModule",
    tag = "credit-registrations",
    params(("course_module_id" = Uuid, Path, description = "Course module id")),
    responses(
        (status = 200, description = "The caller's registration for the module", body = Option<MyCreditRegistrationForCourseModule>)
    )
)]
pub async fn get_my_credit_registration_for_course_module(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_module_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Option<MyCreditRegistrationForCourseModule>>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let mut all = build_my_credit_registrations(
        &mut conn,
        user.id,
        StudentRegistrationFilter {
            course_module_id: Some(*course_module_id),
            ..StudentRegistrationFilter::default()
        },
    )
    .await?;
    let live_position = all.iter().position(|row| !row.superseded);
    let res = live_position.map(|position| {
        let registration = all.remove(position);
        MyCreditRegistrationForCourseModule {
            registration,
            earlier_attempts: all,
        }
    });

    token.authorized_ok(web::Json(res))
}

/**
GET `/api/v0/main-frontend/credit-registrations/my/enrolment-banners/by-course/{course_id}` - The
caller's registrations on one course that owe them the in-course re-enrol banner.

Scoped to the course rather than filtered from `/my` on the client, because every course-material page
view calls this. Empty is the normal answer.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/my/enrolment-banners/by-course/{course_id}",
    operation_id = "getMyCreditRegistrationEnrolmentBanners",
    tag = "credit-registrations",
    params(("course_id" = Uuid, Path, description = "Course id")),
    responses(
        (status = 200, description = "The caller's undismissed enrolment banners on the course", body = Vec<MyCreditRegistration>)
    )
)]
pub async fn get_my_credit_registration_enrolment_banners(
    user: AuthUser,
    pool: web::Data<PgPool>,
    course_id: web::Path<Uuid>,
) -> ControllerResult<web::Json<Vec<MyCreditRegistration>>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let res = build_my_credit_registrations(
        &mut conn,
        user.id,
        StudentRegistrationFilter {
            course_id: Some(*course_id),
            enrolment_banner_due: true,
            ..StudentRegistrationFilter::default()
        },
    )
    .await?;

    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/main-frontend/credit-registrations/my/{id}/dismiss-enrolment-banner` - Puts away the
in-course re-enrol banner for one registration.

Idempotent. Not a permanent opt-out: a later entry into the same state clears the dismissal.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/my/{id}/dismiss-enrolment-banner",
    operation_id = "dismissCreditRegistrationEnrolmentBanner",
    tag = "credit-registrations",
    params(("id" = Uuid, Path, description = "Credit registration id")),
    responses(
        (status = 200, description = "The banner is dismissed"),
        (status = 403, description = "Not the caller's registration")
    )
)]
pub async fn dismiss_credit_registration_enrolment_banner(
    user: AuthUser,
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let registration = models::credit_registrations::get_by_id(&mut conn, *id).await?;
    if registration.user_id != user.id {
        return Err(controller_err!(
            Forbidden,
            "Not your registration.".to_string()
        ));
    }
    models::credit_registrations::dismiss_enrolment_banner(&mut conn, registration.id, user.id)
        .await?;

    token.authorized_ok(web::Json(()))
}

/**
POST `/api/v0/main-frontend/credit-registrations/my/{id}/recheck-enrolment` - Asks the pipeline to
look for an enrolment again, for a row parked because the study registry had none.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/my/{id}/recheck-enrolment",
    operation_id = "requestCreditRegistrationEnrolmentRecheck",
    tag = "credit-registrations",
    params(("id" = Uuid, Path, description = "Credit registration id")),
    responses(
        (status = 200, description = "Whether a recheck was started", body = RequestCreditRegistrationEnrolmentRecheckResult),
        (status = 403, description = "Not the caller's registration"),
        (status = 400, description = "The registration is not waiting for an enrolment")
    )
)]
pub async fn request_credit_registration_enrolment_recheck(
    user: AuthUser,
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> ControllerResult<web::Json<RequestCreditRegistrationEnrolmentRecheckResult>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let registration = models::credit_registrations::get_by_id(&mut conn, *id).await?;
    if registration.user_id != user.id {
        return Err(controller_err!(
            Forbidden,
            "Not your registration.".to_string()
        ));
    }
    if registration.state != CreditRegistrationState::NoUsableEnrolment {
        return Err(controller_err!(
            BadRequest,
            "This registration is not waiting for an enrolment.".to_string()
        ));
    }

    let next_allowed = registration
        .enrolment_checked_at
        .map(|checked| checked + chrono::Duration::seconds(ENROLMENT_RECHECK_MIN_INTERVAL_SECS));
    if next_allowed.is_some_and(|allowed| allowed > Utc::now()) {
        return token.authorized_ok(web::Json(RequestCreditRegistrationEnrolmentRecheckResult {
            recheck_started: false,
            next_recheck_allowed_at: next_allowed,
        }));
    }

    let mut tx = conn.begin().await?;
    models::credit_registration_events::insert(
        &mut tx,
        &NewCreditRegistrationEvent {
            actor_user_id: Some(user.id),
            message: Some("The student asked us to look for an enrolment again.".to_string()),
            ..NewCreditRegistrationEvent::new(
                registration.id,
                CreditRegistrationEventKind::StudentAction,
            )
        },
    )
    .await?;
    models::credit_registrations::make_due_now_batch(&mut tx, &[registration.id]).await?;
    recompute_preconditions(
        &mut tx,
        &RegistrationScope {
            credit_registration_ids: vec![registration.id],
            ..RegistrationScope::default()
        },
        PRECONDITIONS_LIMIT,
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(RequestCreditRegistrationEnrolmentRecheckResult {
        recheck_started: true,
        next_recheck_allowed_at: None,
    }))
}

/**
GET `/api/v0/main-frontend/credit-registrations/my/student-number` - The student number linked to the
signed-in account, or null.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    get,
    path = "/my/student-number",
    operation_id = "getMyVerifiedStudentNumber",
    tag = "credit-registrations",
    responses(
        (status = 200, description = "The caller's linked student number", body = Option<MyVerifiedStudentNumber>)
    )
)]
pub async fn get_my_verified_student_number(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<Option<MyVerifiedStudentNumber>>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let res = verified_student_numbers::get_by_user_id(&mut conn, user.id)
        .await?
        .map(to_my_verified_student_number);

    token.authorized_ok(web::Json(res))
}

/**
POST `/api/v0/main-frontend/credit-registrations/my/student-number/dismiss-auto-link-notice` - Puts
away the notice saying the pipeline linked this student number without asking.

Dismissing only hides the notice; the number stays linked and the unlink endpoint stays available.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    post,
    path = "/my/student-number/dismiss-auto-link-notice",
    operation_id = "dismissMyAutoLinkNotice",
    tag = "credit-registrations",
    responses(
        (status = 200, description = "The notice is dismissed")
    )
)]
pub async fn dismiss_my_auto_link_notice(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    verified_student_numbers::dismiss_auto_link_notice(&mut conn, user.id).await?;

    token.authorized_ok(web::Json(()))
}

/**
DELETE `/api/v0/main-frontend/credit-registrations/my/student-number` - Unlinks the student number
from the signed-in account.

Registrations that have not been sent go back to waiting; credits already in Sisu are untouched.
*/
#[instrument(skip(pool))]
#[utoipa::path(
    delete,
    path = "/my/student-number",
    operation_id = "unlinkMyStudentNumber",
    tag = "credit-registrations",
    responses(
        (status = 200, description = "How many registrations went back to waiting", body = UnlinkMyStudentNumberResult)
    )
)]
pub async fn unlink_my_student_number(
    user: AuthUser,
    pool: web::Data<PgPool>,
) -> ControllerResult<web::Json<UnlinkMyStudentNumberResult>> {
    let mut conn = pool.acquire().await?;
    let token = skip_authorize();

    let Some(linked) = verified_student_numbers::get_by_user_id(&mut conn, user.id).await? else {
        return token.authorized_ok(web::Json(UnlinkMyStudentNumberResult {
            affected_registration_count: 0,
        }));
    };

    let mut tx = conn.begin().await?;
    let affected_registration_count = student_number_change::unlink_verified_student_number(
        &mut tx,
        linked.id,
        user.id,
        Some(user.id),
        CreditRegistrationEventKind::StudentAction,
        "The student unlinked their student number.",
    )
    .await?;
    tx.commit().await?;

    token.authorized_ok(web::Json(UnlinkMyStudentNumberResult {
        affected_registration_count,
    }))
}

/**
GET `/api/v0/main-frontend/credit-registrations/student-number-verifications/{token}` - What the
mailed link would link, without linking it.

Writes nothing: the link has to survive a mail scanner fetching it.
*/
#[instrument(skip(pool, path))]
#[utoipa::path(
    get,
    path = "/student-number-verifications/{token}",
    operation_id = "previewStudentNumberVerificationToken",
    tag = "credit-registrations",
    params(("token" = String, Path, description = "The mailed verification token")),
    responses(
        (status = 200, description = "What the token would link", body = StudentNumberVerificationTokenPreview),
        (status = 404, description = "No such token")
    )
)]
pub async fn preview_student_number_verification_token(
    user: AuthUser,
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> ControllerResult<web::Json<StudentNumberVerificationTokenPreview>> {
    let mut conn = pool.acquire().await?;
    let auth_token = skip_authorize();

    let verification_token = get_token_or_404(&mut conn, &path).await?;
    let current_link = verified_student_numbers::get_by_user_id(&mut conn, user.id).await?;
    let conflict = find_conflicting_account(&mut conn, &verification_token, user.id).await?;
    let course_name = course_name_of_token(&mut conn, &verification_token).await?;
    let details = models::user_details::get_user_details_by_user_id(&mut conn, user.id).await?;

    let expired =
        verification_token.expires_at <= Utc::now() || verification_token.deleted_at.is_some();
    let already_used = verification_token.used_at.is_some();

    auth_token.authorized_ok(web::Json(StudentNumberVerificationTokenPreview {
        student_number: verification_token.student_number.clone(),
        first_names: verification_token.first_names.clone(),
        last_name: verification_token.last_name.clone(),
        course_name,
        emailed_to_masked: mask_email(&verification_token.emailed_to),
        expires_at: verification_token.expires_at,
        expired,
        already_used,
        already_used_by_this_account: verification_token.claimed_by_user_id == Some(user.id),
        conflicts_with_other_account: conflict,
        current_student_number: current_link.map(|link| link.student_number),
        target_account_email: details.email,
        claimable: !expired && !already_used && !conflict,
    }))
}

/**
POST `/api/v0/main-frontend/credit-registrations/student-number-verifications/{token}/claim` - Spends
a mailed link and links the student number to the signed-in account.

Any signed-in account may claim any valid token: holding it proves control of the Sisu-held mailbox,
and the session says which of our accounts the person wants to use.
*/
#[instrument(skip(pool, path))]
#[utoipa::path(
    post,
    path = "/student-number-verifications/{token}/claim",
    operation_id = "claimStudentNumberVerificationToken",
    tag = "credit-registrations",
    params(("token" = String, Path, description = "The mailed verification token")),
    responses(
        (status = 200, description = "What the claim did", body = ClaimStudentNumberVerificationTokenResult),
        (status = 404, description = "No such token")
    )
)]
pub async fn claim_student_number_verification_token(
    user: AuthUser,
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> ControllerResult<web::Json<ClaimStudentNumberVerificationTokenResult>> {
    let mut conn = pool.acquire().await?;
    let auth_token = skip_authorize();

    let verification_token = get_token_or_404(&mut conn, &path).await?;
    let refused = |outcome| ClaimStudentNumberVerificationTokenResult {
        outcome,
        student_number: None,
        linked_course_name: None,
        newly_unblocked_registration_count: 0,
    };

    if verification_token.used_at.is_some() {
        return auth_token.authorized_ok(web::Json(refused(
            ClaimStudentNumberVerificationTokenOutcome::AlreadyUsed,
        )));
    }
    if verification_token.expires_at <= Utc::now() || verification_token.deleted_at.is_some() {
        return auth_token.authorized_ok(web::Json(refused(
            ClaimStudentNumberVerificationTokenOutcome::Expired,
        )));
    }
    if find_conflicting_account(&mut conn, &verification_token, user.id).await? {
        return auth_token.authorized_ok(web::Json(refused(
            ClaimStudentNumberVerificationTokenOutcome::StudentNumberAlreadyLinkedToAnotherAccount,
        )));
    }

    let course_name = course_name_of_token(&mut conn, &verification_token).await?;
    let current_link = verified_student_numbers::get_by_user_id(&mut conn, user.id).await?;
    let already_ours = current_link
        .as_ref()
        .is_some_and(|link| link.student_number == verification_token.student_number);

    let mut tx = conn.begin().await?;
    // The atomic single-use guard: two concurrent claims cannot both win here.
    if !student_number_verification_tokens::claim(&mut tx, &verification_token.token, user.id)
        .await?
    {
        tx.rollback().await?;
        return auth_token.authorized_ok(web::Json(refused(
            ClaimStudentNumberVerificationTokenOutcome::AlreadyUsed,
        )));
    }
    if already_ours {
        tx.commit().await?;
        return auth_token.authorized_ok(web::Json(ClaimStudentNumberVerificationTokenResult {
            outcome: ClaimStudentNumberVerificationTokenOutcome::AlreadyLinkedToThisAccount,
            student_number: Some(verification_token.student_number),
            linked_course_name: course_name,
            newly_unblocked_registration_count: 0,
        }));
    }

    // A student who changed programmes has a new number; the old link is retired, not deleted, so the
    // audit trail survives.
    let (_, newly_unblocked_registration_count) =
        verified_student_numbers::replace_verified_student_number(
            &mut tx,
            current_link.map(|link| link.id),
            &NewVerifiedStudentNumber {
                user_id: user.id,
                student_number: verification_token.student_number.clone(),
                sisu_person_id: verification_token.sisu_person_id.clone(),
                first_names: verification_token.first_names.clone(),
                last_name: verification_token.last_name.clone(),
                verified_via: StudentNumberVerificationMethod::EmailedLink,
                verified_via_email: Some(verification_token.emailed_to.clone()),
                verified_via_email_match_field: None,
                account_email_verified_at: None,
                linked_by_user_id: None,
                link_reason: None,
                verified_from_course_id: verification_token.course_id,
            },
            Some(user.id),
            CreditRegistrationEventKind::StudentAction,
            "The student linked a student number.",
        )
        .await?;
    tx.commit().await?;

    auth_token.authorized_ok(web::Json(ClaimStudentNumberVerificationTokenResult {
        outcome: ClaimStudentNumberVerificationTokenOutcome::Linked,
        student_number: Some(verification_token.student_number),
        linked_course_name: course_name,
        newly_unblocked_registration_count,
    }))
}

/// Assembles the wire rows for one account, adding the enrolment link and the linking-mail status the
/// ledger does not carry.
async fn build_my_credit_registrations(
    conn: &mut PgConnection,
    user_id: Uuid,
    filter: StudentRegistrationFilter,
) -> Result<Vec<MyCreditRegistration>, ControllerError> {
    let rows =
        models::credit_registrations::get_student_facing_by_user_id(conn, user_id, filter).await?;

    let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
    let notification_mails = student_notifications::get_for_registrations(conn, &ids).await?;

    let mut enrolment_links: HashMap<String, Option<String>> = HashMap::new();
    let mut linking_mails: Option<LinkingMailCache> = None;
    let mut res = Vec::with_capacity(rows.len());
    for row in rows {
        let state = row.state;
        let status = StudentFacingCreditRegistrationStatus::of(state, row.preconditions());
        let enrolment_link = if status == StudentFacingCreditRegistrationStatus::NeedsEnrolment {
            resolve_enrolment_link(conn, &row, &mut enrolment_links).await?
        } else {
            None
        };
        let linking_email = if status == StudentFacingCreditRegistrationStatus::NeedsStudentNumber {
            resolve_linking_email(conn, user_id, &row, &mut linking_mails).await?
        } else {
            None
        };
        let notification_email =
            NotificationEmailStatus::for_state(state, row.id, &notification_mails);
        res.push(to_my_credit_registration(
            row,
            status,
            enrolment_link,
            linking_email,
            notification_email,
        ));
    }
    Ok(res)
}

fn to_my_credit_registration(
    row: StudentCreditRegistration,
    status: StudentFacingCreditRegistrationStatus,
    enrolment_link: Option<String>,
    linking_email: Option<LinkingEmailStatus>,
    notification_email: Option<NotificationEmailStatus>,
) -> MyCreditRegistration {
    let can_request_enrolment_recheck = row.state == CreditRegistrationState::NoUsableEnrolment
        && row.enrolment_checked_at.is_none_or(|checked| {
            checked + chrono::Duration::seconds(ENROLMENT_RECHECK_MIN_INTERVAL_SECS) <= Utc::now()
        });
    MyCreditRegistration {
        id: row.id,
        course_id: row.course_id,
        course_name: row.course_name,
        course_slug: row.course_slug,
        course_module_id: row.course_module_id,
        course_module_name: row.course_module_name,
        uh_course_code: row.uh_course_code,
        ects_credits: row.ects_credits,
        completion_date: row.completion_date,
        student_facing_status: status,
        registry_already_held_equal_or_better: row.state == CreditRegistrationState::NotImproved,
        status_is_moving: status.is_moving(),
        error_code: row.error_code,
        next_attempt_at: row.next_attempt_at,
        registered_at: row.registered_at,
        sisu_attainment_id: row.sisu_attainment_id,
        grade_id: row.grade_id,
        grade_scale_id: row.grade_scale_id,
        credits: row.credits,
        attempt_number: row.attempt_number,
        superseded: row.superseded_by_id.is_some(),
        can_request_enrolment_recheck,
        enrolment_realisation_name: row.enrolment_realisation_name,
        enrolment_link,
        linking_email,
        notification_email,
    }
}

/// The enrolment page for the module's open university product, cached per product because several of
/// a student's rows can share one.
async fn resolve_enrolment_link(
    conn: &mut PgConnection,
    row: &StudentCreditRegistration,
    cache: &mut HashMap<String, Option<String>>,
) -> Result<Option<String>, ControllerError> {
    let Some(product_id) = row.open_university_product_id.as_ref() else {
        return Ok(None);
    };
    if let Some(cached) = cache.get(product_id) {
        return Ok(cached.clone());
    }
    let link =
        open_university_product_access_tokens::enrolment_url_for_product(conn, Some(product_id))
            .await?;
    cache.insert(product_id.clone(), link.clone());
    Ok(link)
}

/// An account's linking mails and their send status, fetched once per request rather than once per
/// row: they are the same for every one of a student's rows.
struct LinkingMailCache {
    mails: Vec<CreditRegistrationAccountLinkingEmail>,
    reports: HashMap<Uuid, EmailSendStatusReport>,
}

/// The latest linking mail for this account's Sisu person on this course. `None` for an account that
/// was never linked: the mail is addressed to a Sisu person, not to an email address.
async fn resolve_linking_email(
    conn: &mut PgConnection,
    user_id: Uuid,
    row: &StudentCreditRegistration,
    cache: &mut Option<LinkingMailCache>,
) -> Result<Option<LinkingEmailStatus>, ControllerError> {
    if cache.is_none() {
        let mails =
            match verified_student_numbers::get_latest_including_deleted_by_user_id(conn, user_id)
                .await?
            {
                Some(link) => {
                    credit_registration_account_linking_emails::get_by_sisu_person_id(
                        conn,
                        &link.sisu_person_id,
                    )
                    .await?
                }
                None => Vec::new(),
            };
        let ids: Vec<Uuid> = mails.iter().map(|mail| mail.id).collect();
        let reports =
            credit_registration_account_linking_emails::get_send_status_reports(conn, &ids).await?;
        *cache = Some(LinkingMailCache { mails, reports });
    }
    let cache = cache.as_ref().ok_or_else(|| {
        controller_err!(
            InternalServerError,
            "linking mail cache was not populated".to_string()
        )
    })?;
    let Some(mail) = cache
        .mails
        .iter()
        .find(|mail| mail.course_id == row.course_id)
    else {
        return Ok(None);
    };
    let Some(report) = cache.reports.get(&mail.id) else {
        return Ok(None);
    };
    Ok(Some(LinkingEmailStatus {
        email_send_status: report.email_send_status,
        sent_at: report.sent_at,
        emailed_to_masked: mask_email(&mail.emailed_to),
    }))
}

fn to_my_verified_student_number(link: VerifiedStudentNumber) -> MyVerifiedStudentNumber {
    MyVerifiedStudentNumber {
        student_number: link.student_number,
        verified_at: link.verified_at,
        verified_via: link.verified_via,
        verified_via_email_masked: link.verified_via_email.as_deref().map(mask_email),
        first_names: link.first_names,
        last_name: link.last_name,
        linked_automatically: link.verified_via
            == StudentNumberVerificationMethod::EmailMatchFastTrack,
        auto_link_notice_dismissed: link.auto_link_notice_dismissed_at.is_some(),
    }
}

async fn get_token_or_404(
    conn: &mut PgConnection,
    token: &str,
) -> Result<StudentNumberVerificationToken, ControllerError> {
    student_number_verification_tokens::get_by_token_any_state(conn, &DbSecret::new(token))
        .await?
        .ok_or_else(|| controller_err!(NotFound, "Not found.".to_string()))
}

/// Whether the token's holder is already live on some other account of ours.
///
/// Both keys, because both are unique: a student who changed programme keeps their Sisu person id
/// and gets a new number, so checking the number alone lets the claim through and then trips
/// `uq_verified_student_numbers_person` — after the token has been spent, and as a bare 500.
async fn find_conflicting_account(
    conn: &mut PgConnection,
    token: &StudentNumberVerificationToken,
    user_id: Uuid,
) -> Result<bool, ControllerError> {
    let by_number =
        verified_student_numbers::get_by_student_number(conn, &token.student_number).await?;
    if by_number.is_some_and(|link| link.user_id != user_id) {
        return Ok(true);
    }
    let by_person =
        verified_student_numbers::get_by_sisu_person_id(conn, &token.sisu_person_id).await?;
    Ok(by_person.is_some_and(|link| link.user_id != user_id))
}

async fn course_name_of_token(
    conn: &mut PgConnection,
    token: &StudentNumberVerificationToken,
) -> Result<Option<String>, ControllerError> {
    let Some(course_id) = token.course_id else {
        return Ok(None);
    };
    let course = models::courses::get_course(conn, course_id).await?;
    Ok(Some(course.name))
}

/// Keeps the domain and drops the local part: enough to recognise which mailbox to open, not a new
/// disclosure of an address. Teachers get the same masking; only admins see an address in full.
pub(crate) fn mask_email(email: &str) -> String {
    match email.split_once('@') {
        Some((_, domain)) => format!("...@{domain}"),
        None => "...".to_string(),
    }
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/my", web::get().to(get_my_credit_registrations))
        .route(
            "/my/student-number",
            web::get().to(get_my_verified_student_number),
        )
        .route(
            "/my/student-number",
            web::delete().to(unlink_my_student_number),
        )
        .route(
            "/my/student-number/dismiss-auto-link-notice",
            web::post().to(dismiss_my_auto_link_notice),
        )
        .route(
            "/my/by-course-module/{course_module_id}",
            web::get().to(get_my_credit_registration_for_course_module),
        )
        .route(
            "/my/enrolment-banners/by-course/{course_id}",
            web::get().to(get_my_credit_registration_enrolment_banners),
        )
        // `.route(web::post())`, never `.to()`: a resource's default route answers every method, so
        // these mutations would run on a GET a link can trigger with the visitor's session cookie.
        .service(
            web::resource("/my/{id}/recheck-enrolment")
                .wrap(RateLimit::new(RateLimitConfig {
                    per_minute: Some(5),
                    per_hour: Some(30),
                    ..Default::default()
                }))
                .route(web::post().to(request_credit_registration_enrolment_recheck)),
        )
        .service(
            web::resource("/my/{id}/dismiss-enrolment-banner")
                .route(web::post().to(dismiss_credit_registration_enrolment_banner)),
        )
        .route(
            "/student-number-verifications/{token}",
            web::get().to(preview_student_number_verification_token),
        )
        .service(
            web::resource("/student-number-verifications/{token}/claim")
                .wrap(RateLimit::new(RateLimitConfig {
                    per_minute: Some(10),
                    per_hour: Some(60),
                    ..Default::default()
                }))
                .route(web::post().to(claim_student_number_verification_token)),
        );
}
