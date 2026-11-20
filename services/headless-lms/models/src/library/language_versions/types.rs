//! Request and response types of the language-version repair tool's API.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use utoipa::ToSchema;

use crate::prelude::*;

/// A course in, or a candidate for, a course language group, with the counts the tool shows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct LanguageVersionCourse {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub language_code: String,
    pub course_language_group_id: Uuid,
    pub is_draft: bool,
    pub created_at: DateTime<Utc>,
    /// Live chapters, pages and exercises.
    pub chapter_count: i64,
    pub page_count: i64,
    pub exercise_count: i64,
    /// Users whose enrolment settings point at this course. Counted only where the tool shows it:
    /// the report, join candidates and join and split previews.
    pub student_count: Option<i64>,
    /// Whether the requesting user may edit this course; fixes involving it are disabled otherwise.
    pub can_edit: bool,
}

/// A page as the tool shows and matches it. Deleted pages appear only in leftover links.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct LanguageVersionPage {
    pub id: Uuid,
    pub course_id: Uuid,
    pub language_code: String,
    pub title: String,
    pub url_path: String,
    pub chapter_id: Option<Uuid>,
    /// `None` for pages outside chapters (e.g. the course front page).
    pub chapter_number: Option<i32>,
    pub chapter_name: Option<String>,
    /// 1-based position among the live pages of the chapter (or of the pages outside chapters).
    pub position: i32,
    pub is_chapter_front_page: bool,
    pub page_language_group_id: Option<Uuid>,
    pub exercise_count: i64,
    pub is_deleted: bool,
}

/// An exercise as the tool shows and matches it. Deleted exercises appear only in leftover links.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct LanguageVersionExercise {
    pub id: Uuid,
    pub course_id: Uuid,
    pub language_code: String,
    pub name: String,
    pub page_id: Uuid,
    pub page_title: String,
    pub chapter_number: Option<i32>,
    /// 1-based position among the live exercises of the page.
    pub position: i32,
    /// Distinct exercise service slugs of the exercise's tasks, e.g. `quizzes`.
    pub exercise_types: Vec<String>,
    pub exercise_language_group_id: Option<Uuid>,
    pub is_deleted: bool,
}

/// A chapter of one language version. Chapters have no link of their own; they correspond by number.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct LanguageVersionChapter {
    pub id: Uuid,
    pub course_id: Uuid,
    pub chapter_number: i32,
    pub name: String,
    pub page_count: i64,
}

/// How urgent a problem is; the report groups problems by this.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum LanguageVersionProblemSeverity {
    /// Students already get a wrong or missing language switch.
    AffectsStudents,
    ShouldFix,
    /// Often deliberate; the teacher can mark it as intended.
    CheckIntended,
}

/// One detected problem in a course language group.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct LanguageVersionProblem {
    /// Stable identity of the problem across checks, used for dismissals.
    pub key: String,
    /// Changes whenever the rows behind the problem change, so a dismissed problem comes back.
    pub fingerprint: String,
    pub severity: LanguageVersionProblemSeverity,
    pub kind: LanguageVersionProblemKind,
    /// Set when the teacher marked this problem, in its current state, as intended.
    pub dismissal: Option<ProblemDismissal>,
}

