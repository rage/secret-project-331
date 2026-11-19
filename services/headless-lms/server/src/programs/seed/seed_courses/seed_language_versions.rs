//! Course sets for the language version repair tool's system tests. Each set is a Finnish course
//! with a Swedish language version that is connected wrong (a page missing, two pages linked to
//! the same page, a chapter in another order) and an English course copied from it as a separate
//! course, plus a teacher who can edit all three and students enrolled in them.
//!
//! Each spec gets a set of its own, in its own organization, so that join candidates and problem
//! lists never see another spec's courses.

use anyhow::{Context, Result};
use headless_lms_base::config::ApplicationConfiguration;
use headless_lms_models::{
    PKeyPolicy, chapters, course_instances,
    courses::{Course, NewCourse},
    entity_history::HistoryAuthor,
    exercises,
    library::copying::{copy_course, copy_course_with_language_group},
    organizations,
    page_history::HistoryChangeReason,
    pages::{self, CmsPageUpdate, Page, PageRow, PageUpdateArgs, PageVisibility},
    roles::{self, RoleDomain, UserRole},
    user_details, user_exercise_states,
    user_passwords::{hash_password, upsert_user_password},
    user_research_consents,
};
use headless_lms_utils::document_schema_processor::GutenbergBlock;
use secrecy::SecretString;
use serde_json::json;
use sqlx::{PgConnection, Pool, Postgres};
use tracing::info;
use uuid::Uuid;

use crate::{
    domain::models_requests,
    programs::seed::{
        builder::{
            chapter::ChapterBuilder,
            context::SeedContext,
            course::{CourseBuilder, CourseInstanceConfig},
            exercise::{ExerciseBuilder, ExerciseIds},
            module::ModuleBuilder,
        },
        seed_helpers::{enroll, get_seed_spec_fetcher, insert_user_with_verified_email, paragraph},
    },
};

/// The ids system tests address directly; everything else is derived from `finnish_course_id`.
/// Mirrored in `system-tests/src/utils/languageVersions.ts`.
pub struct LanguageVersionSet {
    /// Ends up in names, slugs and e-mail addresses, e.g. `join`.
    pub label: &'static str,
    pub organization_id: Uuid,
    pub finnish_course_id: Uuid,
    /// The Finnish page added after the copies were made, so it has no Swedish counterpart.
    pub review_page_id: Uuid,
}

pub const LANGUAGE_VERSION_SETS: [LanguageVersionSet; 4] = [
    LanguageVersionSet {
        label: "problems",
        organization_id: Uuid::from_u128(0x11489d0d_a24c_4be4_a1d8_885741002b27),
        finnish_course_id: Uuid::from_u128(0x8ef160e5_895c_41ee_b4a1_4b98a7054edb),
        review_page_id: Uuid::from_u128(0xed01ac2d_b122_4e4c_b113_f1e20344b0e6),
    },
    LanguageVersionSet {
        label: "join",
        organization_id: Uuid::from_u128(0x8d3b0241_1392_4758_ba0d_3acf20c4424f),
        finnish_course_id: Uuid::from_u128(0x8ec3d906_0231_49dd_9f54_5be70b52c3a5),
        review_page_id: Uuid::from_u128(0x263d6954_faf3_44f9_9f00_0c640c363f6b),
    },
    LanguageVersionSet {
        label: "split",
        organization_id: Uuid::from_u128(0x4397b00d_ba9b_46f0_ad9e_11f2fd2b7bf4),
        finnish_course_id: Uuid::from_u128(0x586fa030_e93a_4264_91ad_6c1bfd9c0bdb),
        review_page_id: Uuid::from_u128(0x89ab1b7d_f42d_4ffe_8123_9560923119c1),
    },
    LanguageVersionSet {
        label: "admin",
        organization_id: Uuid::from_u128(0x5554cd8f_e99e_4351_85f9_89d6fe1696d5),
        finnish_course_id: Uuid::from_u128(0x261fe65f_c1dc_4dd7_b01b_10b440646803),
        review_page_id: Uuid::from_u128(0x83f90419_8b19_428e_aa44_7872cfdc62cb),
    },
];

/// Seeds every set of [LANGUAGE_VERSION_SETS], each in a hidden organization of its own.
pub async fn seed_language_version_sets(
    db_pool: Pool<Postgres>,
    app_config: ApplicationConfiguration,
) -> Result<()> {
    let mut conn = db_pool.acquire().await?;
    for set in &LANGUAGE_VERSION_SETS {
        seed_language_version_set(&mut conn, &app_config, set)
            .await
            .with_context(|| format!("seeding language version set {}", set.label))?;
    }
    Ok(())
}

