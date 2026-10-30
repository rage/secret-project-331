//! OAuth Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document): a client
//! whose `client_id` is an https URL is registered by fetching the JSON document at that URL.
//!
//! The URL comes from whoever starts an authorization request, so fetching it must not reach
//! internal services: the host must resolve only to public addresses, the connection is pinned to
//! the checked addresses, redirects are not followed and the response size and time are capped.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::num::NonZeroU32;
use std::sync::LazyLock;
use std::time::Duration;

use chrono::Utc;
use governor::{DefaultKeyedRateLimiter, Quota};
use headless_lms_models::{
    library::oauth::scopes::metadata_document_client_scopes,
    oauth_client::{MetadataDocumentClient, OAuthClient},
};
use serde::Deserialize;
use sqlx::{PgConnection, PgPool};
use url::Url;
use uuid::Uuid;

use crate::domain::error::{ControllerError, OAuthErrorCode};
use crate::domain::oauth::helpers::{oauth_error, oauth_invalid_request};

/// The registration is re-fetched when the cached copy is older than this.
const CACHE_LIFETIME: chrono::Duration = chrono::Duration::hours(1);
/// A cached copy this old is still used when the document cannot be fetched.
const STALE_CACHE_LIFETIME: chrono::Duration = chrono::Duration::days(7);
const MAX_DOCUMENT_BYTES: usize = 5 * 1024;
const FETCH_TIMEOUT: Duration = Duration::from_secs(5);
/// Per server process; an agent registers one document, so this only bounds abuse.
const NEW_DOCUMENTS_PER_USER_PER_HOUR: u32 = 10;
/// Per server process; a document's host is fetched again at most this often, however many
/// authorize requests name it.
const REFETCHES_PER_DOCUMENT_PER_HOUR: u32 = 6;

static NEW_DOCUMENT_FETCHES: LazyLock<DefaultKeyedRateLimiter<Uuid>> = LazyLock::new(|| {
    DefaultKeyedRateLimiter::keyed(Quota::per_hour(
        NonZeroU32::new(NEW_DOCUMENTS_PER_USER_PER_HOUR).expect("the quota is positive"),
    ))
});

static DOCUMENT_REFETCHES: LazyLock<DefaultKeyedRateLimiter<String>> = LazyLock::new(|| {
    DefaultKeyedRateLimiter::keyed(Quota::per_hour(
        NonZeroU32::new(REFETCHES_PER_DOCUMENT_PER_HOUR).expect("the quota is positive"),
    ))
});

/// Whether the client id names a metadata document rather than a registered client.
pub fn is_metadata_document_client_id(client_id: &str) -> bool {
    client_id.starts_with("https://")
}

#[derive(Debug, Deserialize)]
struct ClientMetadataDocument {
    client_id: String,
    client_name: Option<String>,
    client_uri: Option<String>,
    #[serde(default)]
    redirect_uris: Vec<String>,
    token_endpoint_auth_method: Option<String>,
    grant_types: Option<Vec<String>>,
    response_types: Option<Vec<String>>,
    client_secret: Option<String>,
}

/// The stored registration for a metadata document `client_id`, as last fetched, without
/// fetching; `None` if the document was never fetched.
pub async fn find_cached_client(
    conn: &mut PgConnection,
    client_id: &str,
) -> Result<Option<OAuthClient>, ControllerError> {
    match OAuthClient::find_by_client_id_optional(conn, client_id).await? {
        Some(cached) if !cached.is_metadata_document_client() => Err(oauth_invalid_request(
            "client_id is registered without a metadata document",
            None,
            None,
        )),
        cached => Ok(cached),
    }
}