/// What is wrong, with the rows the fix dialog shows.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum LanguageVersionProblemKind {
    /// Pages of `course_id` with no counterpart in `counterpart_course_id`.
    MissingPageCounterpart {
        course_id: Uuid,
        counterpart_course_id: Uuid,
        pages: Vec<LanguageVersionPage>,
    },
    /// Several pages of `course_id` are linked to the same pages, so the switcher picks one at random.
    DuplicatePagesInGroup {
        course_id: Uuid,
        /// The competing pages of `course_id`.
        pages: Vec<LanguageVersionPage>,
        /// Their counterparts in the other language versions.
        linked_pages: Vec<LanguageVersionPage>,
        /// The page to keep linked, if one stands out.
        suggested_page_id: Option<Uuid>,
        suggestion_reason: Option<SuggestionReason>,
    },
    /// A page is also linked to a page of a course outside the language versions; students never use it.
    ForeignCourseLink {
        page: LanguageVersionPage,
        foreign_page: LanguageVersionPage,
        foreign_course_name: String,
        /// Counterparts within the language versions, which stay linked after the fix.
        linked_pages: Vec<LanguageVersionPage>,
    },
    /// An exercise's counterpart is not on the counterpart of the exercise's page.
    ExerciseCounterpartOnOtherPage {
        exercise: LanguageVersionExercise,
        counterpart: LanguageVersionExercise,
        /// The counterpart of the exercise's page in the counterpart's course, if linked.
        expected_page: Option<LanguageVersionPage>,
    },
    /// Exercises of `course_id` with no counterpart in any language.
    UnlinkedExercises {
        course_id: Uuid,
        exercise_count: i64,
        /// How many of them have a suggested counterpart (GET /suggestions).
        suggestion_count: i64,
    },
    /// Links whose other end is a deleted page or exercise.
    LeftoverLinks {
        pages: Vec<LeftoverPageLink>,
        exercises: Vec<LeftoverExerciseLink>,
    },
    /// Several exercises of `course_id` are linked to the same exercises.
    DuplicateExercisesInGroup {
        course_id: Uuid,
        exercises: Vec<LanguageVersionExercise>,
        linked_exercises: Vec<LanguageVersionExercise>,
    },
    /// Courses outside the language versions that look like translations of this course.
    LikelySeparateLanguageVersions { candidates: Vec<JoinCandidate> },
    /// Linked pages are in a different order in `course_id` than in the other language versions.
    PageOrderDiffers {
        course_id: Uuid,
        chapter_number: i32,
        chapter_name: String,
        /// Only the pages whose position differs.
        pages: Vec<PagePositionDifference>,
    },
    /// Some language versions lack chapter numbers that others have.
    ChapterCountDiffers {
        missing_chapters: Vec<MissingChapterNumbers>,
    },
    /// Linked pages sit in chapters with different numbers.
    PageInOtherChapterNumber {
        course_id: Uuid,
        counterpart_course_id: Uuid,
        pages: Vec<LinkedPagePair>,
    },
    /// Exercises of `course_id` that are linked in some languages but have no counterpart in
    /// `counterpart_course_id`. Exercises linked to nothing are [Self::UnlinkedExercises].
    MissingExerciseCounterparts {
        course_id: Uuid,
        counterpart_course_id: Uuid,
        exercises: Vec<LanguageVersionExercise>,
    },
}

/// A live page still linked to a deleted page.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct LeftoverPageLink {
    pub page: LanguageVersionPage,
    pub deleted_page: LanguageVersionPage,
}

/// A live exercise still linked to a deleted exercise.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct LeftoverExerciseLink {
    pub exercise: LanguageVersionExercise,
    pub deleted_exercise: LanguageVersionExercise,
}

/// A page whose position differs from its counterparts' position.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct PagePositionDifference {
    pub page: LanguageVersionPage,
    /// The position its counterparts have in the other language versions.
    pub reference_position: i32,
}

/// Chapter numbers a language version lacks.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct MissingChapterNumbers {
    pub course_id: Uuid,
    pub chapter_numbers: Vec<i32>,
}

/// Two linked pages.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct LinkedPagePair {
    pub page: LanguageVersionPage,
    pub counterpart: LanguageVersionPage,
}

/// The result of checking a course language group (GET /report).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct LanguageVersionReport {
    pub course_language_group_id: Uuid,
    pub courses: Vec<LanguageVersionCourse>,
    /// False when the user lacks edit rights on some course; the UI then shows the report read-only.
    pub can_edit_all_courses: bool,
    /// Dismissed problems are included with `dismissal` set.
    pub problems: Vec<LanguageVersionProblem>,
    /// Courses with an open agent changeset, whose staged changes the fixes don't see.
    pub courses_with_open_agent_changesets: Vec<Uuid>,
    pub checked_at: DateTime<Utc>,
}

