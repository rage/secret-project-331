//! The page content and settings a course created from a course design plan starts with.

use headless_lms_utils::{
    attributes,
    document_schema_processor::{GutenbergBlock, suffix_duplicate_heading_anchors},
    strings::{escape_html_text, non_empty_trimmed},
};

use crate::{
    course_designer_stage_workspace::{AnalysisWorkspaceV1, DesignChapter, DesignWorkloadActivity},
    library::{
        course_designer::{ChapterDraft, CourseDraft, TopicOutline},
        course_designer_course_status::AI_OUTLINE_CLASS_NAME,
    },
};

/// Fixed texts of the generated pages in the course's language.
pub struct CourseCopy {
    pub introduction_title: &'static str,
    pub conclusion_title: &'static str,
    pub contributors_title: &'static str,
    pub how_to_study_title: &'static str,
    pub about_heading: &'static str,
    pub objectives_title: &'static str,
    pub conclusion_recap_heading: &'static str,
    pub outline_note: &'static str,
    pub responsible_teachers_heading: &'static str,
    pub instructional_designers_heading: &'static str,
    pub subject_matter_experts_heading: &'static str,
    pub editors_heading: &'static str,
    pub support_staff_heading: &'static str,
    pub workload_heading: &'static str,
    pub workload_activity: fn(&str, u32, u32) -> String,
    pub workload_total: fn(u32) -> String,
}

const ENGLISH_COPY: CourseCopy = CourseCopy {
    introduction_title: "Introduction",
    conclusion_title: "Conclusion",
    contributors_title: "Contributors",
    how_to_study_title: "How to study this course",
    about_heading: "About this course",
    objectives_title: "In this course you'll...",
    conclusion_recap_heading: "In this chapter you learned to",
    outline_note: "Outline drafted by AI from the course plan. Write the page content, then delete this box.",
    responsible_teachers_heading: "Responsible teachers",
    instructional_designers_heading: "Instructional design",
    subject_matter_experts_heading: "Subject matter experts",
    editors_heading: "Editors",
    support_staff_heading: "Support staff",
    workload_heading: "Workload",
    workload_activity: |title, count, minutes| format!("{title}: {count} × {minutes} min"),
    workload_total: |hours| format!("About {hours} hours in total."),
};

const FINNISH_COPY: CourseCopy = CourseCopy {
    introduction_title: "Johdanto",
    conclusion_title: "Yhteenveto",
    contributors_title: "Tekijät",
    how_to_study_title: "Näin opiskelet kurssilla",
    about_heading: "Tietoa kurssista",
    objectives_title: "Kurssilla opit...",
    conclusion_recap_heading: "Tässä osassa opit",
    outline_note: "Tekoälyn kurssisuunnitelmasta luonnostelema runko. Kirjoita sivun sisältö ja poista sitten tämä laatikko.",
    responsible_teachers_heading: "Vastuuopettajat",
    instructional_designers_heading: "Pedagoginen suunnittelu",
    subject_matter_experts_heading: "Sisältöasiantuntijat",
    editors_heading: "Toimittajat",
    support_staff_heading: "Tukihenkilöstö",
    workload_heading: "Työmäärä",
    workload_activity: |title, count, minutes| format!("{title}: {count} × {minutes} min"),
    workload_total: |hours| format!("Yhteensä noin {hours} tuntia."),
};

const SWEDISH_COPY: CourseCopy = CourseCopy {
    introduction_title: "Introduktion",
    conclusion_title: "Sammanfattning",
    contributors_title: "Medverkande",
    how_to_study_title: "Så studerar du kursen",
    about_heading: "Om kursen",
    objectives_title: "På kursen lär du dig...",
    conclusion_recap_heading: "I den här delen lärde du dig",
    outline_note: "Disposition som AI har skissat utifrån kursplanen. Skriv sidans innehåll och ta sedan bort den här rutan.",
    responsible_teachers_heading: "Ansvariga lärare",
    instructional_designers_heading: "Pedagogisk planering",
    subject_matter_experts_heading: "Ämnesexperter",
    editors_heading: "Redaktörer",
    support_staff_heading: "Stödpersonal",
    workload_heading: "Arbetsmängd",
    workload_activity: |title, count, minutes| format!("{title}: {count} × {minutes} min"),
    workload_total: |hours| format!("Sammanlagt cirka {hours} timmar."),
};

