/*!
Contains error and result types for all the controllers.
*/

use crate::domain::authorization::AuthorizedResponse;
use actix_web::{
    HttpResponse, HttpResponseBuilder, error,
    http::{StatusCode, header::ContentType},
};
use backtrace::Backtrace;
use derive_more::Display;
use dpop_verifier::error::DpopError;
use headless_lms_models::{ModelError, ModelErrorType};
use headless_lms_utils::error::{
    backend_error::BackendError, backtrace_formatter::format_backtrace, util_error::UtilError,
};
use serde::{Deserialize, Serialize};
use tracing_error::SpanTrace;
#[cfg(feature = "ts_rs")]
use ts_rs::TS;
use uuid::Uuid;

/**
Used as the result types for all controllers.
Only put information here that you want to be visible to users.

See also [ControllerError] for documentation on how to return errors from controllers.
*/
pub type ControllerResult<T, E = ControllerError> = std::result::Result<AuthorizedResponse<T>, E>;

/// The type of [ControllerError] that occured.
#[derive(Debug, Display, Serialize, Deserialize)]
pub enum ControllerErrorType {
    /// HTTP status code 500.
    #[display("Internal server error")]
    InternalServerError,

    /// HTTP status code 400.
    #[display("Bad request")]
    BadRequest,

    /// HTTP status code 400.
    #[display("Bad request")]
    BadRequestWithData(ErrorData),

    /// HTTP status code 404.
    #[display("Not found")]
    NotFound,

    /// HTTP status code 401. Needs to log in.
    #[display("Unauthorized")]
    Unauthorized,

    /// HTTP status code 403. Is logged in but is not allowed to access the resource.
    #[display("Forbidden")]
    Forbidden,

    /// Varied response based on error
    #[display("OAuthError")]
    OAuthError(Box<OAuthErrorData>),
}

/**
Represents error messages that are sent in responses. Used as the error type in [ControllerError], which is used by all the controllers in the application.

All the information in the error is meant to be seen by the user. The type of error is determined by the [ControllerErrorType] enum, which is stored inside this struct. The type of the error determines which HTTP status code will be sent to the user.

## Examples

### Usage without source error

```no_run
# use headless_lms_server::prelude::*;
# fn random_function() -> ControllerResult<web::Json<()>> {
#    let token = skip_authorize();
#    let erroneous_condition = 1 == 1;
if erroneous_condition {
    return Err(ControllerError::new(
        ControllerErrorType::BadRequest,
        "Cannot create a new account when signed in.".to_string(),
        None,
    ));
}
# token.authorized_ok(web::Json(()))
# }
```

### Usage with a source error

Used when calling a function that returns an error that cannot be automatically converted to an ControllerError. (See `impl From<X>` implementations on this struct.)

```no_run
# use headless_lms_server::prelude::*;
# fn some_function_returning_an_error() -> ControllerResult<web::Json<()>> {
#    return Err(ControllerError::new(
#         ControllerErrorType::BadRequest,
#         "Cannot create a new account when signed in.".to_string(),
#         None,
#     ));
# }
#
# fn random_function() -> ControllerResult<web::Json<()>> {
#    let token = skip_authorize();
#    let erroneous_condition = 1 == 1;
some_function_returning_an_error().map_err(|original_error| {
    ControllerError::new(
        ControllerErrorType::InternalServerError,
        "Could not read file".to_string(),
        Some(original_error.into()),
    )
})?;
# token.authorized_ok(web::Json(()))
# }
```

### Example HTTP response from an error

```json
{
    "title": "Internal Server Error",
    "message": "pool timed out while waiting for an open connection",
    "source": "source of error"
}
```
*/
pub struct ControllerError {
    error_type: <ControllerError as BackendError>::ErrorType,
    message: String,
    /// Original error that caused this error.
    source: Option<anyhow::Error>,
    /// A trace of tokio tracing spans, generated automatically when the error is generated.
    span_trace: Box<SpanTrace>,
    /// Stack trace, generated automatically when the error is created.
    backtrace: Box<Backtrace>,
}

