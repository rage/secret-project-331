pub fn section_block_html(count_total: i64, count_period: i64, title: &str, label: &str) -> String {
    let counts_new = if count_total - count_period == 0 {
        count_period
    } else {
        count_total - count_period
    };

    format!(
        r#"
            <table style="border-collapse: separate; width: 100%; margin-bottom: 8px;">
                <tbody>
                    <tr>
                        <td style="border: 3px solid #EBEDEE; padding-left: 16px; border-radius: 12px;">
                            <h2 style="margin-top: 0; margin-bottom: 0; font-weight: 600;">{title}</h2>
                            <p>{label}</p>
                            <table style="margin-bottom: 5px;">
                                <tbody>
                                    <tr>
                                        <td style="padding: 0; color: #1F6964; font-size: 32px; border: none; font-weight: bold;">{count_total}</td>
                                        <td style="border: none; padding: 0; padding-left: 5px;">(+{counts_new} new)</td>
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

pub fn stats_block_html(count: i64, label: &str) -> String {
    format!(
        r#"
        <td style="border: 3px solid #EBEDEE; border-radius: 12px;">
            <p style="font-size: 32px; text-align: center; margin-top: 1rem; color: #1F6964; font-weight: bold;">{count}</p>
            <p style="text-align: center; font-weight: 500;">{label}</p>
        </td>
        "#
    )
}

pub fn section_block_text(count_total: i64, count_period: i64, title: &str, label: &str) -> String {
    let counts_new = if count_total - count_period == 0 {
        count_period
    } else {
        count_total - count_period
    };
    format!("* {title}: {count_total} (+ {counts_new} new) — {label}\n")
}

pub fn stats_block_text(count: i64, label: &str) -> String {
    format!("* {label}: {count}\n")
}