impl CourseCopy {
    /// The copy for an IETF language code; English for languages without their own.
    pub fn for_language(language_code: &str) -> &'static CourseCopy {
        let language = language_code
            .split(['-', '_'])
            .next()
            .unwrap_or_default()
            .to_lowercase();
        match language.as_str() {
            "fi" => &FINNISH_COPY,
            "sv" => &SWEDISH_COPY,
            _ => &ENGLISH_COPY,
        }
    }
}

/// Minimum WCAG AA contrast for normal text; chapter cards print white text on the chapter colour.
const MIN_CONTRAST_WITH_WHITE: f64 = 4.5;
const WHITE: &str = "#ffffff";

fn text(plain: &str) -> String {
    escape_html_text(plain.trim())
}

fn paragraph(plain: &str) -> GutenbergBlock {
    GutenbergBlock::paragraph(&text(plain))
}

fn heading(plain: &str, level: u8) -> GutenbergBlock {
    GutenbergBlock::heading(&text(plain), level)
}

fn list(plain_items: &[&str]) -> GutenbergBlock {
    let items: Vec<String> = plain_items.iter().map(|item| text(item)).collect();
    GutenbergBlock::list(&items)
}

/// Paragraphs of `plain`, one per non-blank line.
fn paragraphs(plain: &str) -> Vec<GutenbergBlock> {
    plain
        .lines()
        .filter_map(non_empty_trimmed)
        .map(paragraph)
        .collect()
}

fn page(title: &str, body: Vec<GutenbergBlock>) -> Vec<GutenbergBlock> {
    let mut blocks = vec![GutenbergBlock::hero_section(&text(title), "")];
    blocks.extend(body);
    suffix_duplicate_heading_anchors(blocks)
}

/// The course front page with the drafted texts and one objective column per learning goal.
/// Without learning goals the objective section keeps its placeholders.
pub fn front_page_content(
    copy: &CourseCopy,
    course_name: &str,
    learning_goals: &[&str],
    draft: &CourseDraft,
) -> Vec<GutenbergBlock> {
    let objective_section = if learning_goals.is_empty() {
        GutenbergBlock::course_objective_section()
    } else {
        let objectives: Vec<(String, String)> = learning_goals
            .iter()
            .zip(&draft.learning_goal_headings)
            .map(|(goal, heading)| (text(heading), text(goal)))
            .collect();
        GutenbergBlock::course_objective_section_with(copy.objectives_title, &objectives)
    };
    vec![
        GutenbergBlock::landing_page_hero_section(&text(course_name), &text(&draft.hero_subtitle)),
        GutenbergBlock::landing_page_copy_text(copy.about_heading, &text(&draft.about_text)),
        objective_section,
        GutenbergBlock::empty_block_from_name("moocfi/course-chapter-grid".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/top-level-pages".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/congratulations".to_string()),
        GutenbergBlock::empty_block_from_name("moocfi/course-progress".to_string()),
    ]
}

/// The non-blank learning objectives of a planned chapter.
pub fn learning_objectives(chapter: &DesignChapter) -> Vec<&str> {
    chapter
        .learning_objectives
        .iter()
        .filter_map(|objective| non_empty_trimmed(objective))
        .collect()
}