/// The language versions side by side, chapters matched by number and pages by their links
/// (GET /structure).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct LanguageVersionStructure {
    pub courses: Vec<LanguageVersionCourse>,
    /// Ordered by chapter number; pages outside chapters come first.
    pub chapters: Vec<StructureChapterRow>,
}

/// One chapter number across the language versions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct StructureChapterRow {
    /// `None` for the pages outside chapters.
    pub chapter_number: Option<i32>,
    /// The chapter of each language version that has this number.
    pub chapters: Vec<LanguageVersionChapter>,
    /// Ordered by the position in this course, then the others.
    pub rows: Vec<StructurePageRow>,
}

/// Linked pages, at most one per language version. A course without a page here has none.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct StructurePageRow {
    pub pages: Vec<StructurePage>,
    /// Exercises of these pages, linked ones on the same row.
    pub exercise_rows: Vec<StructureExerciseRow>,
}

/// A page in the structure comparison.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct StructurePage {
    pub page: LanguageVersionPage,
    pub notes: Vec<StructureNote>,
}

/// Something the structure comparison highlights on a page.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum StructureNote {
    DifferentPosition {
        reference_position: i32,
    },
    InOtherChapterNumber {
        reference_chapter_number: i32,
    },
    /// Linked to the same pages as `other_page_id` of the same course; shown on its own row.
    DuplicateInGroup {
        other_page_id: Uuid,
    },
    ForeignCourseLink,
    ExercisesOnOtherPage {
        exercise_count: i64,
    },
}

/// Linked exercises, at most one per language version.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct StructureExerciseRow {
    pub exercises: Vec<StructureExercise>,
}

/// An exercise in the structure comparison.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct StructureExercise {
    pub exercise: LanguageVersionExercise,
    /// Whether it is on another page than the row's page of its course.
    pub is_on_other_page: bool,
}

/// How sure a suggestion is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SuggestionSureness {
    /// Pre-accepted in the guided flow.
    VerySure,
    Likely,
    Unsure,
}

/// Why the tool suggests a counterpart.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SuggestionReason {
    AlreadyLinked,
    /// One was copied from the other, or both from the same original.
    CopyHistory,
    SamePositionAndExerciseCount,
    SamePosition,
    /// Exercises: same position on linked pages and the same exercise types.
    SamePositionAndExerciseTypes,
}

/// Suggested counterparts for this course's pages and exercises (GET /suggestions).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct LinkSuggestions {
    /// The courses the suggestions cover: the language versions plus any requested candidates.
    pub courses: Vec<LanguageVersionCourse>,
    /// One row per page of this course, in structure order.
    pub pages: Vec<PageLinkSuggestion>,
    /// One row per exercise of this course. Matched within linked or suggested page pairs, so a
    /// row whose page pair the teacher changes may need a manual pick.
    pub exercises: Vec<ExerciseLinkSuggestion>,
    /// Pages of the other courses that no row links or suggests.
    pub unmatched_pages: Vec<LanguageVersionPage>,
    pub unmatched_exercises: Vec<LanguageVersionExercise>,
}

/// A page of this course and its counterpart in each other course.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PageLinkSuggestion {
    pub reference: LanguageVersionPage,
    /// One entry per other course.
    pub counterparts: Vec<SuggestedPageCounterpart>,
}

/// The current or suggested counterpart of a page in one course.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SuggestedPageCounterpart {
    pub course_id: Uuid,
    /// `None` when there is neither a link nor a suggestion.
    pub page: Option<LanguageVersionPage>,
    /// Already linked; nothing to accept.
    pub is_linked: bool,
    pub sureness: Option<SuggestionSureness>,
    pub reason: Option<SuggestionReason>,
    /// Other pages of the course in the same chapter number, for "Choose another page".
    pub alternatives: Vec<LanguageVersionPage>,
}

