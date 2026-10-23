//! OAuth Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document): a client
//! whose `client_id` is an https URL is registered by fetching the JSON document at that URL.
//!
//! The URL comes from whoever starts an authorization request, so fetching it must not reach
//! internal services: the host must resolve only to public addresses, the connection is pinned to
//! the checked addresses, redirects are not followed and the response size and time are capped.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::time::Duration;

use chrono::Utc;
use headless_lms_models::{
    library::oauth::mcp::McpScope,
    oauth_client::{MetadataDocumentClient, OAuthClient},
};
use serde::Deserialize;
use sqlx::PgConnection;
use url::Url;

use crate::domain::error::ControllerError;

/// The registration is re-fetched when the cached copy is older than this.
const CACHE_LIFETIME: chrono::Duration = chrono::Duration::hours(1);
/// A cached copy this old is still used when the document cannot be fetched.
const STALE_CACHE_LIFETIME: chrono::Duration = chrono::Duration::days(7);
const MAX_DOCUMENT_BYTES: usize = 5 * 1024;
const FETCH_TIMEOUT: Duration = Duration::from_secs(5);

/// Scopes a metadata document client may request: the MCP scopes and `offline_access`.
pub fn metadata_document_client_scopes() -> Vec<String> {
    McpScope::ALL
        .iter()
        .map(|scope| scope.as_str().to_string())
        .chain(std::iter::once("offline_access".to_string()))
        .collect()
}

/// Whether the client id names a metadata document rather than a registered client.
pub fn is_metadata_document_client_id(client_id: &str) -> bool {
    client_id.starts_with("https://")
}

#[derive(Debug, Deserialize)]
struct ClientMetadataDocument {
    client_id: String,
    client_name: Option<String>,
    client_uri: Option<String>,
    logo_uri: Option<String>,
    #[serde(default)]
    redirect_uris: Vec<String>,
    token_endpoint_auth_method: Option<String>,
    grant_types: Option<Vec<String>>,
    response_types: Option<Vec<String>>,
    client_secret: Option<String>,
}

/// The client registration for a metadata document `client_id`, fetched and cached as needed.
pub async fn resolve_client(
    conn: &mut PgConnection,
    client_id: &str,
) -> Result<OAuthClient, ControllerError> {
    let cached = OAuthClient::find_by_client_id_optional(conn, client_id).await?;
    if let Some(cached) = &cached {
        let Some(fetched_at) = cached.metadata_document_fetched_at else {
            return Err(invalid_client(
                "client_id is registered without a metadata document",
            ));
        };
        if Utc::now() - fetched_at < CACHE_LIFETIME {
            return Ok(OAuthClient::find_by_id(conn, cached.id).await?);
        }
    }
    match fetch_and_validate(client_id).await {
        Ok(document) => {
            let scopes = metadata_document_client_scopes();
            let client_name = document.client_name.clone().unwrap_or_else(|| {
                Url::parse(client_id)
                    .ok()
                    .and_then(|url| url.host_str().map(str::to_string))
                    .unwrap_or_else(|| client_id.to_string())
            });
            let client = OAuthClient::upsert_metadata_document_client(
                conn,
                MetadataDocumentClient {
                    client_id,
                    client_name: &client_name,
                    redirect_uris: &document.redirect_uris,
                    client_uri: document.client_uri.as_deref(),
                    logo_uri: document.logo_uri.as_deref(),
                    scopes: &scopes,
                },
            )
            .await?;
            Ok(client)
        }
        Err(reason) => {
            tracing::warn!(client_id, %reason, "Fetching a client metadata document failed");
            match cached {
                Some(cached)
                    if cached
                        .metadata_document_fetched_at
                        .is_some_and(|at| Utc::now() - at < STALE_CACHE_LIFETIME) =>
                {
                    Ok(cached)
                }
                _ => Err(invalid_client(
                    "the client metadata document could not be fetched or is invalid",
                )),
            }
        }
    }
}

fn invalid_client(description: &'static str) -> ControllerError {
    crate::domain::oauth::helpers::oauth_invalid_request(description, None, None)
}

/// Checks the `client_id` URL as the draft requires: https, a path, no fragment, no credentials
/// and no dot segments.
fn validate_client_id_url(client_id: &str) -> Result<Url, String> {
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
    if url.host_str().is_none() {
        return Err("client_id must have a host".into());
    }
    Ok(url)
}

async fn fetch_and_validate(client_id: &str) -> Result<ClientMetadataDocument, String> {
    let url = validate_client_id_url(client_id)?;
    let host = url.host_str().ok_or("client_id has no host")?.to_string();
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

    let client = reqwest::Client::builder()
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
    if document.redirect_uris.is_empty() {
        return Err("redirect_uris must not be empty".into());
    }
    for redirect_uri in &document.redirect_uris {
        let parsed = Url::parse(redirect_uri)
            .map_err(|_| format!("redirect_uri {redirect_uri} is not a URL"))?;
        if parsed.fragment().is_some() {
            return Err(format!("redirect_uri {redirect_uri} has a fragment"));
        }
        let is_allowed = match parsed.scheme() {
            "https" => true,
            "http" => is_loopback_host(&parsed),
            "javascript" | "data" | "file" | "vbscript" => false,
            _ => true,
        };
        if !is_allowed {
            return Err(format!("redirect_uri {redirect_uri} is not allowed"));
        }
    }
    for uri in [&document.client_uri, &document.logo_uri]
        .into_iter()
        .flatten()
    {
        if !uri.starts_with("https://") {
            return Err(format!("{uri} must be an https URL"));
        }
    }
    if let Some(name) = &document.client_name
        && (name.trim().is_empty() || name.chars().count() > 100)
    {
        return Err("client_name must be 1-100 characters".into());
    }
    Ok(())
}

/// Whether the URL's host is a loopback address or `localhost`.
pub fn is_loopback_host(url: &Url) -> bool {
    match url.host() {
        Some(url::Host::Domain(domain)) => domain.eq_ignore_ascii_case("localhost"),
        Some(url::Host::Ipv4(ip)) => ip.is_loopback(),
        Some(url::Host::Ipv6(ip)) => ip.is_loopback(),
        None => false,
    }
}

fn is_public_address(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_public_ipv4(ip),
        IpAddr::V6(ip) => match ip.to_ipv4_mapped() {
            Some(mapped) => is_public_ipv4(mapped),
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
    let first = ip.segments()[0];
    !(ip.is_loopback()
        || ip.is_unspecified()
        || ip.is_multicast()
        || (first & 0xfe00) == 0xfc00
        || (first & 0xffc0) == 0xfe80
        || first == 0x2001 && ip.segments()[1] == 0x0db8
        || first == 0x0064 && ip.segments()[1] == 0xff9b)
}

/// Whether a requested redirect URI matches one of the registered ones. Loopback redirect URIs
/// match regardless of port, because native clients listen on whatever port is free (RFC 8252
/// §7.3).
pub fn redirect_uri_matches(registered: &[String], requested: &str) -> bool {
    if registered.iter().any(|r| r == requested) {
        return true;
    }
    let Ok(requested_url) = Url::parse(requested) else {
        return false;
    };
    if requested_url.scheme() != "http" || !is_loopback_host(&requested_url) {
        return false;
    }
    registered.iter().any(|r| {
        Url::parse(r).is_ok_and(|registered_url| {
            registered_url.scheme() == "http"
                && registered_url.host() == requested_url.host()
                && registered_url.path() == requested_url.path()
                && registered_url.query() == requested_url.query()
        })
    })
}
