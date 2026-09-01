//! The fixture identities the credit-registration (Suotar) system tests are built from.
//!
//! The seed writes the database rows and the mock study registry serves the matching registry rows,
//! so neither side owns these: both read them here.
//!
//! Student numbers are `90000SSPP`: `SS` the spec index listed below, `PP` the person within that
//! spec, the leading `9` keeping them clear of real UH numbers. Digits only, 6–12 of them, per
//! `verified_student_numbers.student_number_format`.
//!
//! Account linking and worker ticks are both global — one spec's tick advances every eligible row in
//! the shared database — so two specs sharing a student number would see each other's registration
//! attempts. Each spec under `system-tests/src/tests/credit-registration/` owns one `SS`, and the
//! mock Suotar's persons must reuse the same numbers: 02 `suotar-account-linking`,
//! 03 `suotar-enrolment-problems`, 04 `suotar-import-outcomes`, 05 `suotar-verify-outcomes`,
//! 06 `suotar-sisu-outage`, 08 `suotar-teacher-views`, 09 `suotar-admin-dashboard`,
//! 10 `suotar-old-flow-coexistence`, 11 `suotar-backfill`, 12 `suotar-grade-improvement`,
//! 13 `suotar-student-emails`, 14 `suotar-fast-track-linking`, 15 `suotar-in-course-banner`,
//! 16 `suotar-student-profile`. `01` belongs to no single spec: it holds the linked and unlinked
//! students that read-only specs share. `07` is unused.
//!
//! Names and emails are unlikely strings (`Zzyzx …`) because a spec asserts their absence from the
//! scrubbed Suotar API log.

use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

use super::commands::{
    CourseUnitUpsert, EnrolmentUpsert, PersonUpsert, ProductAccessTokenUpsert, RealisationUpsert,
    WorldPush,
};
use super::ids as mock_ids;
use super::world::{
    CourseBehaviour, CreditRange, DatePeriod, EnrolmentState, LocalizedName, PersonBehaviour,
    RealisationKind, Ripeness, WorldDefaults,
};

/// The course the Suotar specs live on.
pub const SUOTAR_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0001_4a5e_9e6e_c0de00000001);
/// A course left on the legacy open-university pull flow, for the coexistence specs.
pub const OLD_FLOW_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0002_4a5e_9e6e_c0de00000002);
/// Owned by `suotar-import-outcomes.spec.ts`; its modules are the failing shapes.
pub const IMPORT_OUTCOMES_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0004_4a5e_9e6e_c0de00000004);
/// Owned by `suotar-grade-improvement.spec.ts`, and the only graded module here.
pub const GRADE_IMPROVEMENT_COURSE_ID: Uuid =
    Uuid::from_u128(0xc5ed17ea_0005_4a5e_9e6e_c0de00000005);
/// Owned outright by `suotar-backfill.spec.ts`, which flips the Suotar flag on.
pub const BACKFILL_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0003_4a5e_9e6e_c0de00000003);
/// Owned exclusively by `suotar-admin-dashboard.spec.ts`: discovery and the linking mails tick by
/// course, so the spec that ticks them needs a course no other spec has students on.
pub const ADMIN_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0006_4a5e_9e6e_c0de00000006);
/// One frozen ledger row per registration state and per error code, on a paused module. Read by
/// `suotar-teacher-views.spec.ts` and the admin explorer, written by neither.
pub const STATES_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0007_4a5e_9e6e_c0de00000007);
/// Owned by `suotar-teacher-views.spec.ts`'s retry half, and swept by its bulk retry.
pub const RETRY_COURSE_ID: Uuid = Uuid::from_u128(0xc5ed17ea_0009_4a5e_9e6e_c0de00000009);

pub const CRS_101: &str = "CRS-101";
pub const CRS_102: &str = "CRS-102";
pub const CRS_OLD_101: &str = "CRS-OLD-101";
/// The module `suotar-old-flow-coexistence.spec.ts` treats as already cut over: Suotar-enabled, but
/// holding a completion the legacy pull path registered before the cutover happened.
pub const CRS_OLD_102: &str = "CRS-OLD-102";
pub const CRS_BACKFILL_101: &str = "CRS-BACKFILL-101";
pub const CRS_ADMIN_101: &str = "CRS-ADMIN-101";
pub const CRS_STATES_101: &str = "CRS-STATES-101";
pub const CRS_RETRY_101: &str = "CRS-RETRY-101";