/// A chapter front page: hero, the chapter's learning objectives when it has any, and the lists
/// of its pages and exercises. `color` is a chapter colour from [`chapter_colors`].
pub fn chapter_front_page_content(
    chapter_name: &str,
    objectives: &[&str],
    color: Option<&str>,
) -> Vec<GutenbergBlock> {
    let mut hero = GutenbergBlock::hero_section(&text(chapter_name), "");
    if let Some(color) = color {
        hero.attributes
            .insert("backgroundColor".to_string(), color.into());
        hero.attributes
            .insert("fontColor".to_string(), WHITE.into());
    }
    let mut blocks = vec![hero];
    if !objectives.is_empty() {
        blocks.push(GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/learning-objectives",
            attributes! {},
            vec![list(objectives)],
        ));
    }
    blocks.push(GutenbergBlock::empty_block_from_name(
        "moocfi/pages-in-chapter".to_string(),
    ));
    blocks.push(GutenbergBlock::empty_block_from_name(
        "moocfi/exercises-in-chapter".to_string(),
    ));
    blocks
}

/// An Introduction page with the drafted prior-learning infobox.
pub fn introduction_content(copy: &CourseCopy, draft: &ChapterDraft) -> Vec<GutenbergBlock> {
    let questions: Vec<&str> = draft
        .prior_learning_questions
        .iter()
        .filter_map(|question| non_empty_trimmed(question))
        .collect();
    let mut infobox_blocks = vec![heading(&draft.prior_learning_heading, 2)];
    infobox_blocks.push(list(&questions));
    page(
        copy.introduction_title,
        vec![GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/infobox",
            attributes! {},
            infobox_blocks,
        )],
    )
}

/// A topic page holding the drafted outline in an aside marked with [`AI_OUTLINE_CLASS_NAME`],
/// so the page counts as unfilled until the teacher deletes it.
pub fn topic_content(
    copy: &CourseCopy,
    title: &str,
    outline: &TopicOutline,
) -> Vec<GutenbergBlock> {
    let mut outline_blocks = vec![paragraph(copy.outline_note)];
    for section in &outline.sections {
        outline_blocks.push(heading(&section.heading, 2));
        let points: Vec<&str> = section
            .points
            .iter()
            .filter_map(|point| non_empty_trimmed(point))
            .collect();
        if !points.is_empty() {
            outline_blocks.push(list(&points));
        }
    }
    page(
        title,
        vec![GutenbergBlock::block_with_name_attributes_and_inner_blocks(
            "moocfi/aside",
            attributes! { "className": AI_OUTLINE_CLASS_NAME },
            outline_blocks,
        )],
    )
}

/// A Conclusion page recapping the chapter's learning objectives.
pub fn conclusion_content(copy: &CourseCopy, objectives: &[&str]) -> Vec<GutenbergBlock> {
    let body = if objectives.is_empty() {
        vec![]
    } else {
        vec![heading(copy.conclusion_recap_heading, 2), list(objectives)]
    };
    page(copy.conclusion_title, body)
}

/// The Contributors page: the Analysis form's key contributor and responsible teacher texts
/// under a heading each.
pub fn contributors_content(
    copy: &CourseCopy,
    analysis: &AnalysisWorkspaceV1,
) -> Vec<GutenbergBlock> {
    let sections = [
        (
            copy.responsible_teachers_heading,
            &analysis.responsible_teachers,
        ),
        (
            copy.instructional_designers_heading,
            &analysis.contributors_instructional_designer,
        ),
        (
            copy.subject_matter_experts_heading,
            &analysis.contributors_subject_matter_experts,
        ),
        (copy.editors_heading, &analysis.contributors_editors),
        (
            copy.support_staff_heading,
            &analysis.contributors_support_staff,
        ),
    ];
    let mut body = Vec::new();
    for (section_heading, names) in sections {
        let Some(names) = names.as_deref().and_then(non_empty_trimmed) else {
            continue;
        };
        body.push(heading(section_heading, 2));
        body.extend(paragraphs(names));
    }
    page(copy.contributors_title, body)
}