/// An exercise of this course and its counterpart in each other course.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ExerciseLinkSuggestion {
    pub reference: LanguageVersionExercise,
    pub counterparts: Vec<SuggestedExerciseCounterpart>,
}

/// The current or suggested counterpart of an exercise in one course.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SuggestedExerciseCounterpart {
    pub course_id: Uuid,
    pub exercise: Option<LanguageVersionExercise>,
    pub is_linked: bool,
    /// The linked exercise is not on the counterpart of the reference's page.
    pub is_on_other_page: bool,
    pub sureness: Option<SuggestionSureness>,
    pub reason: Option<SuggestionReason>,
    /// Other exercises on the counterpart page, for "Choose another exercise".
    pub alternatives: Vec<LanguageVersionExercise>,
}

/// One change to page or exercise links.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum CounterpartLinkChange {
    /// Makes exactly these pages (or exercises), at most one per language version, counterparts of
    /// each other. Their previous counterparts that are not listed stay linked to one another.
    Link { ids: Vec<Uuid> },
    /// Leaves the page (or exercise) without counterparts. Content does not change.
    Unlink { id: Uuid },
}

/// Body of POST /page-links and /exercise-links. Applied in one transaction, in order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct CounterpartLinksRequest {
    pub changes: Vec<CounterpartLinkChange>,
}

/// What POST /page-links or /exercise-links changed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct CounterpartLinksResult {
    pub linked_count: i64,
    pub unlinked_count: i64,
}

/// Body of POST /remove-leftover-links: the deleted pages and exercises whose links to remove.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct RemoveLeftoverLinksRequest {
    pub deleted_page_ids: Vec<Uuid>,
    pub deleted_exercise_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct RemoveLeftoverLinksResult {
    pub removed_count: i64,
}

/// Body of POST /dismissals: marks a problem, as reported, as intended.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct NewProblemDismissal {
    pub problem_key: String,
    pub fingerprint: String,
}

/// A problem the teacher marked as intended.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct ProblemDismissal {
    pub problem_key: String,
    pub fingerprint: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

/// Why a course looks like a translation of this course.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum JoinCandidateReason {
    CopiedFromThisCourse,
    CopiedFromSameCourse,
    SameChapterAndPageCounts,
    SameTeachers,
    CreatedOnSameDay,
    SimilarName,
}

/// Why a course can't join the language versions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum JoinBlockedReason {
    AlreadyLanguageVersion,
    /// The language versions already have a live course in this language.
    LanguageAlreadyPresent,
}

/// A course that could join this course's language versions (GET /join-candidates).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct JoinCandidate {
    pub course: LanguageVersionCourse,
    /// Empty for plain search hits that don't look like translations.
    pub reasons: Vec<JoinCandidateReason>,
    pub blocked_reason: Option<JoinBlockedReason>,
}

/// Kinds of per-course-group student data that join and split move.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StudentDataKind {
    EnrolmentSettings,
    /// Enrolment settings hidden from "My courses"; a subset of `enrolment_settings`.
    HiddenFromMyCourses,
    Completions,
    MarketingConsents,
    AiNoticeAcknowledgements,
    MailingListAccessTokens,
    MailchimpTags,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct StudentDataCount {
    pub kind: StudentDataKind,
    pub count: i64,
}