/// Custom formatter so that errors that get printed to the console are easy-to-read with proper context where the error is coming from.
impl std::fmt::Debug for ControllerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ControllerError")
            .field("error_type", &self.error_type)
            .field("message", &self.message)
            .field("source", &self.source)
            .finish()?;

        f.write_str("\n\nOperating system thread stack backtrace:\n")?;
        format_backtrace(&self.backtrace, f)?;

        f.write_str("\n\nTokio tracing span trace:\n")?;
        f.write_fmt(format_args!("{}\n", &self.span_trace))?;

        Ok(())
    }
}

impl std::error::Error for ControllerError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source.as_ref().and_then(|o| o.source())
    }

    fn cause(&self) -> Option<&dyn std::error::Error> {
        self.source()
    }
}

impl std::fmt::Display for ControllerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "ControllerError {:?} {:?}",
            self.error_type, self.message
        )
    }
}

impl BackendError for ControllerError {
    type ErrorType = ControllerErrorType;

    fn new<M: Into<String>, S: Into<Option<anyhow::Error>>>(
        error_type: Self::ErrorType,
        message: M,
        source_error: S,
    ) -> Self {
        Self::new_with_traces(
            error_type,
            message,
            source_error,
            Backtrace::new(),
            SpanTrace::capture(),
        )
    }

    fn backtrace(&self) -> Option<&Backtrace> {
        Some(&self.backtrace)
    }

    fn error_type(&self) -> &Self::ErrorType {
        &self.error_type
    }

    fn message(&self) -> &str {
        &self.message
    }

    fn span_trace(&self) -> &SpanTrace {
        &self.span_trace
    }

