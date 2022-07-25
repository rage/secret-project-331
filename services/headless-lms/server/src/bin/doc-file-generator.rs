#![allow(clippy::redundant_clone)]

use std::{collections::HashMap, fs};

use chrono::{NaiveDate, TimeZone, Utc};
use headless_lms_actix::controllers::{
    course_material::{
        courses::{ChaptersWithStatus, CourseMaterialCourseModule},
        exams::{ExamData, ExamEnrollmentData},
    },
    main_frontend::exercises::ExerciseSubmissions,
    UploadResult,
};
use headless_lms_models::{
    chapters::{
        Chapter, ChapterStatus, ChapterWithStatus, DatabaseChapter,
        UserCourseInstanceChapterProgress,
    },
    course_instance_enrollments::CourseInstanceEnrollment,
    course_instances::{ChapterScore, CourseInstance, Points},
    course_module_completions::{StudyRegistryCompletion, StudyRegistryGrade},
    courses::{Course, CourseCount, CourseStructure},
    email_templates::EmailTemplate,
    exams::{CourseExam, Exam, ExamEnrollment, ExamInstructions, OrgExam},
    exercise_services::ExerciseService,
    exercise_slide_submissions::{
        ExerciseSlideSubmission, ExerciseSlideSubmissionCount,
        ExerciseSlideSubmissionCountByExercise, ExerciseSlideSubmissionCountByWeekAndHour,
        ExerciseSlideSubmissionInfo,
    },
    exercise_slides::CourseMaterialExerciseSlide,
    exercise_task_gradings::{ExerciseTaskGrading, UserPointsUpdateStrategy},
    exercise_task_submissions::ExerciseTaskSubmission,
    exercise_tasks::CourseMaterialExerciseTask,
    exercises::{
        ActivityProgress, CourseMaterialExercise, Exercise, ExerciseStatus, GradingProgress,
    },
    feedback::{Feedback, FeedbackBlock, FeedbackCount},
    glossary::Term,
    library::{
        grading::{StudentExerciseSlideSubmissionResult, StudentExerciseTaskSubmissionResult},
        peer_reviewing::{
            CourseMaterialPeerReviewData, CourseMaterialPeerReviewDataAnswerToReview,
            CourseMaterialPeerReviewQuestionAnswer, CourseMaterialPeerReviewSubmission,
        },
        progressing::{
            CompletionRegistrationLink, UserCompletionInformation, UserModuleCompletionStatus,
        },
    },
    material_references::{MaterialReference, NewMaterialReference},
    organizations::Organization,
    page_history::{HistoryChangeReason, PageHistory},
    pages::{
        CmsPageExercise, CmsPageExerciseSlide, CmsPageExerciseTask, ContentManagementPage,
        CoursePageWithUserData, IsChapterFrontPage, Page, PageChapterAndCourseInformation,
        PageInfo, PageNavigationInformation, PageRoutingData, PageSearchResult, PageWithExercises,
    },
    peer_review_questions::{PeerReviewQuestion, PeerReviewQuestionType},
    peer_reviews::{PeerReview, PeerReviewAcceptingStrategy},
    playground_examples::PlaygroundExample,
    proposed_block_edits::{BlockProposal, ProposalStatus},
    proposed_page_edits::{PageProposal, ProposalCount},
    user_course_settings::UserCourseSettings,
    user_exercise_states::{UserCourseInstanceChapterExerciseProgress, UserCourseInstanceProgress},
    users::User,
};
use headless_lms_utils::url_to_oembed_endpoint::OEmbedResponse;
use serde::Serialize;
use serde_json::{ser::PrettyFormatter, Serializer, Value};
#[cfg(feature = "ts_rs")]
use ts_rs::TS;
use uuid::Uuid;

macro_rules! write_docs {
    ($t: ty, $e: expr) => {{
        let t: $t = $e;
        let json_path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/generated-docs/",
            stringify!($t),
            ".json"
        );
        #[cfg(feature = "ts_rs")]
        let ts_path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/generated-docs/",
            stringify!($t),
            ".ts"
        );
        write_json(json_path, t);
        #[cfg(feature = "ts_rs")]
        write_ts::<$t>(ts_path, stringify!($t));
    }};
}

