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

/// A course or page named by a course site URL.
#[derive(Debug, PartialEq, Eq)]
pub struct CoursePageRef {
    pub course_slug: String,
    /// The page path, percent-encoded as in the URL; `None` for the course URL itself.
    pub page_url_path: Option<String>,
}

/// Why [`parse_course_page_url`] didn't name a course.
#[derive(Debug, PartialEq, Eq)]
pub enum CourseUrlError {
    /// The configured `base_url` isn't a URL.
    InvalidBaseUrl,
    /// The URL is on another origin than `base_url`.
    OtherSite,
    /// The URL isn't `/org/<organization>/courses/<course>/<page path>`.
    NotACourseUrl,
}

/// The course and page of a course site URL on `base_url`'s origin; the inverse of
/// [`course_page_url`]. The organization segment is ignored, as on the course site.
pub fn parse_course_page_url(base_url: &str, url: &str) -> Result<CoursePageRef, CourseUrlError> {
    let base = Url::parse(base_url).map_err(|_| CourseUrlError::InvalidBaseUrl)?;
    let parsed = Url::parse(url).map_err(|_| CourseUrlError::NotACourseUrl)?;
    if parsed.origin() != base.origin() {
        return Err(CourseUrlError::OtherSite);
    }
    let segments: Vec<&str> = parsed
        .path_segments()
        .ok_or(CourseUrlError::NotACourseUrl)?
        .filter(|segment| !segment.is_empty())
        .collect();
    match segments.as_slice() {
        ["org", _, "courses", course, page @ ..] => Ok(CoursePageRef {
            course_slug: course.to_string(),
            page_url_path: (!page.is_empty()).then(|| format!("/{}", page.join("/"))),
        }),
        _ => Err(CourseUrlError::NotACourseUrl),
    }
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
