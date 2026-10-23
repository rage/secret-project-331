use url::Url;

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

/// The public URL of a course material page, or `None` when `base_url` is not a valid URL.
pub fn course_page_url(
    base_url: &str,
    organization_slug: &str,
    course_slug: &str,
    page_url_path: &str,
) -> Option<String> {
    let mut url = Url::parse(base_url).ok()?;
    // `set_path` percent-encodes, which the stored path needs: it keeps non-ASCII verbatim.
    url.set_path(&format!(
        "/org/{organization_slug}/courses/{course_slug}{page_url_path}"
    ));
    Some(url.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn course_page_url_percent_encodes_the_stored_path() {
        assert_eq!(
            course_page_url(
                "https://courses.mooc.fi",
                "uh-cs",
                "java",
                "/chapter-1/tehtävä"
            )
            .as_deref(),
            Some("https://courses.mooc.fi/org/uh-cs/courses/java/chapter-1/teht%C3%A4v%C3%A4")
        );
    }

    #[test]
    fn course_page_url_needs_a_valid_base_url() {
        assert_eq!(course_page_url("not a url", "org", "course", "/"), None);
    }
}