pub const CRS_GRADED_101: &str = "CRS-GRADED-101";
/// One module per import failure, each breaking exactly one thing.
pub const CRS_IMPORT_101: &str = "CRS-IMPORT-101";
pub const CRS_IMPORT_102: &str = "CRS-IMPORT-102";
pub const CRS_IMPORT_103: &str = "CRS-IMPORT-103";
pub const CRS_IMPORT_104: &str = "CRS-IMPORT-104";
pub const IMPORT_OUTCOME_COURSE_CODES: [&str; 4] = [
    CRS_IMPORT_101,
    CRS_IMPORT_102,
    CRS_IMPORT_103,
    CRS_IMPORT_104,
];

pub const SUOTAR_COURSE_SLUG: &str = "credit-registration-via-suotar";
pub const OLD_FLOW_COURSE_SLUG: &str = "credit-registration-old-flow";
pub const BACKFILL_COURSE_SLUG: &str = "credit-registration-backfill";
pub const IMPORT_OUTCOMES_COURSE_SLUG: &str = "credit-registration-import-outcomes";
pub const GRADE_IMPROVEMENT_COURSE_SLUG: &str = "credit-registration-grade-improvement";
pub const ADMIN_COURSE_SLUG: &str = "credit-registration-admin";
pub const STATES_COURSE_SLUG: &str = "credit-registration-states";
pub const RETRY_COURSE_SLUG: &str = "credit-registration-retry";

/// A seeded student and the Sisu person the mock must answer with for them. The database rows and
/// the pushed persons must carry the same identifiers, so both are built from here.
pub struct MockPersonFixture {
    pub student_number: &'static str,
    pub first_names: &'static str,
    pub last_name: &'static str,
    /// Where the account-linking mail goes.
    pub sisu_email: &'static str,
    pub account_email: Option<&'static str>,
}

impl MockPersonFixture {
    pub fn sisu_person_id(&self) -> String {
        format!("hy-hlo-{}", self.student_number)
    }
}

