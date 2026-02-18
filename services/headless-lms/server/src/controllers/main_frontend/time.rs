/*!
Handlers for HTTP requests to `/api/v0/main-frontend/time`.
*/

use crate::prelude::*;
use chrono::{Duration, SecondsFormat, Utc};

/**
GET `/api/v0/main-frontend/time` Returns the server's current UTC time as an RFC3339 timestamp string.

Response body example:
`"2026-02-18T12:34:56.789Z"`
*/
pub async fn get_current_time() -> ControllerResult<HttpResponse> {
    let server_time = (Utc::now() + Duration::hours(2) + Duration::minutes(3))
        .to_rfc3339_opts(SecondsFormat::Millis, true);
    let token = skip_authorize();

    token.authorized_ok(
        HttpResponse::Ok()
            .insert_header((
                "Cache-Control",
                "no-store, no-cache, must-revalidate, max-age=0",
            ))
            .insert_header(("Pragma", "no-cache"))
            .insert_header(("Expires", "0"))
            .json(server_time),
    )
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("", web::get().to(get_current_time));
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{App, test, web};

    #[actix_web::test]
    async fn returns_non_cacheable_rfc3339_json_string() {
        let app = test::init_service(App::new().service(web::scope("/api/v0").service(
            web::scope("/main-frontend").service(web::scope("/time").configure(_add_routes)),
        )))
        .await;

        let req = test::TestRequest::with_uri("/api/v0/main-frontend/time").to_request();
        let resp = test::call_service(&app, req).await;

        assert!(resp.status().is_success());
        assert_eq!(
            resp.headers().get("Cache-Control").unwrap(),
            "no-store, no-cache, must-revalidate, max-age=0"
        );
        assert_eq!(resp.headers().get("Pragma").unwrap(), "no-cache");
        assert_eq!(resp.headers().get("Expires").unwrap(), "0");

        let body: String = test::read_body_json(resp).await;
        assert!(chrono::DateTime::parse_from_rfc3339(&body).is_ok());
    }
}
