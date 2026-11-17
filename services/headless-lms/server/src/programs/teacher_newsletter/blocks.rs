use crate::programs::teacher_newsletter::newsletter_item::TeacherNewsletterItemFormat;

pub fn section_block(
    format: TeacherNewsletterItemFormat,
    count_total: i64,
    count_period: i64,
    title: &str,
    label: &str,
    link: String,
) -> String {
    match format {
        TeacherNewsletterItemFormat::Html => {
            format!(
                r#"
            <table style="border-collapse: separate; width: 100%; margin-bottom: 8px;">
                <tbody>
                    <tr>
                        <td style="border: 3px solid #EBEDEE; padding-left: 16px; border-radius: 12px;">
                            <h2 style="margin-top: 0; margin-bottom: 0; font-weight: 600;">{title}</h2>
                            <p>{label}</p>
                            <table style="margin-bottom: 0;">
                                <tbody>
                                    <tr>
                                        <td style="padding: 0; color: #1F6964; font-size: 32px; border: none; font-weight: bold;">{count_total}</td>
                                        <td style="border: none; padding: 0; padding-left: 5px;">(+{count_period} new)</td>
                                        <td style="border: none; padding: 0 5px;"></td>
                                        <td style="background-color: #1F6964; border-radius: 6px; mso-padding-alt: 2px 10px; padding: 2px 10px; border: none;">
                                          <a href="{link}" style="display: inline-block; font-size: 16px; line-height: 20px; font-weight: 600; color: #FFFFFF; text-decoration: none; border: none;" >Review</a>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <span style="font-weight: 500;">Total</span>
                        </td>
                    </tr>
                </tbody>
            </table>
            "#
            )
        }
        TeacherNewsletterItemFormat::Text => {
            format!("* {title}: {count_total} (+{count_period} new) — {label} Review: {link}\n")
        }
    }
}

pub fn stats_block(format: TeacherNewsletterItemFormat, count: i64, label: &str) -> String {
    match format {
        TeacherNewsletterItemFormat::Html => {
            format!(
                r#"
                <td class="stats-block" style="border: 3px solid #EBEDEE; border-radius: 12px;">
                    <p style="font-size: 32px; text-align: center; margin-top: 1rem; color: #1F6964; font-weight: bold;">{count}</p>
                    <p style="text-align: center; font-weight: 500;">{label}</p>
                </td>
                "#
            )
        }
        TeacherNewsletterItemFormat::Text => format!("* {label}: {count}\n"),
    }
}