/// Linked to its student number from seed time: `suotar-student-profile.spec.ts` reads its linked
/// card.
pub const LINKED_STUDENT: MockPersonFixture = MockPersonFixture {
    student_number: "900000101",
    first_names: "Zzyzx",
    last_name: "Numberlinked",
    sisu_email: "zzyzx.numberlinked@helsinki.example",
    account_email: Some("credit-registration-linked-student@example.com"),
};
/// The twin with no student number linked, enrolled and nothing more.
pub const UNLINKED_STUDENT: MockPersonFixture = MockPersonFixture {
    student_number: "900000102",
    first_names: "Zzyzx",
    last_name: "Linkpending",
    sisu_email: "zzyzx.linkpending@helsinki.example",
    account_email: Some("credit-registration-unlinked-student@example.com"),
};
/// The import that times out. Its own person, so the fault keyed on this student number cannot reach
/// another spec's row on the shared course.
///
/// Has a seeded person but, unlike its `on_crs_101` neighbours, no seeded enrolment: a pre-seeded one
/// would let some other spec's unscoped tick resolve and import the row for real before this one ever
/// arms the `sisuTimeout` fault. Its own spec creates the enrolment atomically with the fault. Keeping
/// the person seeded matters — without it, that same unscoped tick answers `personNotFound`, which
/// drops `verified_student_number` and strands the row in `pending` for good.
pub const IMPORT_TIMEOUT: MockPersonFixture = MockPersonFixture {
    student_number: "900000402",
    first_names: "Zzyzx",
    last_name: "Timedout",
    sisu_email: "zzyzx.timedout@helsinki.example",
    account_email: Some("credit-registration-import-timeout@example.com"),
};
/// The outage spec's own person, so a fault keyed on this student number cannot reach another
/// spec's row on the shared course. Enrolment left unseeded for `IMPORT_TIMEOUT`'s reason: its spec
/// arms the outage before creating the enrolment, so no earlier unscoped sweep can import the row
/// while the study registry is still answering normally.
pub const SISU_OUTAGE: MockPersonFixture = MockPersonFixture {
    student_number: "900000601",
    first_names: "Zzyzx",
    last_name: "Outaged",
    sisu_email: "zzyzx.outaged@helsinki.example",
    account_email: Some("credit-registration-sisu-outage@example.com"),
};
/// Deliberately absent from the mock's enrolments: the only way to reach `no_usable_enrolment`
/// without arming a fault.
pub const NO_ENROLMENT: MockPersonFixture = MockPersonFixture {
    student_number: "900000301",
    first_names: "Zzyzx",
    // Not "Notenrolled": its trigram distance from "notexisting" is close enough to spuriously
    // match search-users.spec.ts's no-such-user search.
    last_name: "Unenrolled",
    sisu_email: "zzyzx.unenrolled@helsinki.example",
    account_email: Some("credit-registration-no-enrolment@example.com"),
};
/// Enrolled on one course twice, through a degree programme and through the open university, so the
/// selection policy has something to choose between.
pub const TWO_ENROLMENTS: MockPersonFixture = MockPersonFixture {
    student_number: "900000302",
    first_names: "Zzyzx",
    last_name: "Twicenrolled",
    sisu_email: "zzyzx.twicenrolled@helsinki.example",
    account_email: Some("credit-registration-two-enrolments@example.com"),
};
pub const VERIFY_POLLING: MockPersonFixture = MockPersonFixture {
    student_number: "900000501",
    first_names: "Zzyzx",
    last_name: "Polling",
    sisu_email: "zzyzx.polling@helsinki.example",
    account_email: Some("credit-registration-verify-polling@example.com"),
};
pub const VERIFY_MISREGISTERED: MockPersonFixture = MockPersonFixture {
    student_number: "900000502",
    first_names: "Zzyzx",
    last_name: "Reversed",
    sisu_email: "zzyzx.reversed@helsinki.example",
    account_email: Some("credit-registration-verify-misregistered@example.com"),
};
pub const ADMIN_UNLINKED: MockPersonFixture = MockPersonFixture {
    student_number: "900000902",
    first_names: "Zzyzx",
    last_name: "Unlinked",
    sisu_email: "zzyzx.unlinked@helsinki.example",
    account_email: Some("credit-registration-admin-unlinked@example.com"),
};
/// Mailed to the cap, never claimed, no account: the stale-address population is the only place the
/// resend and manual-link actions render.
pub const ADMIN_STALE: MockPersonFixture = MockPersonFixture {
    student_number: "900000903",
    first_names: "Zzyzx",
    last_name: "Deadaddress",
    sisu_email: "zzyzx.deadaddress@helsinki.example",
    account_email: None,
};
/// A second capped person on `ADMIN_STALE`'s course, owned by the teacher specs so a cap-refused
/// resend cannot race whichever spec is overriding the cap.
pub const TEACHER_RESEND_CAPPED: MockPersonFixture = MockPersonFixture {
    student_number: "900000804",
    first_names: "Zzyzx",
    last_name: "Cappedmail",
    sisu_email: "zzyzx.cappedmail@helsinki.example",
    account_email: None,
};

pub const ADMIN_LINKED: MockPersonFixture = MockPersonFixture {
    student_number: "900000904",
    first_names: "Zzyzx",
    last_name: "Alreadylinked",
    sisu_email: "zzyzx.alreadylinked@helsinki.example",
    account_email: Some("credit-registration-admin-linked@example.com"),
};

/// Three distinct addresses out of one Sisu address: the dedup key is the address and the cap is
/// three mails per person and course.
pub const MAILED_ADDRESS_SUFFIXES: [&str; 3] = ["", "old.", "older."];

/// Enrolled on a Suotar course and nothing else, for the profile tab's empty state.
pub const PROFILE_EMPTY_EMAIL: &str = "credit-registration-profile-empty@example.com";

