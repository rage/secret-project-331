//! Networks from which users with roles have confirmed with an emailed code. Pairs with
//! [`crate::staff_security_verified_browsers`].

use std::net::IpAddr;

use crate::prelude::*;

/// A prefix length for each address family.
struct PrefixLen {
    v4: i32,
    v6: i32,
}

impl PrefixLen {
    fn for_ip(&self, ip: IpAddr) -> i32 {
        match ip {
            IpAddr::V4(_) => self.v4,
            IpAddr::V6(_) => self.v6,
        }
    }
}

/// The block a code verifies when the address has a country.
const VERIFIED: PrefixLen = PrefixLen { v4: 16, v6: 32 };
/// The block a code verifies when the address has no country: the address alone.
const COUNTRYLESS: PrefixLen = PrefixLen { v4: 32, v6: 64 };
/// Widest a network may grow by widening.
const WIDENING_LIMIT: PrefixLen = PrefixLen { v4: 12, v6: 29 };

/// An unexpired network that either contains an address or could widen to cover it.
#[derive(Debug, Clone)]
pub struct NetworkCandidate {
    pub id: Uuid,
    pub country: Option<String>,
    pub contains_ip: bool,
    /// Whether [`renew_if_expiring`] would push the expiry back.
    pub renewal_due: bool,
}

/// The user's unexpired networks of `ip`'s family that contain `ip`, plus those `browser_id` could
/// widen to cover it (see [`widen_to_cover`]). Leaves the country check to the caller, so the
/// country lookup can be skipped when this comes back empty.
pub async fn get_candidates(
    conn: &mut PgConnection,
    user_id: Uuid,
    ip: IpAddr,
    browser_id: Uuid,
) -> ModelResult<Vec<NetworkCandidate>> {
    let candidates = sqlx::query_as!(
        NetworkCandidate,
        r#"
SELECT id,
  country,
  network >>= $2::text::inet AS "contains_ip!",
  expires_at < now() + interval '3 months' AS "renewal_due!"
FROM staff_security_verified_networks
WHERE user_id = $1
  AND expires_at > now()
  AND family(network) = family($2::text::inet)
  AND (
    network >>= $2::text::inet
    OR (
      verified_by_browser_id = $3
      AND verified_at > now() - interval '24 hours'
      AND country IS NOT NULL
      AND network <<= network(set_masklen($2::text::inet, $4))
    )
  )
        "#,
        user_id,
        ip.to_string(),
        browser_id,
        WIDENING_LIMIT.for_ip(ip),
    )
    .fetch_all(conn)
    .await?;
    Ok(candidates)
}

/// Grows the networks `browser_id` verified in the last 24 hours in `country`, and that lie within
/// the widening limit around `ip`, to the smallest block that also covers `ip`.
///
/// Returns the ids of the widened networks.
pub async fn widen_to_cover(
    conn: &mut PgConnection,
    user_id: Uuid,
    browser_id: Uuid,
    ip: IpAddr,
    country: &str,
) -> ModelResult<Vec<Uuid>> {
    // A single statement so that concurrent widenings of one row cannot overwrite each other, and
    // the family filter keeps inet_merge from seeing mixed families.
    let ids = sqlx::query_scalar!(
        r#"
UPDATE staff_security_verified_networks
SET network = inet_merge(network, $3::text::inet)
WHERE user_id = $1
  AND verified_by_browser_id = $2
  AND verified_at > now() - interval '24 hours'
  AND expires_at > now()
  AND country = $4
  AND family(network) = family($3::text::inet)
  AND network <<= network(set_masklen($3::text::inet, $5))
RETURNING id
        "#,
        user_id,
        browser_id,
        ip.to_string(),
        country,
        WIDENING_LIMIT.for_ip(ip),
    )
    .fetch_all(conn)
    .await?;
    Ok(ids)
}

/// Pushes the expiry of those of `ids` that expire within three months back to six months from now.
pub async fn renew_if_expiring(conn: &mut PgConnection, ids: &[Uuid]) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE staff_security_verified_networks
SET expires_at = now() + interval '6 months'
WHERE id = ANY($1)
  AND expires_at < now() + interval '3 months'
        "#,
        ids,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Records that `browser_id` entered a code from `ip`, whose country is `country`.
///
/// Renews the user's network of that country containing `ip`, and makes `browser_id` its verifier
/// as of now; otherwise inserts the block around `ip`. Networks of other countries are untouched.
pub async fn record_verification(
    conn: &mut PgConnection,
    user_id: Uuid,
    browser_id: Uuid,
    ip: IpAddr,
    country: Option<&str>,
) -> ModelResult<()> {
    let mut tx = conn.begin().await?;
    let prefix = match country {
        Some(_) => VERIFIED.for_ip(ip),
        None => COUNTRYLESS.for_ip(ip),
    };
    let renewed = sqlx::query!(
        r#"
UPDATE staff_security_verified_networks
SET expires_at = now() + interval '6 months',
  verified_by_browser_id = $3,
  verified_at = now()
WHERE user_id = $1
  AND expires_at > now()
  AND country IS NOT DISTINCT FROM $4
  AND (
    ($4::text IS NOT NULL AND network >>= $2::text::inet)
    OR network = network(set_masklen($2::text::inet, $5))
  )
        "#,
        user_id,
        ip.to_string(),
        browser_id,
        country,
        prefix,
    )
    .execute(&mut *tx)
    .await?;
    if renewed.rows_affected() == 0 {
        sqlx::query!(
            r#"
INSERT INTO staff_security_verified_networks (
    user_id,
    network,
    country,
    verified_by_browser_id,
    expires_at
  )
VALUES (
    $1,
    network(set_masklen($2::text::inet, $5)),
    $4,
    $3,
    now() + interval '6 months'
  )
            "#,
            user_id,
            ip.to_string(),
            browser_id,
            country,
            prefix,
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Forgets every network of the user except `keep`.
pub async fn delete_all_for_user_except(
    conn: &mut PgConnection,
    user_id: Uuid,
    keep: &[Uuid],
) -> ModelResult<()> {
    sqlx::query!(
        r#"
DELETE FROM staff_security_verified_networks
WHERE user_id = $1
  AND NOT (id = ANY($2))
        "#,
        user_id,
        keep,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Hard-deletes every expired network. Returns how many.
pub async fn delete_expired(conn: &mut PgConnection) -> ModelResult<u64> {
    let result = sqlx::query!(
        r#"
DELETE FROM staff_security_verified_networks
WHERE expires_at <= now()
        "#,
    )
    .execute(conn)
    .await?;
    Ok(result.rows_affected())
}
