/*!
Handlers for HTTP requests to `/api/v0/other-domain-redirects`.
*/

use actix_web::http::header;

use crate::{domain::authorization::skip_authorize, prelude::*};
/**
GET `/api/v0/other-domain-redirects/.*` Redirects a domain that is not a main domain to the correct course.

For example <https://example-course.mooc.fi> could redirect one to <https://courses.mooc.fi/org/uh-cs/courses/example-course>.
Paths after the domain are supported, too. For example, <https://example-course.mooc.fi/a/b> would redirect one to <https://courses.mooc.fi/org/uh-cs/courses/example-course/a/b>.
The request url is rewritten by the other domain ingress so that right requests end up here.
**/
pub async fn redirect_other_domain(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    params: web::Path<String>,
    app_conf: web::Data<ApplicationConfiguration>,
) -> ControllerResult<HttpResponse> {
    let path = params.into_inner();
    if let Some(host) = req.headers().get(header::HOST) {
        let domain = host.to_str().map_err(|e| {
            ControllerError::new(
                ControllerErrorType::BadRequest,
                "HOST is not a valid string".to_string(),
                Some(e.into()),
            )
        })?;

        let mut conn = pool.acquire().await?;
        let redirection =
            models::other_domain_to_course_redirections::get_by_domain(&mut conn, domain).await?;
        let course = models::courses::get_course(&mut conn, redirection.course_id).await?;
        let organization =
            models::organizations::get_organization(&mut conn, course.organization_id).await?;
        let token = skip_authorize();
        return token.authorized_ok(
            HttpResponse::TemporaryRedirect()
                .insert_header((
                    header::LOCATION,
                    format!(
                        "{}/org/{}/courses/{}/{}",
                        app_conf.base_url, organization.slug, course.slug, path
                    ),
                ))
                .finish(),
        );
    }

    Err(ControllerError::new(
        ControllerErrorType::BadRequest,
        "No HOST header provided. Don't know where the request is supposed to be directed."
            .to_string(),
        None,
    ))
}
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("{url_path:.*}", web::get().to(redirect_other_domain));
}