/// Claims the seeded linking tokens, and holds no student number of its own: the tokens are unbound
/// and bind to whoever opens the link.
pub const LINK_CLAIMER_EMAIL: &str = "credit-registration-link-claimer@example.com";
pub const LINK_VALID: MockPersonFixture = MockPersonFixture {
    student_number: "900000201",
    first_names: "Zzyzx",
    last_name: "Linkvalid",
    sisu_email: "zzyzx.linkvalid@helsinki.example",
    account_email: None,
};
pub const LINK_EXPIRED: MockPersonFixture = MockPersonFixture {
    student_number: "900000202",
    first_names: "Zzyzx",
    last_name: "Linkexpired",
    sisu_email: "zzyzx.linkexpired@helsinki.example",
    account_email: None,
};
pub const LINK_USED: MockPersonFixture = MockPersonFixture {
    student_number: "900000203",
    first_names: "Zzyzx",
    last_name: "Linkused",
    sisu_email: "zzyzx.linkused@helsinki.example",
    account_email: None,
};
pub const SUPERSEDED: MockPersonFixture = MockPersonFixture {
    student_number: "900000901",
    first_names: "Zzyzx",
    last_name: "Regraded",
    sisu_email: "zzyzx.regraded@helsinki.example",
    account_email: Some("credit-registration-superseded@example.com"),
};
/// Its Sisu address equals the account address, which is what the fast track fires on; the twin
/// below differs only in the account's verification flag.
pub const FAST_TRACK_VERIFIED: MockPersonFixture = MockPersonFixture {
    student_number: "900001401",
    first_names: "Zzyzx",
    last_name: "Fasttrack",
    sisu_email: "credit-registration-verified-email@example.com",
    account_email: Some("credit-registration-verified-email@example.com"),
};
pub const FAST_TRACK_TWIN: MockPersonFixture = MockPersonFixture {
    student_number: "900001402",
    first_names: "Zzyzx",
    last_name: "Nearmiss",
    sisu_email: "credit-registration-unverified-twin@example.com",
    account_email: Some("credit-registration-unverified-twin@example.com"),
};
/// Verified far outside the recency window: a deprovisioned university address can be reissued, and
/// the account holding it would still look verified.
pub const FAST_TRACK_STALE: MockPersonFixture = MockPersonFixture {
    student_number: "900001403",
    first_names: "Zzyzx",
    last_name: "Staleproof",
    sisu_email: "credit-registration-stale-proof@example.com",
    account_email: Some("credit-registration-stale-proof@example.com"),
};
/// The recycled-address signal: the address is proved, but the account belongs to somebody else.
/// `seed_fast_track_near_misses` gives its account a name unlike the registry's.
pub const FAST_TRACK_NAME_MISMATCH: MockPersonFixture = MockPersonFixture {
    student_number: "900001404",
    first_names: "Zzyzx",
    last_name: "Registryname",
    sisu_email: "credit-registration-name-mismatch@example.com",
    account_email: Some("credit-registration-name-mismatch@example.com"),
};
/// Its account already holds [`FAST_TRACK_OTHER_NUMBER`], so swapping it belongs behind the mailed
/// link's confirmation screen, which names both numbers.
pub const FAST_TRACK_HAS_NUMBER: MockPersonFixture = MockPersonFixture {
    student_number: "900001405",
    first_names: "Zzyzx",
    last_name: "Alreadynumbered",
    sisu_email: "credit-registration-has-number@example.com",
    account_email: Some("credit-registration-has-number@example.com"),
};
/// Not on any roster: only the account's existing link needs it to exist.
pub const FAST_TRACK_OTHER_NUMBER: &str = "900001495";
/// `mock_suotar_world` moves its account address to the registry's *secondary* field, which is
/// self-entered there and therefore never proof.
pub const FAST_TRACK_SECONDARY_ONLY: MockPersonFixture = MockPersonFixture {
    student_number: "900001406",
    first_names: "Zzyzx",
    last_name: "Secondonly",
    sisu_email: "zzyzx.secondonly@helsinki.example",
    account_email: Some("credit-registration-secondary-only@example.com"),
};
/// A confirmed account whose address the registry simply does not hold. The population the linking
/// mail exists for, and the regression that matters most: it must still be mailed.
pub const FAST_TRACK_NO_MATCH: MockPersonFixture = MockPersonFixture {
    student_number: "900001407",
    first_names: "Zzyzx",
    last_name: "Othermailbox",
    sisu_email: "zzyzx.othermailbox@helsinki.example",
    account_email: Some("credit-registration-fast-track-no-match@example.com"),
};

