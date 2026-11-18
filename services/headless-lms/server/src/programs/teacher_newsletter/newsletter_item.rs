use uuid::Uuid;

use crate::programs::teacher_newsletter::blocks::{section_block, stats_block};

#[derive(Clone, Copy)]
pub enum TeacherNewsletterItemFormat {
    Html,
    Text,
}

pub struct TeacherNewsletterItem {
    pub base_url: String,
    pub course_id: Uuid,
    pub course_name: String,
    pub returned_exercises_count: i64,
    pub completed_course_count: i64,
    pub started_course_count: i64,
    pub flagged_cheaters_count_period: i64,
    pub flagged_cheaters_count_total: i64,
    pub unread_feedback_count_period: i64,
    pub unread_feedback_count_total: i64,
    pub proposal_count_period: i64,
    pub proposal_count_total: i64,
}

impl TeacherNewsletterItem {
    pub fn as_html(&self) -> String {
        self.render(TeacherNewsletterItemFormat::Html)
    }

    pub fn as_text(&self) -> String {
        self.render(TeacherNewsletterItemFormat::Text)
    }

    fn render(&self, format: TeacherNewsletterItemFormat) -> String {
        let course_name = &self.course_name;
        let base_url = &self.base_url;
        let course_id = &self.course_id;

        let cheaters = section_block(
            format,
            self.flagged_cheaters_count_total,
            self.flagged_cheaters_count_period,
            "Suspected cheaters",
            "Students flagged by automatic detection as possible cheaters.",
            format!("{base_url}/manage/courses/{course_id}/other/cheaters/suspected"),
        );

        let feedback = section_block(
            format,
            self.unread_feedback_count_total,
            self.unread_feedback_count_period,
            "Feedback",
            "Unread feedback from students.",
            format!("{base_url}/manage/courses/{course_id}/feedback/feedback/unread"),
        );

        let proposals = section_block(
            format,
            self.proposal_count_total,
            self.proposal_count_period,
            "Proposals",
            "Proposals suggested by students regarding course material.",
            format!("{base_url}/manage/courses/{course_id}/feedback/change-requests/pending"),
        );

        let returned = stats_block(
            format,
            self.returned_exercises_count,
            "Students returned exercises",
        );

        let completed = stats_block(
            format,
            self.completed_course_count,
            "Students completed course",
        );

        let started = stats_block(format, self.started_course_count, "Students started course");

        match format {
            TeacherNewsletterItemFormat::Html => format!(
                r#"<h2 style="font-family: sans-serif; font-size: 24px; margin: 24px 0 12px; color: #1a2333;">{course_name}</h2>
                {cheaters}
                {feedback}
                {proposals}
                <table style="width: 100%; border-collapse: separate; border-spacing: 5px; table-layout: fixed; border-bottom: 3px dashed #EBEDEE; padding-bottom: 24px;">
                    <tbody>
                        <tr>{returned}{completed}{started}</tr>
                    </tbody>
                </table>"#
            ),
            TeacherNewsletterItemFormat::Text => format!(
                "{course_name}\n\n{cheaters}{feedback}{proposals}{started}{returned}{completed}\n\n"
            ),
        }
    }
}
