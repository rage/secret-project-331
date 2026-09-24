pub fn build_course_url(base_url: &str, org_slug: &str, course_slug: &str) -> String {
    format!(
        "{}/org/{}/courses/{}",
        base_url.trim_end_matches('/'),
        org_slug,
        course_slug,
    )
}

pub fn build_courses_base_url(base_url: &str, org_slug: &str) -> String {
    format!(
        "{}/org/{}/courses",
        base_url.trim_end_matches('/'),
        org_slug,
    )
}