/// Absent from the mock's enrolments, like `NO_ENROLMENT`, so its row parks where the in-course
/// re-enrol banner shows. Its spec only reads and dismisses, so the row stays parked.
pub const BANNER_STUCK: MockPersonFixture = MockPersonFixture {
    student_number: "900001501",
    first_names: "Zzyzx",
    last_name: "Bannerstuck",
    sisu_email: "zzyzx.bannerstuck@helsinki.example",
    account_email: Some("credit-registration-banner-stuck@example.com"),
};
/// Its own person, because its spec creates the enrolment that makes the banner go away and that
/// must not clear another spec's banner.
pub const BANNER_REENROLS: MockPersonFixture = MockPersonFixture {
    student_number: "900001502",
    first_names: "Zzyzx",
    last_name: "Bannerreenrols",
    sisu_email: "zzyzx.bannerreenrols@helsinki.example",
    account_email: Some("credit-registration-banner-reenrols@example.com"),
};

/// Driven all the way to `registered`, which is what earns the "your credits are in Sisu" mail.
pub const EMAILS_REGISTERED: MockPersonFixture = MockPersonFixture {
    student_number: "900001301",
    first_names: "Zzyzx",
    last_name: "Mailedsuccess",
    sisu_email: "zzyzx.mailedsuccess@helsinki.example",
    account_email: Some("credit-registration-emails-registered@example.com"),
};
/// Deliberately absent from the mock's enrolments, like `NO_ENROLMENT`, so its row parks at
/// `no_usable_enrolment` and earns the action-needed mail without arming a fault.
pub const EMAILS_NO_ENROLMENT: MockPersonFixture = MockPersonFixture {
    student_number: "900001302",
    first_names: "Zzyzx",
    last_name: "Mailedaction",
    sisu_email: "zzyzx.mailedaction@helsinki.example",
    account_email: Some("credit-registration-emails-no-enrolment@example.com"),
};

pub const IMPORT_OUTCOMES: MockPersonFixture = MockPersonFixture {
    student_number: "900000401",
    first_names: "Zzyzx",
    last_name: "Importoutcomes",
    sisu_email: "zzyzx.importoutcomes@helsinki.example",
    account_email: Some("credit-registration-import-outcomes@example.com"),
};
pub const GRADE_IMPROVEMENT: MockPersonFixture = MockPersonFixture {
    student_number: "900001201",
    first_names: "Zzyzx",
    last_name: "Improved",
    sisu_email: "zzyzx.improved@helsinki.example",
    account_email: Some("credit-registration-grade-improvement@example.com"),
};

pub const BACKFILL_STUDENTS: [MockPersonFixture; 4] = [
    MockPersonFixture {
        student_number: "900001101",
        first_names: "Zzyzx",
        last_name: "Backfill1",
        sisu_email: "zzyzx.backfill1@helsinki.example",
        account_email: Some("credit-registration-backfill-1@example.com"),
    },
    MockPersonFixture {
        student_number: "900001102",
        first_names: "Zzyzx",
        last_name: "Backfill2",
        sisu_email: "zzyzx.backfill2@helsinki.example",
        account_email: Some("credit-registration-backfill-2@example.com"),
    },
    MockPersonFixture {
        student_number: "900001103",
        first_names: "Zzyzx",
        last_name: "Backfill3",
        sisu_email: "zzyzx.backfill3@helsinki.example",
        account_email: Some("credit-registration-backfill-3@example.com"),
    },
    MockPersonFixture {
        student_number: "900001104",
        first_names: "Zzyzx",
        last_name: "Backfill4",
        sisu_email: "zzyzx.backfill4@helsinki.example",
        account_email: Some("credit-registration-backfill-4@example.com"),
    },
];