async fn seed_language_version_set(
    conn: &mut PgConnection,
    app_config: &ApplicationConfiguration,
    set: &LanguageVersionSet,
) -> Result<()> {
    info!("inserting language version set {}", set.label);
    let label = set.label;
    organizations::insert(
        conn,
        PKeyPolicy::Fixed(set.organization_id),
        &format!("Language version fixtures ({label})"),
        &format!("language-versions-{label}"),
        Some("Courses the language version system tests own. Not meant for humans to study."),
        true,
    )
    .await?;

    let ns = set.finnish_course_id;
    let user_id = |name: &str| Uuid::new_v5(&ns, format!("user:{name}").as_bytes());
    let teacher_id = insert_user(conn, user_id("teacher"), &format!("lv-{label}-teacher")).await?;
    // 1: Finnish and English, latest activity in English. 2: English. 3: Swedish.
    let student_1 =
        insert_user(conn, user_id("student-1"), &format!("lv-{label}-student-1")).await?;
    let student_2 =
        insert_user(conn, user_id("student-2"), &format!("lv-{label}-student-2")).await?;
    let student_3 =
        insert_user(conn, user_id("student-3"), &format!("lv-{label}-student-3")).await?;

    let cx = SeedContext {
        teacher: teacher_id,
        org: set.organization_id,
        base_course_ns: ns,
    };
    let (finnish, finnish_instance, _module) = CourseBuilder::new(
        format!("Ohjelmoinnin perusteet ({label})"),
        format!("ohjelmoinnin-perusteet-{label}"),
    )
    .language("fi")
    .desc("Ohjelmoinnin perusteet kieliversioiden testaamiseen.")
    .course_id(ns)
    .instance(CourseInstanceConfig {
        name: None,
        description: None,
        support_email: None,
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        opening_time: None,
        closing_time: None,
        instance_id: Some(cx.v5(b"instance")),
    })
    .role(teacher_id, UserRole::Teacher)
    .module(
        ModuleBuilder::new()
            .order(0)
            .chapter(
                ChapterBuilder::new(1, "Muuttujat ja tulostus")
                    .fixed_ids(cx.v5(b"chapter:1"), cx.v5(b"chapter:1:front-page")),
            )
            .chapter(
                ChapterBuilder::new(2, "Ehdot ja toisto")
                    .fixed_ids(cx.v5(b"chapter:2"), cx.v5(b"chapter:2:front-page")),
            ),
    )
    .seed(conn, app_config, &cx)
    .await?;

    let chapter_1 = Some(cx.v5(b"chapter:1"));
    let chapter_2 = Some(cx.v5(b"chapter:2"));
    let glossary_page = insert_page(
        conn,
        &cx,
        &finnish,
        NewSeedPage::new(cx.v5(b"page:sanasto"), None, 100, "/sanasto", "Sanasto"),
        None,
    )
    .await?;
    let printing_page = insert_page(
        conn,
        &cx,
        &finnish,
        NewSeedPage::new(
            cx.v5(b"page:tulostaminen"),
            chapter_1,
            1,
            "/chapter-1/tulostaminen",
            "Tulostaminen",
        )
        .exercise(example_exercise(&cx, "tulostaminen", "Tulosta tervehdys")),
        None,
    )
    .await?;
    let variables_page = insert_page(
        conn,
        &cx,
        &finnish,
        NewSeedPage::new(
            cx.v5(b"page:muuttujat"),
            chapter_1,
            2,
            "/chapter-1/muuttujat",
            "Muuttujat",
        )
        .exercise(example_exercise(&cx, "muuttujat", "Muuttujan arvo")),
        None,
    )
    .await?;
    insert_page(
        conn,
        &cx,
        &finnish,
        NewSeedPage::new(
            cx.v5(b"page:laskeminen"),
            chapter_1,
            3,
            "/chapter-1/laskeminen",
            "Laskeminen",
        ),
        None,
    )
    .await?;
    insert_page(
        conn,
        &cx,
        &finnish,
        NewSeedPage::new(
            cx.v5(b"page:ehtolauseet"),
            chapter_2,
            1,
            "/chapter-2/ehtolauseet",
            "Ehtolauseet",
        )
        .exercise(example_exercise(&cx, "ehtolauseet", "Vertailu")),
        None,
    )
    .await?;
    insert_page(
        conn,
        &cx,
        &finnish,
        NewSeedPage::new(
            cx.v5(b"page:toistolauseet"),
            chapter_2,
            2,
            "/chapter-2/toistolauseet",
            "Toistolauseet",
        )
        .exercise(example_exercise(&cx, "toistolauseet", "Lukujen summa")),
        None,
    )
    .await?;

    let swedish = copy_course_with_language_group(
        conn,
        finnish.id,
        finnish.course_language_group_id,
        &new_copy(
            set,
            format!("Grunderna i programmering ({label})"),
            format!("grunderna-i-programmering-{label}"),
            "sv",
        ),
        teacher_id,
    )
    .await?;
    let english = copy_course(
        conn,
        finnish.id,
        &new_copy(
            set,
            format!("Programming basics ({label})"),
            format!("programming-basics-{label}"),
            "en",
        ),
        false,
        teacher_id,
    )
    .await?;
    for course_id in [swedish.id, english.id] {
        roles::insert(
            conn,
            teacher_id,
            UserRole::Teacher,
            RoleDomain::Course(course_id),
        )
        .await?;
    }

    // Added after the copies: Finnish only, so it is the Swedish version's missing page. At the
    // same place as the English-only page below, which makes the two a "likely" link suggestion.
    insert_page(
        conn,
        &cx,
        &finnish,
        NewSeedPage::new(
            set.review_page_id,
            chapter_2,
            3,
            "/chapter-2/kertaus",
            "Kertaus",
        )
        .exercise(example_exercise(&cx, "kertaus", "Kertauskysely")),
        None,
    )
    .await?;
    let english_chapter_2 = chapter_id(conn, english.id, 2).await?;
    insert_page(
        conn,
        &cx,
        &english,
        NewSeedPage::new(
            cx.v5(b"page:en:review"),
            Some(english_chapter_2),
            3,
            "/chapter-2/review",
            "Review",
        ),
        None,
    )
    .await?;

    // The old Swedish glossary page left linked next to the copied one.
    insert_page(
        conn,
        &cx,
        &swedish,
        NewSeedPage::new(
            cx.v5(b"page:sv:ordlista"),
            None,
            101,
            "/ordlista",
            "Ordlista",
        ),
        glossary_page.page_language_group_id,
    )
    .await?;
    swap_page_order(conn, swedish.id, printing_page.id, variables_page.id).await?;

    let english_instance = course_instances::get_default_by_course_id(conn, english.id).await?;
    let swedish_instance = course_instances::get_default_by_course_id(conn, swedish.id).await?;
    enroll(conn, student_1, finnish.id, finnish_instance.id).await?;
    enroll(conn, student_1, english.id, english_instance.id).await?;
    let english_exercise = exercises::get_exercises_by_course_id(conn, english.id)
        .await?
        .into_iter()
        .next()
        .context("the English copy has exercises")?;
    user_exercise_states::get_or_create_user_exercise_state(
        conn,
        student_1,
        english_exercise.id,
        Some(english.id),
        None,
    )
    .await?;
    enroll(conn, student_2, english.id, english_instance.id).await?;
    enroll(conn, student_3, swedish.id, swedish_instance.id).await?;
    Ok(())
}