    fn new_with_traces<M: Into<String>, S: Into<Option<anyhow::Error>>>(
        error_type: Self::ErrorType,
        message: M,
        source_error: S,
        backtrace: Backtrace,
        span_trace: SpanTrace,
    ) -> Self {
        Self {
            error_type,
            message: message.into(),
            source: source_error.into(),
            span_trace: Box::new(span_trace),
            backtrace: Box::new(backtrace),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
#[serde(rename_all = "snake_case")]
pub enum ErrorData {
    BlockId(Uuid),
}

/// The format all error messages from the API is in
#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "ts_rs", derive(TS))]
pub struct ErrorResponse {
    pub title: String,
    pub message: String,
    pub source: Option<String>,
    pub data: Option<ErrorData>,
}

impl error::ResponseError for ControllerError {
    fn error_response(&self) -> HttpResponse {
        if let ControllerErrorType::InternalServerError = &self.error_type {
            use std::fmt::Write as _;
            let mut err_string = String::new();
            let mut source = Some(self as &dyn std::error::Error);
            while let Some(err) = source {
                let _ = write!(err_string, "{}\n    ", err);
                source = err.source();
            }
            error!("Internal server error: {}", err_string);
        }
        if let ControllerErrorType::OAuthError(data) = &self.error_type {
            if let Some(uri) = &data.redirect_uri {
                if let Ok(mut url) = url::Url::parse(uri) {
                    {
                        let mut qp = url.query_pairs_mut();
                        qp.append_pair("error", &data.error);
                        qp.append_pair("error_description", &data.error_description);
                        if let Some(state) = &data.state {
                            qp.append_pair("state", state);
                        }
                    }
                    let loc = url.to_string();
                    return HttpResponse::Found()
                        .append_header(("Location", loc))
                        .finish();
                }
            }

            let status = match data.error.as_str() {
                "invalid_client" => StatusCode::UNAUTHORIZED,     // 401
                "invalid_token" => StatusCode::UNAUTHORIZED,      // 401 (bearer)
                "invalid_dpop_proof" => StatusCode::UNAUTHORIZED, // 401 (dpop)
                "use_dpop_nonce" => StatusCode::UNAUTHORIZED,     // 401 (dpop)
                "insufficient_scope" => StatusCode::FORBIDDEN,    // 403
                _ => StatusCode::BAD_REQUEST,
            };

            let mut res = HttpResponse::build(status);
            // Small helper to safely embed values in WWW-Authenticate auth-param strings.
            fn escape_auth_param(s: &str) -> String {
                s.replace('\\', "\\\\").replace('"', "\\\"")
            }

            match data.error.as_str() {
                // OAuth2 Bearer challenges (RFC 6750 §3)
                "invalid_client" | "invalid_token" | "insufficient_scope" | "invalid_request" => {
                    let err = escape_auth_param(&data.error);
                    let desc = escape_auth_param(&data.error_description);
                    let hdr = format!(r#"Bearer error="{}", error_description="{}""#, err, desc);
                    res.append_header(("WWW-Authenticate", hdr));
                }

                // DPoP auth challenges (RFC 9449 §12.2)
                "invalid_dpop_proof" => {
                    let err = escape_auth_param(&data.error);
                    let desc = escape_auth_param(&data.error_description);
                    let hdr = format!(r#"DPoP error="{}", error_description="{}""#, err, desc);
                    res.append_header(("WWW-Authenticate", hdr));
                }

                "use_dpop_nonce" => {
                    let err = escape_auth_param(&data.error);
                    let desc = escape_auth_param(&data.error_description);
                    let hdr = format!(r#"DPoP error="{}", error_description="{}""#, err, desc);
                    res.append_header(("WWW-Authenticate", hdr));

                    // Provide the server-generated nonce (clients must echo it in the next proof)
                    if let Some(nonce) = &data.nonce {
                        res.append_header(("DPoP-Nonce", nonce.clone()));
                    }
                }

                _ => {}
            }

            // Prevent caching per RFC 6749 §5.1 (common practice for error responses too)
            res.append_header(("Cache-Control", "no-store"))
                .append_header(("Pragma", "no-cache"));

            return res.json(serde_json::json!({
                "error": data.error,
                "error_description": data.error_description
            }));
        }

        let status = self.status_code();

        let error_data = match &self.error_type {
            ControllerErrorType::BadRequestWithData(data) => Some(data.clone()),
            _ => None,
        };

        let source_message = self.source.as_ref().map(|anyhow_err| {
            if let Some(controller_err) = anyhow_err.downcast_ref::<ControllerError>() {
                controller_err.message.clone()
            } else {
                anyhow_err.to_string()
            }
        });

        let error_response = ErrorResponse {
            title: status
                .canonical_reason()
                .map(str::to_string)
                .unwrap_or_else(|| status.to_string()),
            message: self.message.clone(),
            source: source_message,
            data: error_data,
        };

        HttpResponseBuilder::new(status)
            .append_header(ContentType::json())
            .body(
                serde_json::to_string(&error_response).unwrap_or_else(|_| {
                    r#"{"title":"Internal Server Error","message":"Error occurred while formatting error message."}"#.to_string()
                }),
            )
    }

    fn status_code(&self) -> StatusCode {
        match self.error_type {
            ControllerErrorType::InternalServerError => StatusCode::INTERNAL_SERVER_ERROR,
            ControllerErrorType::BadRequest => StatusCode::BAD_REQUEST,
            ControllerErrorType::BadRequestWithData(_) => StatusCode::BAD_REQUEST,
            ControllerErrorType::NotFound => StatusCode::NOT_FOUND,
            ControllerErrorType::Unauthorized => StatusCode::UNAUTHORIZED,
            ControllerErrorType::Forbidden => StatusCode::FORBIDDEN,
            ControllerErrorType::OAuthError(_) => StatusCode::OK,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct OAuthErrorData {
    pub error: String,
    pub error_description: String,
    pub redirect_uri: Option<String>,
    pub state: Option<String>,
    pub nonce: Option<String>,
}

pub enum OAuthErrorCode {
    InvalidGrant,
    InvalidRequest,
    InvalidClient,
    InvalidToken,
    InsufficientScope,
    UnsupportedGrantType,
    UnsupportedResponseType,
    ServerError,
    InvalidDpopProof,
    UseDpopNonce,
}

impl OAuthErrorCode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::InvalidGrant => "invalid_grant",
            Self::InvalidRequest => "invalid_request",
            Self::InvalidClient => "invalid_client",
            Self::InvalidToken => "invalid_token",
            Self::InsufficientScope => "insufficient_scope",
            Self::UnsupportedGrantType => "unsupported_grant_type",
            Self::UnsupportedResponseType => "unsupported_response_type",
            Self::ServerError => "server_error",
            Self::InvalidDpopProof => "invalid_dpop_proof",
            Self::UseDpopNonce => "use_dpop_nonce",
        }
    }
}

impl From<anyhow::Error> for ControllerError {
    fn from(err: anyhow::Error) -> ControllerError {
        if let Some(sqlx::Error::RowNotFound) = err.downcast_ref::<sqlx::Error>() {
            return Self::new(ControllerErrorType::NotFound, err.to_string(), Some(err));
        }

        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err),
        )
    }
}

impl From<uuid::Error> for ControllerError {
    fn from(err: uuid::Error) -> ControllerError {
        Self::new(
            ControllerErrorType::BadRequest,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<sqlx::Error> for ControllerError {
    fn from(err: sqlx::Error) -> ControllerError {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<git2::Error> for ControllerError {
    fn from(err: git2::Error) -> ControllerError {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<actix_web::Error> for ControllerError {
    fn from(err: actix_web::Error) -> Self {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            None,
        )
    }
}

impl From<actix_multipart::MultipartError> for ControllerError {
    fn from(err: actix_multipart::MultipartError) -> Self {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            None,
        )
    }
}

impl From<jsonwebtoken::errors::Error> for ControllerError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            None,
        )
    }
}

impl From<ModelError> for ControllerError {
    fn from(err: ModelError) -> Self {
        let backtrace: Backtrace =
            match headless_lms_utils::error::backend_error::BackendError::backtrace(&err) {
                Some(backtrace) => backtrace.clone(),
                _ => Backtrace::new(),
            };
        let span_trace = err.span_trace().clone();
        match err.error_type() {
            ModelErrorType::RecordNotFound => Self::new_with_traces(
                ControllerErrorType::NotFound,
                err.to_string(),
                Some(err.into()),
                backtrace,
                span_trace,
            ),
            ModelErrorType::NotFound => Self::new_with_traces(
                ControllerErrorType::NotFound,
                err.to_string(),
                Some(err.into()),
                backtrace,
                span_trace,
            ),
            ModelErrorType::PreconditionFailed => Self::new_with_traces(
                ControllerErrorType::BadRequest,
                err.message().to_string(),
                Some(err.into()),
                backtrace,
                span_trace,
            ),
            ModelErrorType::PreconditionFailedWithCMSAnchorBlockId { description, id } => {
                Self::new_with_traces(
                    ControllerErrorType::BadRequestWithData(ErrorData::BlockId(*id)),
                    description.to_string(),
                    Some(err.into()),
                    backtrace,
                    span_trace,
                )
            }
            ModelErrorType::DatabaseConstraint { description, .. } => Self::new_with_traces(
                ControllerErrorType::BadRequest,
                description.to_string(),
                Some(err.into()),
                backtrace,
                span_trace,
            ),
            ModelErrorType::InvalidRequest => Self::new_with_traces(
                ControllerErrorType::BadRequest,
                err.message().to_string(),
                Some(err.into()),
                backtrace,
                span_trace,
            ),
            _ => Self::new_with_traces(
                ControllerErrorType::InternalServerError,
                err.to_string(),
                Some(err.into()),
                backtrace,
                span_trace,
            ),
        }
    }
}

impl From<UtilError> for ControllerError {
    fn from(err: UtilError) -> Self {
        let backtrace: Backtrace =
            match headless_lms_utils::error::backend_error::BackendError::backtrace(&err) {
                Some(backtrace) => backtrace.clone(),
                _ => Backtrace::new(),
            };
        let span_trace = err.span_trace().clone();
        Self::new_with_traces(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
            backtrace,
            span_trace,
        )
    }
}

impl From<serde_json::Error> for ControllerError {
    fn from(err: serde_json::Error) -> Self {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<base64::DecodeError> for ControllerError {
    fn from(err: base64::DecodeError) -> Self {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<std::string::FromUtf8Error> for ControllerError {
    fn from(err: std::string::FromUtf8Error) -> Self {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<pkcs8::spki::Error> for ControllerError {
    fn from(err: pkcs8::spki::Error) -> Self {
        Self::new(
            ControllerErrorType::InternalServerError,
            err.to_string(),
            Some(err.into()),
        )
    }
}

impl From<dpop_verifier::error::DpopError> for ControllerError {
    fn from(err: DpopError) -> Self {
        let oauth_error = match &err {
            DpopError::MultipleDpopHeaders
            | DpopError::InvalidDpopHeader
            | DpopError::MissingDpopHeader
            | DpopError::MalformedJws
            | DpopError::InvalidAlg(_)
            | DpopError::UnsupportedAlg(_)
            | DpopError::InvalidSignature
            | DpopError::BadJwk(_)
            | DpopError::MissingClaim(_)
            | DpopError::InvalidMethod
            | DpopError::HtmMismatch
            | DpopError::MalformedHtu
            | DpopError::HtuMismatch
            | DpopError::AthMalformed
            | DpopError::MissingAth
            | DpopError::AthMismatch
            | DpopError::FutureSkew
            | DpopError::Stale
            | DpopError::Replay
            | DpopError::JtiTooLong
            | DpopError::NonceMismatch
            | DpopError::NonceStale
            | DpopError::InvalidHmacConfig
            | DpopError::MissingNonce => OAuthErrorData {
                error: OAuthErrorCode::InvalidDpopProof.as_str().into(),
                error_description: err.to_string(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },

            DpopError::Store(e) => OAuthErrorData {
                error: OAuthErrorCode::ServerError.as_str().into(),
                error_description: format!("DPoP storage error: {e}"),
                redirect_uri: None,
                state: None,
                nonce: None,
            },

            DpopError::UseDpopNonce { nonce } => OAuthErrorData {
                error: OAuthErrorCode::UseDpopNonce.as_str().into(), // per RFC 9449 §12.2
                error_description: "Server requires DPoP nonce".into(),
                redirect_uri: None,
                state: None,
                nonce: Some(nonce.clone()),
            },
        };

        ControllerError::new(
            ControllerErrorType::OAuthError(Box::new(oauth_error)),
            err.to_string(),
            Some(err.into()),
        )
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PkceFlowError {
    /// Request is malformed or missing a required PKCE parameter
    #[error("{0}")]
    InvalidRequest(&'static str),

    /// PKCE check failed (e.g., code_verifier doesn't match stored challenge)
    #[error("{0}")]
    InvalidGrant(&'static str),

    /// Server-side (DB/state) problem
    #[error("{0}")]
    ServerError(&'static str),
}

impl From<PkceFlowError> for ControllerError {
    fn from(err: PkceFlowError) -> Self {
        let data = match &err {
            PkceFlowError::InvalidRequest(msg) => OAuthErrorData {
                error: OAuthErrorCode::InvalidRequest.as_str().into(),
                error_description: (*msg).into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
            PkceFlowError::InvalidGrant(msg) => OAuthErrorData {
                error: OAuthErrorCode::InvalidGrant.as_str().into(),
                error_description: (*msg).into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
            PkceFlowError::ServerError(msg) => OAuthErrorData {
                error: OAuthErrorCode::ServerError.as_str().into(),
                error_description: (*msg).into(),
                redirect_uri: None,
                state: None,
                nonce: None,
            },
        };

        ControllerError::new(
            ControllerErrorType::OAuthError(Box::new(data)),
            err.to_string(),
            Some(anyhow::anyhow!(err)),
        )
    }
}

impl From<headless_lms_models::library::oauth::pkce::PkceError> for PkceFlowError {
    fn from(_: headless_lms_models::library::oauth::pkce::PkceError) -> Self {
        // Both BadLength and BadCharset are "invalid_request" per OAuth spec
        PkceFlowError::InvalidRequest("invalid code_verifier")
    }
}

impl From<headless_lms_models::library::oauth::pkce::PkceError> for ControllerError {
    fn from(err: headless_lms_models::library::oauth::pkce::PkceError) -> Self {
        PkceFlowError::from(err).into()
    }
}