/// The world the mock Suotar serves, built from the same fixtures the database rows above are.
///
/// Pure and pool-free on purpose: the restore-from-template setup path runs no seed and has the mock
/// install this lazily instead, so both setup scripts hand the suite the same fixtures.
pub fn mock_suotar_world() -> WorldPush {
    let now = Utc::now();
    let wide = DatePeriod {
        start_date: (now - Duration::days(730)).date_naive(),
        end_date: (now + Duration::days(730)).date_naive(),
    };
    let past = DatePeriod {
        start_date: (now - Duration::days(900)).date_naive(),
        end_date: (now - Duration::days(800)).date_naive(),
    };

    let on_crs_101 = [
        &LINKED_STUDENT,
        &UNLINKED_STUDENT,
        &LINK_VALID,
        &LINK_EXPIRED,
        &LINK_USED,
        &SUPERSEDED,
        &FAST_TRACK_VERIFIED,
        &FAST_TRACK_TWIN,
        &FAST_TRACK_STALE,
        &FAST_TRACK_NAME_MISMATCH,
        &FAST_TRACK_HAS_NUMBER,
        &FAST_TRACK_SECONDARY_ONLY,
        &FAST_TRACK_NO_MATCH,
        &IMPORT_TIMEOUT,
        &SISU_OUTAGE,
        &TWO_ENROLMENTS,
        &VERIFY_POLLING,
        &VERIFY_MISREGISTERED,
        &EMAILS_REGISTERED,
    ];
    let on_crs_admin_101 = [
        &ADMIN_UNLINKED,
        &ADMIN_STALE,
        &ADMIN_LINKED,
        &TEACHER_RESEND_CAPPED,
    ];

    let mut persons: Vec<PersonUpsert> = on_crs_101.iter().map(|f| person(f)).collect();
    persons.extend(on_crs_admin_101.iter().map(|f| {
        let mut upsert = person(f);
        // Sisu's live address must differ from the mailed history below, or a resend hits the
        // dedup guard (already mailed this address) before it ever reaches the cap it exists to
        // demonstrate.
        if f.student_number == ADMIN_STALE.student_number
            || f.student_number == TEACHER_RESEND_CAPPED.student_number
        {
            upsert.primary_email = format!("current.{}", f.sisu_email);
        }
        upsert
    }));
    for upsert in &mut persons {
        // The one fixture whose account address is on the registry's secondary field. The mail still
        // goes to both addresses; only the fast track's proof is primary-only.
        if upsert.student_number == FAST_TRACK_SECONDARY_ONLY.student_number {
            upsert.secondary_email = FAST_TRACK_SECONDARY_ONLY.account_email.map(str::to_string);
        }
    }
    persons.push(person(&NO_ENROLMENT));
    persons.push(person(&EMAILS_NO_ENROLMENT));
    persons.push(person(&BANNER_STUCK));
    persons.push(person(&BANNER_REENROLS));
    persons.push(person(&IMPORT_OUTCOMES));
    persons.push(person(&GRADE_IMPROVEMENT));
    persons.extend(BACKFILL_STUDENTS.iter().map(person));

    let mut enrolments: Vec<EnrolmentUpsert> = on_crs_101
        .iter()
        // Like `NO_ENROLMENT`, minus the person: these two specs create their own enrolment, so no
        // earlier, unscoped resolve-enrolments sweep can resolve it before their fault is armed.
        .filter(|fixture| {
            fixture.student_number != IMPORT_TIMEOUT.student_number
                && fixture.student_number != SISU_OUTAGE.student_number
        })
        .map(|fixture| enrolment(fixture, CRS_101, RealisationKind::Degree, wide.clone(), now))
        .collect();
    enrolments.extend(BACKFILL_STUDENTS.iter().map(|fixture| {
        enrolment(
            fixture,
            CRS_BACKFILL_101,
            RealisationKind::Degree,
            wide.clone(),
            now,
        )
    }));
    enrolments.extend(IMPORT_OUTCOME_COURSE_CODES.iter().map(|course_code| {
        EnrolmentUpsert {
            // The plain (student, kind) id would collide across all four: one student enrolled in
            // four realisations of the same kind at once.
            id: Some(mock_ids::enrolment_id_for_course(
                IMPORT_OUTCOMES.student_number,
                course_code,
                RealisationKind::Degree,
            )),
            ..enrolment(
                &IMPORT_OUTCOMES,
                course_code,
                RealisationKind::Degree,
                wide.clone(),
                now,
            )
        }
    }));
    enrolments.push(enrolment(
        &GRADE_IMPROVEMENT,
        CRS_GRADED_101,
        RealisationKind::Degree,
        wide.clone(),
        now,
    ));
    enrolments.extend(on_crs_admin_101.iter().map(|fixture| {
        enrolment(
            fixture,
            CRS_ADMIN_101,
            RealisationKind::Degree,
            wide.clone(),
            now,
        )
    }));
    enrolments.push(enrolment(
        &TWO_ENROLMENTS,
        CRS_101,
        RealisationKind::OpenUniversity,
        wide.clone(),
        now,
    ));

    let import_outcomes = [
        CourseUnitShape {
            import_allowed: false,
            ..CourseUnitShape::new(CRS_IMPORT_101, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
        CourseUnitShape {
            credits: Some(CreditRange { min: 1.0, max: 1.0 }),
            ..CourseUnitShape::new(CRS_IMPORT_102, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
        CourseUnitShape {
            activity_period: Some(past),
            ..CourseUnitShape::new(CRS_IMPORT_103, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
        CourseUnitShape {
            acceptor: false,
            ..CourseUnitShape::new(CRS_IMPORT_104, IMPORT_OUTCOMES_COURSE_SLUG, 5.0)
        },
    ];

    let mut course_units = vec![
        CourseUnitShape {
            kinds: &[RealisationKind::Degree, RealisationKind::OpenUniversity],
            ..CourseUnitShape::new(CRS_101, SUOTAR_COURSE_SLUG, 5.0)
        }
        .build(&wide),
        CourseUnitShape::new(CRS_102, SUOTAR_COURSE_SLUG, 3.0).build(&wide),
        CourseUnitShape {
            kinds: &[RealisationKind::OpenUniversity],
            ..CourseUnitShape::new(CRS_OLD_101, OLD_FLOW_COURSE_SLUG, 5.0)
        }
        .build(&wide),
        CourseUnitShape::new(CRS_BACKFILL_101, BACKFILL_COURSE_SLUG, 5.0).build(&wide),
        CourseUnitShape {
            kinds: &[RealisationKind::Degree, RealisationKind::OpenUniversity],
            ..CourseUnitShape::new(CRS_ADMIN_101, ADMIN_COURSE_SLUG, 5.0)
        }
        .build(&wide),
        CourseUnitShape::new(CRS_STATES_101, STATES_COURSE_SLUG, 5.0).build(&wide),
        CourseUnitShape::new(CRS_RETRY_101, RETRY_COURSE_SLUG, 5.0).build(&wide),
        // Every other module is pass/fail, so grade improvement needs a graded one.
        CourseUnitShape {
            grade_scale_id: "sis-0-5",
            ..CourseUnitShape::new(CRS_GRADED_101, GRADE_IMPROVEMENT_COURSE_SLUG, 5.0)
        }
        .build(&wide),
    ];
    course_units.extend(import_outcomes.into_iter().map(|shape| shape.build(&wide)));

    WorldPush {
        defaults: Some(WorldDefaults {
            ripeness: Ripeness::Manual,
            ..WorldDefaults::default()
        }),
        persons,
        course_units,
        enrolments,
        attainments: Vec::new(),
        submissions: Vec::new(),
        product_tokens: vec![
            product_token(CRS_101),
            product_token(CRS_OLD_101),
            product_token(CRS_ADMIN_101),
        ],
    }
}

fn person(fixture: &MockPersonFixture) -> PersonUpsert {
    PersonUpsert {
        student_number: fixture.student_number.to_string(),
        person_id: Some(fixture.sisu_person_id()),
        first_names: fixture.first_names.to_string(),
        last_name: fixture.last_name.to_string(),
        primary_email: fixture.sisu_email.to_string(),
        secondary_email: None,
        behaviour: PersonBehaviour::default(),
        owner_user_email: fixture.account_email.map(str::to_string),
    }
}

fn enrolment(
    fixture: &MockPersonFixture,
    course_code: &str,
    kind: RealisationKind,
    validity: DatePeriod,
    enrolled_at: DateTime<Utc>,
) -> EnrolmentUpsert {
    EnrolmentUpsert {
        id: None,
        student_number: fixture.student_number.to_string(),
        course_code: course_code.to_string(),
        realisation_id: None,
        kind,
        state: EnrolmentState::Enrolled,
        study_right_id: None,
        study_right_validity_period: validity,
        enrolment_date_time: Some(enrolled_at),
    }
}

/// What the mock's realisation for one module looks like. The defaults are the working shape; the
/// import-outcomes modules each break exactly one of them.
struct CourseUnitShape<'a> {
    course_code: &'a str,
    course_slug: &'a str,
    ects: f64,
    kinds: &'a [RealisationKind],
    grade_scale_id: &'a str,
    credits: Option<CreditRange>,
    activity_period: Option<DatePeriod>,
    acceptor: bool,
    import_allowed: bool,
}

impl<'a> CourseUnitShape<'a> {
    fn new(course_code: &'a str, course_slug: &'a str, ects: f64) -> Self {
        Self {
            course_code,
            course_slug,
            ects,
            kinds: &[RealisationKind::Degree],
            grade_scale_id: "sis-hyl-hyv",
            credits: None,
            activity_period: None,
            acceptor: true,
            import_allowed: true,
        }
    }

    fn build(self, activity_period: &DatePeriod) -> CourseUnitUpsert {
        let name = LocalizedName {
            fi: self.course_code.to_string(),
            sv: self.course_code.to_string(),
            en: self.course_code.to_string(),
        };
        CourseUnitUpsert {
            course_code: self.course_code.to_string(),
            course_unit_id: None,
            name: Some(name),
            realisations: self
                .kinds
                .iter()
                .map(|kind| RealisationUpsert {
                    id: None,
                    name: None,
                    assessment_item_id: None,
                    kind: *kind,
                    activity_period: self
                        .activity_period
                        .clone()
                        .unwrap_or_else(|| activity_period.clone()),
                    grade_scale_id: self.grade_scale_id.to_string(),
                    credits: self.credits.clone().unwrap_or(CreditRange {
                        min: self.ects,
                        max: self.ects,
                    }),
                    acceptor_person_id: self.acceptor.then(|| "hy-hlo-acceptor".to_string()),
                    open_university_product_id: match kind {
                        RealisationKind::OpenUniversity => Some(product_id(self.course_code)),
                        RealisationKind::Degree => None,
                    },
                })
                .collect(),
            behaviour: CourseBehaviour {
                import_allowed: self.import_allowed,
            },
            owner_course_slug: Some(self.course_slug.to_string()),
        }
    }
}

fn product_token(course_code: &str) -> ProductAccessTokenUpsert {
    ProductAccessTokenUpsert {
        open_university_product_id: product_id(course_code),
        id: None,
        access_token: None,
        state: None,
        document_state: None,
    }
}

pub fn product_id(course_code: &str) -> String {
    format!("otm-product-{}", course_code.to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A world that does not hang together surfaces as confusing Playwright failures elsewhere.
    #[test]
    fn the_pushed_world_is_internally_consistent() {
        let world = mock_suotar_world();
        let scales = world
            .defaults
            .as_ref()
            .map(|defaults| defaults.grade_scales.clone())
            .unwrap_or_default();
        let product_ids: Vec<&String> = world
            .product_tokens
            .iter()
            .map(|token| &token.open_university_product_id)
            .collect();

        for unit in &world.course_units {
            for realisation in &unit.realisations {
                assert!(
                    scales
                        .iter()
                        .any(|scale| scale.answers_to(&realisation.grade_scale_id)),
                    "{} names an unknown grade scale {}",
                    unit.course_code,
                    realisation.grade_scale_id
                );
                if let Some(product_id) = &realisation.open_university_product_id {
                    assert!(
                        product_ids.contains(&product_id),
                        "{} references a product token that was not pushed: {product_id}",
                        unit.course_code
                    );
                }
            }
        }

        for enrolment in &world.enrolments {
            assert!(
                world
                    .persons
                    .iter()
                    .any(|person| person.student_number == enrolment.student_number),
                "enrolment for an unpushed person {}",
                enrolment.student_number
            );
            let unit = world
                .course_units
                .iter()
                .find(|unit| unit.course_code == enrolment.course_code)
                .unwrap_or_else(|| {
                    panic!("enrolment on an unpushed course {}", enrolment.course_code)
                });
            assert!(
                unit.realisations
                    .iter()
                    .any(|realisation| realisation.kind == enrolment.kind),
                "{} has no {:?} realisation for {} to enrol on",
                unit.course_code,
                enrolment.kind,
                enrolment.student_number
            );
        }
    }
}