/// A user who has been through the first-login prompts. The password is the address's local part.
async fn insert_user(conn: &mut PgConnection, id: Uuid, local_part: &str) -> Result<Uuid> {
    let user_id = insert_user_with_verified_email(
        conn,
        PKeyPolicy::Fixed(id),
        &format!("{local_part}@example.com"),
        Some(local_part),
        Some("Example"),
    )
    .await?;
    user_details::update_user_country(conn, user_id, "fi").await?;
    user_research_consents::upsert(conn, PKeyPolicy::Generate, user_id, true).await?;
    let hash = hash_password(&SecretString::new(local_part.to_string().into()))
        .map_err(|e| anyhow::anyhow!("failed to hash a seeded password: {e}"))?;
    upsert_user_password(conn, user_id, &hash).await?;
    Ok(user_id)
}

fn new_copy(
    set: &LanguageVersionSet,
    name: String,
    slug: String,
    language_code: &str,
) -> NewCourse {
    NewCourse {
        name,
        slug,
        organization_id: set.organization_id,
        language_code: language_code.to_string(),
        teacher_in_charge_name: "admin".to_string(),
        teacher_in_charge_email: "admin@example.com".to_string(),
        description: String::new(),
        is_draft: false,
        is_test_mode: false,
        is_unlisted: false,
        copy_user_permissions: false,
        is_joinable_by_code_only: false,
        join_code: None,
        ask_marketing_consent: false,
        flagged_answers_threshold: Some(3),
        can_add_chatbot: false,
    }
}

