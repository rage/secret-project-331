//! Per-inbox daily counts of budgeted mails, keyed by [`inbox_key`].

use chrono::NaiveDate;
use headless_lms_base::hmac_sha256::hmac_sha256;
use unicode_normalization::UnicodeNormalization;

use crate::prelude::*;

/// Keys an address by the inbox it reaches, so address variants delivered to one inbox share a
/// mail budget.
///
/// A budget key only: lossy by design, so never use it to identify, look up or show an account.
/// `secret` is the server's `FORM_CONTEXT_SECRET`; without it the 32-byte key cannot be computed
/// from a guessed address.
pub fn inbox_key(email: &str, secret: &[u8]) -> Vec<u8> {
    hmac_sha256(secret, canonical_inbox(email).as_bytes())
}

fn canonical_inbox(email: &str) -> String {
    let email = email.trim().nfkc().collect::<String>().to_lowercase();
    let Some((local, domain)) = email.rsplit_once('@') else {
        return email;
    };
    let domain = idna::domain_to_ascii(domain).unwrap_or_else(|_| domain.to_string());
    let domain = domain.trim_end_matches('.');
    let domain = fold_provider_alias(psl::domain_str(domain).unwrap_or(domain));

    // Gmail ignores dots and most providers deliver +tags to the base inbox; elsewhere this may
    // merge distinct inboxes, which only makes them share a budget.
    let mut local: String = local.split('+').next().unwrap_or_default().replace('.', "");
    match domain {
        "proton.me" => local.retain(|c| c != '-' && c != '_'),
        // Yahoo's disposable addresses are base-keyword@.
        "yahoo.com" => local.truncate(local.find('-').unwrap_or(local.len())),
        _ => {}
    }
    format!("{local}@{domain}")
}

fn fold_provider_alias(domain: &str) -> &str {
    match domain {
        "googlemail.com" => "gmail.com",
        "protonmail.com" | "protonmail.ch" | "pm.me" => "proton.me",
        "me.com" | "mac.com" => "icloud.com",
        "ymail.com" => "yahoo.com",
        // Outlook, Hotmail and Live addresses on different domains are separate inboxes.
        other => other,
    }
}

/// Counts one more mail to the inbox `inbox_key` names for the current UTC day, unless
/// `daily_allowance` mails have been counted already. Returns whether the mail may be queued.
///
/// Run it in the transaction that queues the mail, so a rolled-back mail gives its slot back.
pub async fn try_consume(
    conn: &mut PgConnection,
    inbox_key: &[u8],
    daily_allowance: i32,
) -> ModelResult<bool> {
    if daily_allowance < 1 {
        return Ok(false);
    }
    let row = sqlx::query!(
        r#"
INSERT INTO email_address_mail_budgets AS t (inbox_key, day, mails_queued)
VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 1)
ON CONFLICT (inbox_key, day) DO UPDATE
SET mails_queued = t.mails_queued + 1
WHERE t.mails_queued < $2
RETURNING mails_queued
"#,
        inbox_key,
        daily_allowance,
    )
    .fetch_optional(conn)
    .await?;
    Ok(row.is_some())
}

/// Hard-deletes the counts of days before `day`. Returns how many rows went.
pub async fn delete_older_than(conn: &mut PgConnection, day: NaiveDate) -> ModelResult<u64> {
    let result = sqlx::query!(
        r#"
DELETE FROM email_address_mail_budgets
WHERE day < $1
"#,
        day,
    )
    .execute(conn)
    .await?;
    Ok(result.rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_same_inbox(expected: &str, variants: &[&str]) {
        for variant in variants {
            assert_eq!(canonical_inbox(variant), expected, "{variant}");
        }
    }

    #[test]
    fn gmail_and_googlemail_ignore_dots_and_tags() {
        assert_same_inbox(
            "john@gmail.com",
            &[
                "john@gmail.com",
                "j.o.h.n@gmail.com",
                "john+1@gmail.com",
                "j.ohn+news.letter@googlemail.com",
            ],
        );
    }

    #[test]
    fn custom_domain_ignores_dots_and_tags() {
        assert_same_inbox(
            "johnsmith@example.org",
            &["john.smith@example.org", "john.smith+x@example.org"],
        );
    }

    #[test]
    fn proton_folds_aliases_dashes_and_underscores() {
        assert_same_inbox(
            "johnsmith@proton.me",
            &[
                "john.smith@proton.me",
                "john-smith+a@protonmail.com",
                "john_smith@protonmail.ch",
                "johnsmith@pm.me",
            ],
        );
    }

    #[test]
    fn yahoo_cuts_disposable_suffix() {
        assert_same_inbox(
            "john@yahoo.com",
            &["john@yahoo.com", "jo.hn-shop@ymail.com", "john+x@yahoo.com"],
        );
    }

    #[test]
    fn icloud_folds_aliases() {
        assert_same_inbox(
            "john@icloud.com",
            &["john@me.com", "j.ohn+x@mac.com", "john@icloud.com"],
        );
    }

    #[test]
    fn outlook_family_stays_per_domain() {
        assert_same_inbox("john@outlook.com", &["j.ohn+x@outlook.com"]);
        assert_same_inbox("john@hotmail.com", &["john@hotmail.com"]);
        assert_same_inbox("john@live.com", &["john@live.com"]);
        assert_same_inbox("john@outlook.fi", &["john@outlook.fi"]);
        assert_same_inbox("john@msn.com", &["john@msn.com"]);
    }

    #[test]
    fn idn_domain_becomes_punycode() {
        assert_same_inbox(
            "john@xn--bcher-kva.example",
            &["john@bücher.example", "John@BÜCHER.example."],
        );
    }

    #[test]
    fn case_and_compatibility_forms_fold() {
        assert_same_inbox(
            "john@gmail.com",
            &["  JOHN@GMAIL.COM ", "Ｊｏｈｎ@ｇｍａｉｌ.ｃｏｍ"],
        );
    }

    #[test]
    fn subdomain_reduces_to_registrable_domain() {
        assert_same_inbox(
            "john@example.com",
            &["john@cs.example.com", "john@example.com"],
        );
    }

    #[test]
    fn multi_label_suffixes_keep_the_registrable_label() {
        assert_same_inbox(
            "john@example.co.uk",
            &["john@example.co.uk", "john@mail.example.co.uk"],
        );
        assert_same_inbox("john@ox.ac.uk", &["john@cs.ox.ac.uk"]);
        assert_same_inbox("john@example.fi", &["john@example.fi"]);
        assert_ne!(
            canonical_inbox("john@a.co.uk"),
            canonical_inbox("john@b.co.uk")
        );
    }

    #[test]
    fn plain_address_is_unchanged_apart_from_case() {
        assert_eq!(canonical_inbox("Mary@Example.com"), "mary@example.com");
    }

    #[test]
    fn key_depends_on_secret_and_inbox() {
        let key = inbox_key("j.ohn+1@gmail.com", b"secret");
        assert_eq!(key.len(), 32);
        assert_eq!(key, inbox_key("john@googlemail.com", b"secret"));
        assert_ne!(key, inbox_key("john@gmail.com", b"other secret"));
        assert_ne!(key, inbox_key("jane@gmail.com", b"secret"));
    }
}