/// What joining a course into this course's language versions would change
/// (GET /join-preview/{joined_course_id}). Changes nothing.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct JoinLanguageVersionPreview {
    pub course: LanguageVersionCourse,
    pub language_versions: Vec<LanguageVersionCourse>,
    /// The joined course's current other language versions, which it leaves. They stay language
    /// versions of each other and keep their students.
    pub left_language_versions: Vec<LanguageVersionCourse>,
    /// Pages and exercises of the joined course whose links to `left_language_versions` are
    /// removed.
    pub unlinked_page_count: i64,
    pub unlinked_exercise_count: i64,
    pub blocked_reason: Option<JoinBlockedReason>,
    /// Students whose data moves; send back in [JoinLanguageVersionRequest].
    pub expected_student_count: i64,
    pub moved_data: Vec<StudentDataCount>,
    /// Students enrolled both in the joined course and in a current version. Each keeps the
    /// version with the latest activity; the other enrolment setting is removed and logged.
    pub students_in_both_count: i64,
}

/// Body of POST /join.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct JoinLanguageVersionRequest {
    pub course_id: Uuid,
    /// From the preview; the join is refused if the number changed meanwhile.
    pub expected_student_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct JoinLanguageVersionResult {
    pub course_language_group_id: Uuid,
    pub moved_data: Vec<StudentDataCount>,
    /// Enrolment settings of students in both that were removed (and logged).
    pub removed_enrolment_settings_count: i64,
}

/// What removing a course from the language versions would change
/// (GET /split-preview/{split_course_id}). Changes nothing.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SplitLanguageVersionPreview {
    pub course: LanguageVersionCourse,
    pub remaining_courses: Vec<LanguageVersionCourse>,
    /// Students whose data moves with the course; send back in [SplitLanguageVersionRequest].
    pub expected_student_count: i64,
    pub moved_data: Vec<StudentDataCount>,
    pub unlinked_page_count: i64,
    pub unlinked_exercise_count: i64,
}

/// Body of POST /split.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct SplitLanguageVersionRequest {
    pub course_id: Uuid,
    pub expected_student_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct SplitLanguageVersionResult {
    /// The new group of the split-off course.
    pub course_language_group_id: Uuid,
    pub unlinked_page_count: i64,
    pub unlinked_exercise_count: i64,
}

/// Body of POST /counterparts: copies a page into another language version and links the copy.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct CreateCounterpartRequest {
    pub source_page_id: Uuid,
    pub target_course_id: Uuid,
    /// `None` puts the page outside chapters.
    pub target_chapter_id: Option<Uuid>,
    /// `None` puts the page first.
    pub insert_after_page_id: Option<Uuid>,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct CreateCounterpartResult {
    pub page: LanguageVersionPage,
    /// Exercises copied and linked to the source page's exercises.
    pub copied_exercise_count: i64,
}

/// Which exercises of this course lack counterparts (GET /exercise-counterparts).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct ExerciseCounterparts {
    /// Languages of the other language versions.
    pub language_codes: Vec<String>,
    /// Exercises lacking a counterpart in at least one of them, with the missing language codes.
    pub missing_language_codes_by_exercise_id: HashMap<Uuid, Vec<String>>,
}

/// A page's counterparts in the other language versions (CMS GET /pages/{page_id}/language-versions).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PageLanguageVersions {
    pub page: LanguageVersionPage,
    /// One entry per other language version.
    pub versions: Vec<PageLanguageVersion>,
    /// Linking and creating counterparts need edit rights on every course in the group.
    pub can_edit_all_courses: bool,
}

/// The page's counterpart in one other language version.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PageLanguageVersion {
    pub course_id: Uuid,
    pub course_name: String,
    pub language_code: String,
    pub can_edit: bool,
    pub counterpart: Option<LanguageVersionPage>,
    /// When `counterpart` is `None`: the course's pages, for "Link an existing page".
    pub link_candidates: Vec<PageLinkCandidate>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct PageLinkCandidate {
    pub page: LanguageVersionPage,
    /// Already has a counterpart in the page's language; linking it moves that link.
    pub is_linked: bool,
    pub is_suggested: bool,
}

/// Body of CMS POST /pages/{page_id}/language-versions/link.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct LinkPageCounterpartRequest {
    pub counterpart_page_id: Uuid,
}