fn main() {
    // reusable variables
    let id = Uuid::parse_str("307fa56f-9853-4f5c-afb9-a6736c232f32").unwrap();
    let id2 = Uuid::parse_str("3c6ca496-17ac-445c-88c0-4ded2f2dbe58").unwrap();
    let date_time = Utc.timestamp(1640988000, 0);
    let created_at = date_time;
    let updated_at = date_time;
    let deleted_at = None;
    let naive_date = NaiveDate::from_ymd(2022, 1, 1);
    let page = Page {
        id,
        created_at,
        updated_at,
        course_id: Some(id),
        exam_id: None,
        chapter_id: Some(id),
        url_path: "/part-1/hello-world".to_string(),
        title: "Hello world!".to_string(),
        deleted_at,
        content: serde_json::json!([
          {
            "name": "moocfi/pages-in-part",
            "isValid": true,
            "clientId": "c68f55ae-65c4-4e9b-aded-0b52e36e344a",
            "attributes": {
              "hidden": false
            },
            "innerBlocks": []
          },
          {
            "name": "moocfi/exercises-in-part",
            "isValid": true,
            "clientId": "415ecc4c-a5c6-410e-a43f-c14b8ee910ea",
            "attributes": {
              "hidden": false
            },
            "innerBlocks": []
          }
        ]),
        order_number: 123,
        copied_from: None,
    };
    let course_instance = CourseInstance {
        id,
        created_at,
        updated_at,
        deleted_at,
        course_id: id2,
        starts_at: Some(date_time),
        ends_at: None,
        name: Some("Instance".to_string()),
        description: Some("Description".to_string()),
        teacher_in_charge_name: "Example Teacher".to_string(),
        teacher_in_charge_email: "example@email.com".to_string(),
        support_email: Some("example@email.com".to_string()),
    };
    let user_course_settings = UserCourseSettings {
        user_id: id,
        course_language_group_id: id,
        created_at,
        updated_at,
        deleted_at,
        current_course_id: id2,
        current_course_instance_id: id,
    };
    let exercise = Exercise {
        id,
        created_at,
        updated_at,
        name: "Hello Exercise".to_string(),
        course_id: Some(id),
        exam_id: None,
        page_id: id,
        chapter_id: None,
        deadline: None,
        deleted_at,
        score_maximum: 1,
        order_number: 123,
        copied_from: None,
        max_tries_per_slide: Some(17),
        limit_number_of_tries: true,
        needs_peer_review: false,
    };
    let exercise_slide_submission = ExerciseSlideSubmission {
        id,
        created_at,
        updated_at,
        deleted_at,
        course_id: Some(id),
        course_instance_id: Some(id),
        exam_id: None,
        exercise_id: id,
        user_id: id,
        exercise_slide_id: id,
        user_points_update_strategy: UserPointsUpdateStrategy::CanAddPointsAndCanRemovePoints,
    };
    let exercise_task_submission = ExerciseTaskSubmission {
        id,
        created_at,
        updated_at,
        deleted_at,
        exercise_slide_submission_id: id,
        exercise_task_id: id,
        data_json: Some(serde_json::json! {{"choice": "a"}}),
        exercise_task_grading_id: Some(id),
        metadata: None,
        exercise_slide_id: id,
    };
    let grading = ExerciseTaskGrading {
        id,
        created_at,
        updated_at,
        exercise_task_submission_id: id,
        course_id: Some(id),
        exam_id: None,
        exercise_id: id,
        exercise_task_id: id,
        grading_priority: 1,
        score_given: Some(80.0),
        grading_progress: GradingProgress::FullyGraded,
        unscaled_score_given: Some(80.0),
        unscaled_score_maximum: Some(100),
        grading_started_at: Some(date_time),
        grading_completed_at: Some(date_time),
        feedback_json: None,
        feedback_text: None,
        deleted_at,
    };
    let email_template = EmailTemplate {
        id,
        created_at,
        updated_at,
        deleted_at,
        content: Some(Value::String("content".to_string())),
        name: "name".to_string(),
        subject: Some("subject".to_string()),
        exercise_completions_threshold: Some(123),
        points_threshold: Some(123),
        course_instance_id: id,
    };
    let course = Course {
        id,
        slug: "introduction-to-cs".to_string(),
        created_at,
        updated_at,
        name: "Introduction to Computer Science".to_string(),
        organization_id: id,
        deleted_at,
        language_code: "en-US".to_string(),
        copied_from: None,
        content_search_language: Some("simple".to_string()),
        course_language_group_id: id,
        description: Some("Example".to_string()),
        is_draft: true,
        is_test_mode: false,
        base_module_completion_requires_n_submodule_completions: 0,
    };
    let chapter = Chapter {
        id,
        created_at,
        updated_at,
        deleted_at,
        name: "The Basics".to_string(),
        course_id: id2,
        chapter_image_url: None,
        chapter_number: 1,
        front_page_id: None,
        opens_at: Some(date_time),
        copied_from: None,
        deadline: Some(date_time),
        course_module_id: id,
    };
    let exercise_service = ExerciseService {
        id,
        created_at,
        updated_at,
        deleted_at,
        name: "Quizzes".to_string(),
        slug: "quizzes".to_string(),
        public_url: "http://example.com".to_string(),
        internal_url: None,
        max_reprocessing_submissions_at_once: 4,
    };
    let user = User {
        id,
        first_name: Some("User".to_string()),
        last_name: Some("Example".to_string()),
        created_at,
        updated_at,
        deleted_at,
        upstream_id: None,
        email: "email@example.com".to_string(),
    };
    let peer_review_question = PeerReviewQuestion {
        id,
        created_at,
        updated_at,
        deleted_at,
        peer_review_id: id,
        order_number: 0,
        question: "Was the answer well thought out?".to_string(),
        question_type: PeerReviewQuestionType::Essay,
        answer_required: true,
    };
    let peer_review = PeerReview {
        id,
        created_at,
        updated_at,
        deleted_at,
        course_id: course.id,
        exercise_id: Some(exercise.id),
        peer_reviews_to_give: 3,
        peer_reviews_to_receive: 2,
        accepting_threshold: 2.5,
        accepting_strategy: PeerReviewAcceptingStrategy::ManualReviewEverything,
    };
    let playground_example = PlaygroundExample {
        id,
        created_at,
        updated_at,
        deleted_at,
        name: "Example".to_string(),
        url: "http://example.com".to_string(),
        width: 123,
        data: serde_json::json! {{}},
    };

    let course_material_peer_review_submission = CourseMaterialPeerReviewSubmission {
        exercise_slide_submission_id: exercise_slide_submission.id,
        peer_review_id: peer_review.id,
        peer_review_question_answers: vec![CourseMaterialPeerReviewQuestionAnswer {
            peer_review_question_id: id,
            text_data: Some("I think that the answer was well written.".to_string()),
            number_data: None,
        }],
    };
    let submission_result = StudentExerciseTaskSubmissionResult {
        submission: exercise_task_submission.clone(),
        grading: Some(grading.clone()),
        model_solution_spec: None,
    };
    let exercise_slide_submission_result = StudentExerciseSlideSubmissionResult {
        exercise_task_submission_results: vec![submission_result.clone()],
        exercise_status: Some(ExerciseStatus {
            score_given: None,
            activity_progress: ActivityProgress::InProgress,
            grading_progress: GradingProgress::NotReady,
            reviewing_stage: headless_lms_models::user_exercise_states::ReviewingStage::NotStarted,
        }),
    };
    let organization = Organization {
        id,
        created_at,
        updated_at,
        deleted_at,
        slug: "hy-cs".to_string(),
        name: "University of Helsinki".to_string(),
        description: None,
        organization_image_url: None,
    };

    // clear previous results
    fs::read_dir(concat!(env!("CARGO_MANIFEST_DIR"), "/generated-docs/"))
        .unwrap()
        .filter_map(|file| {
            file.ok().filter(|f| {
                f.file_name()
                    .to_str()
                    .map_or(false, |n| n.ends_with(".json") || n.ends_with(".ts"))
            })
        })
        .for_each(|f| fs::remove_file(f.path()).unwrap());

    // write docs
    write_docs!(UploadResult, UploadResult {
        url: "http://project-331.local/api/v0/files/courses/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/iHZMHdvsazy43ZtP0Ea01sy8AOpUiZ.png".to_string()
    });
    write_docs!(Uuid, id);
    write_docs!(EmailTemplate, email_template.clone());
    write_docs!(Vec<EmailTemplate>, vec![email_template.clone()]);
    write_docs!(
        ContentManagementPage,
        ContentManagementPage {
            page: page.clone(),
            exercises: vec![CmsPageExercise {
                id,
                name: "exercise".to_string(),
                order_number: 123,
                score_maximum: 1,
                max_tries_per_slide: Some(17),
                limit_number_of_tries: true,
                deadline: None,
                needs_peer_review: false,
            }],
            exercise_slides: vec![CmsPageExerciseSlide {
                id,
                exercise_id: id,
                order_number: 123,
            }],
            exercise_tasks: vec![CmsPageExerciseTask {
                id,
                exercise_slide_id: id,
                assignment: serde_json::json!({"options": ["a", "b", "c"]}),
                exercise_type: "quiz".to_string(),
                private_spec: None,
                order_number: 1,
            }],
            organization_id: id,
        }
    );
    write_docs!(
        Vec<Page>,
        vec![
            page.clone(),
            Page {
                id,
                created_at,
                updated_at,
                course_id: Some(id),
                exam_id: None,
                chapter_id: Some(id),
                url_path: "/part-1/asdasdasd".to_string(),
                title: "asdasdasd".to_string(),
                deleted_at,
                content: serde_json::json! {[]},
                order_number: 123,
                copied_from: None
            }
        ]
    );
    write_docs!(PeerReview, peer_review.clone());
    write_docs!(PeerReviewQuestion, peer_review_question.clone());
    write_docs!(Vec<PeerReviewQuestion>, vec![peer_review_question.clone()]);
    write_docs!(
        Vec<PageWithExercises>,
        vec![PageWithExercises {
            page: page.clone(),
            exercises: vec![exercise.clone()]
        }]
    );
    write_docs!(
        UserCourseInstanceProgress,
        UserCourseInstanceProgress {
            course_module_id: id,
            course_module_name: "Module".to_string(),
            course_module_order_number: 0,
            score_given: 3.0,
            score_required: Some(7),
            score_maximum: Some(10),
            total_exercises: Some(66),
            attempted_exercises: Some(13),
            attempted_exercises_required: Some(40),
        }
    );
    write_docs!(
        Vec<UserCourseInstanceProgress>,
        vec![UserCourseInstanceProgress {
            course_module_id: id,
            course_module_name: "Module".to_string(),
            course_module_order_number: 0,
            score_given: 3.0,
            score_required: Some(7),
            score_maximum: Some(10),
            total_exercises: Some(66),
            attempted_exercises: Some(13),
            attempted_exercises_required: Some(40),
        }]
    );

    write_docs!(
        UserCourseInstanceChapterProgress,
        UserCourseInstanceChapterProgress {
            score_given: 1.0,
            score_maximum: 4,
            total_exercises: Some(4),
            attempted_exercises: Some(2)
        }
    );
    write_docs!(
        UserCourseInstanceChapterExerciseProgress,
        UserCourseInstanceChapterExerciseProgress {
            exercise_id: id,
            score_given: 1.0
        }
    );
    write_docs!(
        Vec<UserCourseInstanceChapterExerciseProgress>,
        vec![
            UserCourseInstanceChapterExerciseProgress {
                exercise_id: id,
                score_given: 1.0
            },
            UserCourseInstanceChapterExerciseProgress {
                exercise_id: id,
                score_given: 2.0
            }
        ]
    );
    write_docs!(
        CourseInstanceEnrollment,
        CourseInstanceEnrollment {
            user_id: id,
            course_id: id2,
            course_instance_id: id,
            created_at,
            updated_at,
            deleted_at
        }
    );
    write_docs!(Course, course.clone());
    write_docs!(
        CoursePageWithUserData,
        CoursePageWithUserData {
            page: page.clone(),
            instance: Some(course_instance.clone()),
            settings: Some(user_course_settings.clone()),
            was_redirected: false,
            is_test_mode: false
        }
    );
    write_docs!(CourseInstance, course_instance.clone());
    write_docs!(Vec<CourseInstance>, vec![course_instance.clone()]);
    write_docs!(Option<CourseInstance>, Some(course_instance.clone()));
    write_docs!(
        Option<UserCourseSettings>,
        Some(user_course_settings.clone())
    );
    write_docs!(
        Vec<PageSearchResult>,
        vec![
            PageSearchResult {
                id,
                title_headline: Some("Introduction to everything".to_string()),
                rank: Some(0.6079271),
                content_headline: None,
                url_path: "/chapter-1".to_string()
            },
            PageSearchResult {
                id,
                title_headline: Some("In the second chapter...".to_string()),
                rank: Some(0.24317084),
                content_headline: Some("<b>Everything</b> is a big topic".to_string()),
                url_path: "/chapter-2".to_string()
            }
        ]
    );
    write_docs!(Vec<Uuid>, vec![id]);
    write_docs!(
        Option<ExamEnrollment>,
        Some(ExamEnrollment {
            user_id: id,
            exam_id: id,
            started_at: date_time
        })
    );
    write_docs!((), ());
    write_docs!(
        ExamData,
        ExamData {
            id,
            name: "Course exam".to_string(),
            instructions: serde_json::json!([]),
            starts_at: date_time,
            ends_at: date_time,
            ended: false,
            time_minutes: 120,
            enrollment_data: ExamEnrollmentData::NotEnrolled
        }
    );
    write_docs!(
        CourseMaterialExercise,
        CourseMaterialExercise {
            exercise: exercise.clone(),
            can_post_submission: true,
            current_exercise_slide: CourseMaterialExerciseSlide {
                id,
                exercise_tasks: vec![CourseMaterialExerciseTask {
                    id,
                    exercise_slide_id: id,
                    exercise_iframe_url: Some(
                        "http://project-331.local/example-exercise/exercise".to_string()
                    ),
                    assignment: serde_json::json! {{"name":"core/paragraph","isValid":true,"clientId":"187a0aea-c088-4354-a1ea-f0cab082c065","attributes":{"content":"Answer this question.","dropCap":false},"innerBlocks":[]}},
                    public_spec: Some(
                        serde_json::json! {[{"id":"7ab2591c-b0f3-4543-9548-a113849b0f94","name":"a"},{"id":"a833d1df-f27b-4fbf-b516-883a62c09d88","name":"b"},{"id":"03d4b3d4-88af-4125-88b7-4ee052fd876f","name":"c"}]}
                    ),
                    model_solution_spec: None,
                    previous_submission: Some(exercise_task_submission.clone()),
                    previous_submission_grading: Some(grading.clone()),
                    order_number: 1
                }],
            },
            exercise_status: Some(ExerciseStatus {
                score_given: None,
                activity_progress: ActivityProgress::InProgress,
                grading_progress: GradingProgress::NotReady,
                reviewing_stage:
                    headless_lms_models::user_exercise_states::ReviewingStage::NotStarted
            }),
            exercise_slide_submission_counts: HashMap::from([
                (
                    Uuid::parse_str("2794a98e-d594-40cf-949e-7cc011755a58").unwrap(),
                    2_i64
                ),
                (
                    Uuid::parse_str("7dea54af-3d38-4f7c-8969-ecb17b55ec02").unwrap(),
                    4_i64
                )
            ]),
            peer_review: Some(PeerReview {
                id,
                created_at,
                updated_at,
                deleted_at,
                course_id: id,
                exercise_id: Some(id),
                peer_reviews_to_give: 3,
                peer_reviews_to_receive: 2,
                accepting_threshold: 3.0,
                accepting_strategy:
                    PeerReviewAcceptingStrategy::AutomaticallyAcceptOrRejectByAverage
            })
        }
    );
    write_docs!(
        CourseMaterialPeerReviewSubmission,
        course_material_peer_review_submission
    );
    write_docs!(
        StudentExerciseSlideSubmissionResult,
        exercise_slide_submission_result
    );
    write_docs!(
        StudentExerciseTaskSubmissionResult,
        submission_result.clone()
    );
    write_docs!(
        Vec<StudentExerciseTaskSubmissionResult>,
        vec![submission_result.clone()]
    );
    write_docs!(Chapter, chapter.clone());
    write_docs!(
        Points,
        Points {
            chapter_points: vec![ChapterScore {
                chapter: DatabaseChapter {
                    id,
                    created_at,
                    updated_at,
                    deleted_at,
                    name: "The Basics".to_string(),
                    course_id: id2,
                    chapter_image_path: None,
                    chapter_number: 1,
                    front_page_id: None,
                    opens_at: Some(date_time),
                    deadline: Some(date_time),
                    copied_from: None,
                    course_module_id: id,
                },
                score_given: 1.0,
                score_total: 2
            }],
            user_chapter_points: HashMap::new(),
            users: vec![user.clone()]
        }
    );
    write_docs!(
        CourseStructure,
        CourseStructure {
            chapters: vec![chapter.clone()],
            course: course.clone(),
            pages: vec![page.clone()]
        }
    );
    write_docs!(Vec<Exercise>, vec![exercise.clone()]);
    write_docs!(
        Vec<ExerciseSlideSubmissionCount>,
        vec![ExerciseSlideSubmissionCount {
            count: Some(123),
            date: Some(naive_date)
        }]
    );
    write_docs!(
        Vec<ExerciseSlideSubmissionCountByWeekAndHour>,
        vec![ExerciseSlideSubmissionCountByWeekAndHour {
            count: Some(123),
            hour: Some(2),
            isodow: Some(2)
        }]
    );
    write_docs!(
        Vec<ExerciseSlideSubmissionCountByExercise>,
        vec![ExerciseSlideSubmissionCountByExercise {
            exercise_id: Some(id),
            exercise_name: Some("Best exercise".to_string()),
            count: Some(123),
        }]
    );
    write_docs!(
        Vec<Feedback>,
        vec![Feedback {
            id,
            user_id: Some(id),
            course_id: id2,
            feedback_given: "Unclear".to_string(),
            selected_text: None,
            marked_as_read: false,
            created_at: date_time,
            blocks: vec![FeedbackBlock {
                id,
                text: None,
                order_number: Some(0)
            }],
            page_id: Some(Uuid::parse_str("bba0eda6-882b-4a0f-ad91-b02de1de4770").unwrap()),
            page_title: Some("The title of the page".to_string()),
            page_url_path: Some("/path-to-page".to_string())
        }]
    );
    write_docs!(FeedbackCount, FeedbackCount { read: 1, unread: 2 });
    write_docs!(
        Exam,
        Exam {
            id,
            name: "Course exam".to_string(),
            instructions: serde_json::json!([]),
            page_id: id,
            courses: vec![course.clone()],
            starts_at: Some(date_time),
            ends_at: Some(date_time),
            time_minutes: 120
        }
    );
    write_docs!(ExerciseService, exercise_service.clone());
    write_docs!(Vec<ExerciseService>, vec![exercise_service.clone()]);
    write_docs!(
        ExerciseSubmissions,
        ExerciseSubmissions {
            data: vec![exercise_slide_submission.clone()],
            total_pages: 1
        }
    );
    write_docs!(Organization, organization.clone());
    write_docs!(Vec<Organization>, vec![organization.clone()]);
    write_docs!(Vec<Course>, vec![course.clone()]);
    write_docs!(
        Vec<CourseExam>,
        vec![CourseExam {
            id,
            course_id: id2,
            course_name: "Example course".to_string(),
            name: "Course exam".to_string()
        }]
    );
    write_docs!(
        Vec<OrgExam>,
        vec![OrgExam {
            id,
            organization_id: id,
            name: "Org exam".to_string(),
            instructions: page.content.clone(),
            time_minutes: 120,
            starts_at: Some(date_time),
            ends_at: Some(date_time)
        }]
    );
    write_docs!(Page, page.clone());
    write_docs!(Option<Page>, Some(page.clone()));
    write_docs!(
        Vec<PageHistory>,
        vec![PageHistory {
            id,
            created_at,
            title: "Page title".to_string(),
            content: serde_json::json! {{}},
            history_change_reason: HistoryChangeReason::PageSaved,
            restored_from_id: None,
            author_user_id: id
        }]
    );
    write_docs!(i64, 123);
    write_docs!(PlaygroundExample, playground_example.clone());
    write_docs!(Vec<PlaygroundExample>, vec![playground_example.clone()]);
    write_docs!(
        Vec<PageProposal>,
        vec![PageProposal {
            id,
            page_id: id,
            user_id: Some(id),
            pending: false,
            created_at,
            block_proposals: vec![BlockProposal {
                id,
                block_id: id,
                original_text: "Hello,, world!".to_string(),
                current_text: "Hello,, world!".to_string(),
                changed_text: "Hello, world!".to_string(),
                status: ProposalStatus::Accepted,
                accept_preview: Some("Hello, world!!".to_string())
            }],
            page_title: "Page title".to_string(),
            page_url_path: "/path/to/page".to_string()
        }]
    );
    write_docs!(
        ProposalCount,
        ProposalCount {
            pending: 2,
            handled: 2
        }
    );
    write_docs!(User, user.clone());
    write_docs!(CourseCount, CourseCount { count: 1234 });
    write_docs!(
        Vec<Term>,
        vec![
            Term {
                id,
                term: "Term".to_string(),
                definition: "Definition".to_string()
            },
            Term {
                id,
                term: "Another term".to_string(),
                definition: "Another definition".to_string()
            }
        ]
    );
    write_docs!(
        PageChapterAndCourseInformation,
        PageChapterAndCourseInformation {
            chapter_name: Some("Chapter 1".to_string()),
            chapter_number: Some(1),
            course_name: Some("Introduction to everything".to_string()),
            course_slug: Some("introduction-to-everything".to_string()),
            chapter_front_page_id: Some(
                Uuid::parse_str("307fa56f-9853-4f5c-afb9-a6736c232f32").unwrap()
            ),
            chapter_front_page_url_path: Some("/chapter-1".to_string()),
            organization_slug: "uh-cs".to_string()
        }
    );
    write_docs!(
        ChaptersWithStatus,
        ChaptersWithStatus {
            is_previewable: false,
            modules: vec![CourseMaterialCourseModule {
                chapters: vec![ChapterWithStatus {
                    id,
                    created_at,
                    updated_at,
                    name: "The Basics".to_string(),
                    course_id: id2,
                    deleted_at,
                    chapter_number: 1,
                    front_page_id: None,
                    opens_at: None,
                    status: ChapterStatus::Open,
                    chapter_image_url: Some("http://project-331.local/api/v0/files/course/7f36cf71-c2d2-41fc-b2ae-bbbcafab0ea5/images/ydy8IxX1dGMd9T2b27u7FL5VmH5X9U.jpg".to_string()),
                    course_module_id: id,
                }],
                id,
                is_default: true,
                name: None,
                order_number: 0
            }],

        }
    );
    write_docs!(
        ExamInstructions,
        ExamInstructions {
            id,
            instructions: page.content.clone()
        }
    );
    write_docs!(bool, false);
    write_docs!(
        OEmbedResponse,
        OEmbedResponse {
            author_name: "Mooc.fi".to_string(),
            author_url: "http://project-331.local".to_string(),
            html: "<iframe src='http://project-331.local/oembed' style='width: 99%;' height='500' title='OEmbed iFrame'></iframe>".to_string(),
            provider_name: "project".to_string(),
            provider_url: "http://project-331.local".to_string(),
            title: "OEmbed".to_string(),
            version: "1.0".to_string(),
        }
    );
    write_docs!(
        PageInfo,
        PageInfo {
            page_id: id,
            page_title: "The basics".to_string(),
            course_id: Some(id2),
            course_name: Some("Introduction to everything".to_string()),
            course_slug: Some("introduction-to-everything".to_string()),
            organization_slug: Some("uh-cs".to_string())
        }
    );
    write_docs!(
        Vec<MaterialReference>,
        vec![MaterialReference {
            id,
            course_id: id2,
            citation_key: "NeuralNetworks2022".to_string(),
            reference: "bibtex reference".to_string(),
            created_at,
            updated_at,
            deleted_at
        }]
    );
    write_docs!(
        NewMaterialReference,
        NewMaterialReference {
            citation_key: "NeuralNetworks2022".to_string(),
            reference: "bibtex reference".to_string(),
        }
    );
    write_docs!(
        ExerciseSlideSubmissionInfo,
        ExerciseSlideSubmissionInfo {
            tasks: vec![CourseMaterialExerciseTask {
                id,
                exercise_slide_id: id,
                exercise_iframe_url: Some(
                    "http://project-331.local/example-exercise/exercise".to_string()
                ),
                assignment: serde_json::json! {{"name":"core/paragraph","isValid":true,"clientId":"187a0aea-c088-4354-a1ea-f0cab082c065","attributes":{"content":"Answer this question.","dropCap":false},"innerBlocks":[]}},
                public_spec: Some(
                    serde_json::json! {[{"id":"7ab2591c-b0f3-4543-9548-a113849b0f94","name":"a"},{"id":"a833d1df-f27b-4fbf-b516-883a62c09d88","name":"b"},{"id":"03d4b3d4-88af-4125-88b7-4ee052fd876f","name":"c"}]}
                ),
                model_solution_spec: None,
                previous_submission: Some(exercise_task_submission.clone()),
                previous_submission_grading: Some(grading.clone()),
                order_number: 1
            }],
            exercise,
            exercise_slide_submission: exercise_slide_submission.clone(),
        }
    );
    write_docs!(
        IsChapterFrontPage,
        IsChapterFrontPage {
            is_chapter_front_page: true
        }
    );
    write_docs!(
        CourseMaterialPeerReviewData,
        CourseMaterialPeerReviewData {
            peer_review: peer_review.clone(),
            peer_review_questions: vec![peer_review_question.clone()],

            num_peer_reviews_given: 2,
            answer_to_review: Some(CourseMaterialPeerReviewDataAnswerToReview {
                course_material_exercise_tasks: vec![CourseMaterialExerciseTask {
                    id,
                    exercise_slide_id: id,
                    exercise_iframe_url: Some(
                        "http://project-331.local/example-exercise/exercise".to_string(),
                    ),
                    assignment: serde_json::json! {{"name":"core/paragraph","isValid":true,"clientId":"187a0aea-c088-4354-a1ea-f0cab082c065","attributes":{"content":"Answer this question.","dropCap":false},"innerBlocks":[]}},
                    public_spec: Some(
                        serde_json::json! {[{"id":"7ab2591c-b0f3-4543-9548-a113849b0f94","name":"a"},{"id":"a833d1df-f27b-4fbf-b516-883a62c09d88","name":"b"},{"id":"03d4b3d4-88af-4125-88b7-4ee052fd876f","name":"c"}]},
                    ),
                    model_solution_spec: None,
                    previous_submission: Some(exercise_task_submission.clone()),
                    previous_submission_grading: Some(grading.clone()),
                    order_number: 0,
                }],
                exercise_slide_submission_id: exercise_slide_submission.id,
            }),
        }
    );
    write_docs!(
        StudyRegistryCompletion,
        StudyRegistryCompletion {
            completion_date: Utc.ymd(2022, 6, 21).and_hms(0, 0, 0),
            completion_language: "en-US".to_string(),
            completion_registration_attempt_date: None,
            email: "student@example.com".to_string(),
            grade: StudyRegistryGrade::new(true, Some(4)),
            id: Uuid::parse_str("633852ce-c82a-4d60-8ab5-28745163f6f9").unwrap(),
            user_upstream_id: id,
            tier: None
        }
    );
    write_docs!(
        Vec<StudyRegistryCompletion>,
        vec![StudyRegistryCompletion {
            completion_date: Utc.ymd(2022, 6, 21).and_hms(0, 0, 0),
            completion_language: "en-US".to_string(),
            completion_registration_attempt_date: None,
            email: "student@example.com".to_string(),
            grade: StudyRegistryGrade::new(true, Some(4)),
            id: Uuid::parse_str("633852ce-c82a-4d60-8ab5-28745163f6f9").unwrap(),
            user_upstream_id: id,
            tier: None
        }]
    );
    write_docs!(
        UserCompletionInformation,
        UserCompletionInformation {
            course_module_completion_id: id,
            course_name: "Course".to_string(),
            email: "student@example.com".to_string(),
            uh_course_code: "ABC123".to_string(),
            ects_credits: Some(5),
        }
    );
    write_docs!(
        Vec<UserModuleCompletionStatus>,
        vec![
            UserModuleCompletionStatus {
                completed: false,
                default: true,
                module_id: Uuid::parse_str("299eba99-9aa2-4023-bd64-bd4b5d7578ba").unwrap(),
                name: "Course".to_string(),
                order_number: 0,
                prerequisite_modules_completed: false,
            },
            UserModuleCompletionStatus {
                completed: true,
                default: false,
                module_id: Uuid::parse_str("c6c89368-c05d-498f-a2e3-10d7c327752c").unwrap(),
                name: "Module".to_string(),
                order_number: 1,
                prerequisite_modules_completed: false,
            }
        ]
    );
    write_docs!(
        CompletionRegistrationLink,
        CompletionRegistrationLink {
            url: "https://www.example.com".to_string(),
        }
    );
    write_docs!(
        Vec<bool>,
        vec![false, true, false, true, false, true, true, true]
    );
    write_docs!(
        PageNavigationInformation,
        PageNavigationInformation {
            chapter_front_page: Some(PageRoutingData {
                url_path: "/chapter-1".to_string(),
                title: "Chapter 1".to_string(),
                page_id: Uuid::parse_str("634d1116-4a00-4f97-988d-e2fd523ac43a").unwrap(),
                chapter_number: 1,
                chapter_id: Uuid::parse_str("22552232-c1b6-4067-9aae-e09221b63e8f").unwrap(),
                chapter_opens_at: None,
                chapter_front_page_id: Some(
                    Uuid::parse_str("f8726e97-5ebe-4698-9163-7d6e2568ec7e").unwrap()
                ),
            }),
            next_page: Some(PageRoutingData {
                url_path: "/chapter-1/page-3".to_string(),
                title: "Page 3".to_string(),
                page_id: Uuid::parse_str("634d1116-4a00-4f97-988d-e2fd523ac43a").unwrap(),
                chapter_number: 1,
                chapter_id: Uuid::parse_str("22552232-c1b6-4067-9aae-e09221b63e8f").unwrap(),
                chapter_opens_at: None,
                chapter_front_page_id: Some(
                    Uuid::parse_str("f8726e97-5ebe-4698-9163-7d6e2568ec7e").unwrap()
                ),
            }),
            previous_page: Some(PageRoutingData {
                url_path: "/chapter-1/page-1".to_string(),
                title: "Page 1".to_string(),
                page_id: Uuid::parse_str("25d1932b-ad97-4461-8280-412fe8b75ca2").unwrap(),
                chapter_number: 1,
                chapter_id: Uuid::parse_str("22552232-c1b6-4067-9aae-e09221b63e8f").unwrap(),
                chapter_opens_at: None,
                chapter_front_page_id: Some(
                    Uuid::parse_str("f8726e97-5ebe-4698-9163-7d6e2568ec7e").unwrap()
                ),
            }),
        }
    );
}

fn write_json<T: Serialize>(path: &str, value: T) {
    let mut file = std::fs::File::create(path).unwrap();
    let formatter = PrettyFormatter::with_indent(b"    ");
    let mut serializer = Serializer::with_formatter(&mut file, formatter);
    serde::Serialize::serialize(&value, &mut serializer).unwrap();
}

#[cfg(feature = "ts_rs")]
fn write_ts<T: TS>(path: &str, type_name: &str) {
    let contents = format!("type {} = {}", type_name, T::inline());
    std::fs::write(path, contents).unwrap();
}