/// The How to study page: the drafted paragraphs and the planned student workload.
pub fn how_to_study_content(
    copy: &CourseCopy,
    draft: &CourseDraft,
    workload_activities: &[DesignWorkloadActivity],
) -> Vec<GutenbergBlock> {
    let mut body: Vec<GutenbergBlock> = draft
        .how_to_study_paragraphs
        .iter()
        .filter_map(|p| non_empty_trimmed(p))
        .map(paragraph)
        .collect();
    let activities: Vec<String> = workload_activities
        .iter()
        .filter(|activity| activity.count > 0 && activity.minutes_each > 0)
        .filter_map(|activity| {
            non_empty_trimmed(&activity.title)
                .map(|title| (copy.workload_activity)(title, activity.count, activity.minutes_each))
        })
        .collect();
    if !activities.is_empty() {
        let total_minutes: u64 = workload_activities
            .iter()
            .filter(|activity| {
                activity.count > 0
                    && activity.minutes_each > 0
                    && non_empty_trimmed(&activity.title).is_some()
            })
            .map(|activity| u64::from(activity.count) * u64::from(activity.minutes_each))
            .sum();
        let total_hours = u32::try_from(total_minutes.div_ceil(60)).unwrap_or(u32::MAX);
        let activities: Vec<&str> = activities.iter().map(String::as_str).collect();
        body.push(heading(copy.workload_heading, 2));
        body.push(list(&activities));
        body.push(paragraph(&(copy.workload_total)(total_hours)));
    }
    page(copy.how_to_study_title, body)
}

/// The `#rrggbb` and `#rgb` colours of a free-text palette that white text is readable on, as
/// `#rrggbb` in palette order. Everything else in the text is ignored.
pub fn chapter_colors(palette: &str) -> Vec<String> {
    let chars: Vec<char> = palette.chars().collect();
    let mut colors = Vec::new();
    let mut index = 0;
    while index < chars.len() {
        if chars[index] != '#' {
            index += 1;
            continue;
        }
        let digits: String = chars[index + 1..]
            .iter()
            .take_while(|c| c.is_ascii_hexdigit())
            .collect();
        index += 1 + digits.len();
        let hex = match digits.len() {
            6 => digits.to_lowercase(),
            3 => digits
                .chars()
                .flat_map(|c| [c, c])
                .collect::<String>()
                .to_lowercase(),
            _ => continue,
        };
        if contrast_with_white(&hex) >= MIN_CONTRAST_WITH_WHITE {
            let color = format!("#{hex}");
            if !colors.contains(&color) {
                colors.push(color);
            }
        }
    }
    colors
}

/// WCAG 2 contrast ratio of white against `hex`, six hex digits without `#`.
fn contrast_with_white(hex: &str) -> f64 {
    let channel = |range: std::ops::Range<usize>| {
        let value = f64::from(u8::from_str_radix(&hex[range], 16).unwrap_or(0)) / 255.0;
        if value <= 0.04045 {
            value / 12.92
        } else {
            ((value + 0.055) / 1.055).powf(2.4)
        }
    };
    let luminance = 0.2126 * channel(0..2) + 0.7152 * channel(2..4) + 0.0722 * channel(4..6);
    1.05 / (luminance + 0.05)
}

/// Glossary entries from the style guide's terminology text: one per line written as
/// `term = definition`, `term: definition` or `term – definition`. Lines in no such form, such as
/// writing rules, are skipped.
pub fn glossary_entries(terminology: &str) -> Vec<(String, String)> {
    const SEPARATORS: [&str; 4] = ["=", ":", " – ", " — "];
    let mut entries: Vec<(String, String)> = Vec::new();
    for line in terminology.lines() {
        let line = line.trim().trim_start_matches(['-', '*', '•']).trim();
        let Some((term, definition)) = SEPARATORS
            .iter()
            .filter_map(|separator| line.split_once(separator))
            .min_by_key(|(term, _)| term.len())
        else {
            continue;
        };
        let (Some(term), Some(definition)) =
            (non_empty_trimmed(term), non_empty_trimmed(definition))
        else {
            continue;
        };
        if !entries
            .iter()
            .any(|(existing, _)| existing.eq_ignore_ascii_case(term))
        {
            entries.push((term.to_string(), definition.to_string()));
        }
    }
    entries
}