/// The client registration for a metadata document `client_id`, fetched and cached as needed.
/// `user_id` is the signed-in user the fetch is made for: fetching a document that was never
/// fetched before counts against their hourly quota.
///
/// No pooled connection is held while the document is fetched. A cached copy older than the cache
/// lifetime but still usable is returned at once and refreshed in the background.
pub async fn resolve_client(
    pool: &PgPool,
    client_id: &str,
    user_id: Uuid,
) -> Result<OAuthClient, ControllerError> {
    let cached = find_cached_client(&mut *pool.acquire().await?, client_id).await?;
    let is_limited = match cached {
        Some(cached) => {
            let age = cached
                .metadata_document_fetched_at
                .map_or(chrono::TimeDelta::MAX, |fetched_at| Utc::now() - fetched_at);
            if age < CACHE_LIFETIME {
                return Ok(cached);
            }
            if age < STALE_CACHE_LIFETIME {
                if DOCUMENT_REFETCHES.check_key(&client_id.to_string()).is_ok() {
                    let pool = pool.clone();
                    let client_id = client_id.to_string();
                    tokio::spawn(async move {
                        if let Err(reason) = fetch_and_store(&pool, &client_id).await {
                            tracing::warn!(
                                client_id,
                                %reason,
                                "Refreshing a client metadata document failed"
                            );
                        }
                    });
                }
                return Ok(cached);
            }
            DOCUMENT_REFETCHES
                .check_key(&client_id.to_string())
                .is_err()
        }
        None => NEW_DOCUMENT_FETCHES.check_key(&user_id).is_err(),
    };
    if is_limited {
        return Err(oauth_error(
            OAuthErrorCode::TemporarilyUnavailable,
            "too many client metadata documents were fetched; try again later",
            None,
            None,
        ));
    }
    fetch_and_store(pool, client_id).await.map_err(|reason| {
        tracing::warn!(client_id, %reason, "Fetching a client metadata document failed");
        oauth_invalid_request(
            "the client metadata document could not be fetched or is invalid",
            None,
            None,
        )
    })
}

async fn fetch_and_store(pool: &PgPool, client_id: &str) -> Result<OAuthClient, String> {
    let document = fetch_and_validate(client_id).await?;
    let scopes = metadata_document_client_scopes();
    let client_name = document.client_name.clone().unwrap_or_else(|| {
        Url::parse(client_id)
            .ok()
            .and_then(|url| url.host_str().map(str::to_string))
            .unwrap_or_else(|| client_id.to_string())
    });
    let mut conn = pool
        .acquire()
        .await
        .map_err(|err| format!("no database connection: {err}"))?;
    OAuthClient::upsert_metadata_document_client(
        &mut conn,
        MetadataDocumentClient {
            client_id,
            client_name: &client_name,
            redirect_uris: &document.redirect_uris,
            client_uri: document.client_uri.as_deref(),
            scopes: &scopes,
        },
    )
    .await
    .map_err(|err| format!("storing the client failed: {err}"))
}

/// Checks the `client_id` URL as the draft requires: https, a host, a path, no fragment, no
/// credentials and no dot segments. Returns the URL and its host.
fn validate_client_id_url(client_id: &str) -> Result<(Url, String), String> {
    let url = Url::parse(client_id).map_err(|err| format!("client_id is not a URL: {err}"))?;
    if url.scheme() != "https" {
        return Err("client_id must use https".into());
    }
    if url.fragment().is_some() || !url.username().is_empty() || url.password().is_some() {
        return Err("client_id must not have a fragment or credentials".into());
    }
    if url.path() == "/" || url.path().is_empty() {
        return Err("client_id must have a path".into());
    }
    let raw_path = client_id
        .split_once("://")
        .and_then(|(_, rest)| rest.find('/').map(|i| &rest[i..]))
        .unwrap_or("");
    if raw_path
        .split(['/', '?'])
        .any(|segment| segment == "." || segment == "..")
    {
        return Err("client_id must not have dot path segments".into());
    }
    let host = url
        .host_str()
        .ok_or("client_id must have a host")?
        .to_string();
    Ok((url, host))
}