async fn chapter_id(conn: &mut PgConnection, course_id: Uuid, chapter_number: i32) -> Result<Uuid> {
    chapters::get_course_chapters(conn, course_id)
        .await?
        .into_iter()
        .find(|chapter| chapter.chapter_number == chapter_number)
        .map(|chapter| chapter.id)
        .with_context(|| format!("chapter {chapter_number} of course {course_id}"))
}

/// Swaps the order of the copies of `first_source` and `second_source` in the copied course.
async fn swap_page_order(
    conn: &mut PgConnection,
    course_id: Uuid,
    first_source: Uuid,
    second_source: Uuid,
) -> Result<()> {
    let copies: Vec<Page> =
        pages::get_all_by_course_id_and_visibility(conn, course_id, PageVisibility::Any)
            .await?
            .into_iter()
            .filter(|page| {
                page.copied_from == Some(first_source) || page.copied_from == Some(second_source)
            })
            .collect();
    let [first, second] = &copies[..] else {
        anyhow::bail!("expected two copied pages to swap, found {}", copies.len());
    };
    let mut first = first.clone();
    let mut second = second.clone();
    std::mem::swap(&mut first.order_number, &mut second.order_number);
    pages::reorder_pages(conn, &[first, second], course_id).await?;
    Ok(())
}

struct NewSeedPage {
    id: Uuid,
    chapter_id: Option<Uuid>,
    order_number: i32,
    url_path: &'static str,
    title: &'static str,
    exercises: Vec<ExerciseBuilder>,
}

impl NewSeedPage {
    fn new(
        id: Uuid,
        chapter_id: Option<Uuid>,
        order_number: i32,
        url_path: &'static str,
        title: &'static str,
    ) -> Self {
        Self {
            id,
            chapter_id,
            order_number,
            url_path,
            title,
            exercises: vec![],
        }
    }

    fn exercise(mut self, exercise: ExerciseBuilder) -> Self {
        self.exercises.push(exercise);
        self
    }
}

/// Inserts a page under a fixed id. `page_language_group_id` links it to that group's pages
/// without any check, which is how the seed makes two pages of one course counterparts of the
/// same page; `None` gives it a group of its own.
async fn insert_page(
    conn: &mut PgConnection,
    cx: &SeedContext,
    course: &Course,
    new_page: NewSeedPage,
    page_language_group_id: Option<Uuid>,
) -> Result<Page> {
    let page = pages::insert_page_row(
        conn,
        PageRow {
            id: PKeyPolicy::Fixed(new_page.id),
            course: Some(course),
            exam_id: None,
            chapter_id: new_page.chapter_id,
            url_path: new_page.url_path,
            title: new_page.title,
            order_number: new_page.order_number,
            hidden: false,
            content_search_language: None,
            page_language_group_id,
        },
        &json!([]),
    )
    .await?;

    let mut content: Vec<GutenbergBlock> = vec![paragraph(
        &format!("{} — {}", new_page.title, course.name),
        Uuid::new_v5(&new_page.id, b"paragraph"),
    )];
    let mut page_exercises = vec![];
    let mut exercise_slides = vec![];
    let mut exercise_tasks = vec![];
    for exercise in new_page.exercises {
        let (block, exercise, slide, task) = exercise.to_cms(cx)?;
        content.push(block);
        page_exercises.push(exercise);
        exercise_slides.push(slide);
        exercise_tasks.push(task);
    }
    pages::update_page(
        conn,
        PageUpdateArgs {
            page_id: page.id,
            author: HistoryAuthor::user(cx.teacher),
            cms_page_update: CmsPageUpdate {
                content,
                exercises: page_exercises,
                exercise_slides,
                exercise_tasks,
                url_path: new_page.url_path.to_string(),
                title: new_page.title.to_string(),
                chapter_id: new_page.chapter_id,
                hidden: false,
            },
            retain_ids: true,
            history_change_reason: HistoryChangeReason::PageSaved,
            is_exam_page: false,
        },
        get_seed_spec_fetcher(),
        models_requests::fetch_service_info,
    )
    .await?;
    Ok(page)
}

fn example_exercise(cx: &SeedContext, key: &str, name: &str) -> ExerciseBuilder {
    let id = |part: &str| cx.v5(format!("exercise:{key}:{part}").as_bytes());
    ExerciseBuilder::example_exercise(
        name,
        ExerciseIds {
            exercise_id: id("exercise"),
            slide_id: id("slide"),
            task_id: id("task"),
            block_id: id("block"),
        },
        vec![paragraph("Valitse oikea vastaus.", id("prompt"))],
        json!([
            { "name": "a", "correct": true, "id": id("option:a") },
            { "name": "b", "correct": false, "id": id("option:b") },
        ]),
        false,
        None,
        None,
    )
}
