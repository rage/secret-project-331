/*!
Handlers for HTTP requests to `/api/v0/study-registry`.

The study registry provides an access to student completion records. It is generally only available
to authorized study registries, meaning that most endpoints will require a valid authorization token
to access.

When accessing study registry, the authorization token should be given as the following header:
```http
Authorization: Basic documentationOnlyExampleSecretKey-12345
```

For more details, please view the submodules.
*/

use actix_web::web::{self, ServiceConfig};

pub mod completion_registered_to_study_registry;
pub mod completions;

/// Add controllers from all the submodules.
#[doc(hidden)]
pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.service(
        web::scope("/completion-registered-to-study-registry")
            .configure(completion_registered_to_study_registry::_add_routes),
    )
    .service(web::scope("/completions").configure(completions::_add_routes));
}