async fn fetch_and_validate(client_id: &str) -> Result<ClientMetadataDocument, String> {
    let (url, host) = validate_client_id_url(client_id)?;
    let port = url.port_or_known_default().unwrap_or(443);
    let addresses: Vec<SocketAddr> = tokio::time::timeout(
        FETCH_TIMEOUT,
        tokio::net::lookup_host((host.as_str(), port)),
    )
    .await
    .map_err(|_| "resolving the client_id host timed out".to_string())?
    .map_err(|err| format!("resolving the client_id host failed: {err}"))?
    .collect();
    if addresses.is_empty() {
        return Err("the client_id host has no addresses".into());
    }
    if let Some(address) = addresses.iter().find(|a| !is_public_address(a.ip())) {
        return Err(format!(
            "the client_id host resolves to a non-public address {}",
            address.ip()
        ));
    }

    let client = headless_lms_utils::http::base_client_builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(FETCH_TIMEOUT)
        .https_only(true)
        .resolve_to_addrs(&host, &addresses)
        .build()
        .map_err(|err| format!("building the HTTP client failed: {err}"))?;
    let mut response = client
        .get(url.clone())
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|err| format!("fetching the document failed: {err}"))?;
    if !response.status().is_success() {
        return Err(format!("the document responded with {}", response.status()));
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|err| format!("reading the document failed: {err}"))?
    {
        body.extend_from_slice(&chunk);
        if body.len() > MAX_DOCUMENT_BYTES {
            return Err("the document is too large".into());
        }
    }
    let document: ClientMetadataDocument =
        serde_json::from_slice(&body).map_err(|err| format!("the document is not valid: {err}"))?;
    validate_document(&document, client_id)?;
    Ok(document)
}

/// Redirect URIs are left to the database's `is_valid_oauth_uri`, the one rule for every client.
fn validate_document(document: &ClientMetadataDocument, client_id: &str) -> Result<(), String> {
    if document.client_id != client_id {
        return Err("the document's client_id does not match its URL".into());
    }
    if document.client_secret.is_some() {
        return Err("the document must not contain a client_secret".into());
    }
    if let Some(method) = &document.token_endpoint_auth_method
        && method != "none"
    {
        return Err(format!(
            "token_endpoint_auth_method {method} is not supported; use none"
        ));
    }
    if let Some(grant_types) = &document.grant_types
        && !grant_types.iter().any(|g| g == "authorization_code")
    {
        return Err("grant_types must include authorization_code".into());
    }
    if let Some(response_types) = &document.response_types
        && !response_types.iter().any(|r| r == "code")
    {
        return Err("response_types must include code".into());
    }
    if let Some(uri) = &document.client_uri
        && !uri.starts_with("https://")
    {
        return Err(format!("{uri} must be an https URL"));
    }
    if let Some(name) = &document.client_name
        && (name.trim().is_empty() || name.chars().count() > 100)
    {
        return Err("client_name must be 1-100 characters".into());
    }
    Ok(())
}

fn is_public_address(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_public_ipv4(ip),
        IpAddr::V6(ip) => match ip.to_ipv4() {
            Some(embedded) => is_public_ipv4(embedded),
            None => is_public_ipv6(ip),
        },
    }
}

fn is_public_ipv4(ip: Ipv4Addr) -> bool {
    let [a, b, ..] = ip.octets();
    !(ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_unspecified()
        || ip.is_multicast()
        || a == 0
        || (a == 100 && (64..128).contains(&b))
        || (a == 192 && b == 0)
        || (a == 198 && (18..20).contains(&b))
        || a >= 240)
}

fn is_public_ipv6(ip: Ipv6Addr) -> bool {
    let [first, second, ..] = ip.segments();
    !(ip.is_loopback()
        || ip.is_unspecified()
        || ip.is_multicast()
        || (first & 0xfe00) == 0xfc00
        || (first & 0xffc0) == 0xfe80
        || first == 0x2001 && second == 0x0db8
        // 6to4 and Teredo tunnel to IPv4 addresses that may be private.
        || first == 0x2002
        || first == 0x2001 && second == 0
        || first == 0x0064 && second == 0xff9b)
}
