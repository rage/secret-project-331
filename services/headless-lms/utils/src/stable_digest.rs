/// A hex BLAKE3 digest of `parts` that is the same in every process and every release.
///
/// Each part is length-prefixed, so no two different lists of parts can ever hash to the same
/// value: pass the parts as they are and do not add separators of your own. Returns all 64 hex
/// characters; truncate at the call site if a shorter identifier is wanted.
///
/// Unkeyed, so the digest of a guessable input is guessable. Anything that has to resist that must
/// include a secret part of its own, the way [`crate::page_visit_hasher`] mixes in the day's key.
///
/// New callers use this; [`crate::error_identifier`]'s own scheme stays only because its stored
/// identifiers may not change.
pub fn stable_digest(parts: &[&[u8]]) -> String {
    let mut hasher = blake3::Hasher::new();
    for part in parts {
        hasher.update(&(part.len() as u64).to_le_bytes());
        hasher.update(part);
    }
    hasher.finalize().to_hex().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The digest identifies whatever the caller split into parts, so two different splits sharing
    /// their concatenation have to disagree. Without the length prefix they would not, and callers
    /// would silently share cache entries or error groups.
    #[test]
    fn parts_that_only_differ_in_where_they_are_split_digest_differently() {
        assert_ne!(stable_digest(&[b"ab", b"c"]), stable_digest(&[b"a", b"bc"]));
        assert_ne!(stable_digest(&[b"a", b""]), stable_digest(&[b"a"]));
    }

    /// Callers store digests and compare them across releases and across replicas, so the value
    /// has to be pinned rather than merely deterministic within one run.
    #[test]
    fn a_given_input_digests_to_the_same_value_on_every_host_and_release() {
        assert_eq!(
            stable_digest(&[b"one", b"two"]),
            "895cdc7d0d102a0763bd1cf348febb7c06c5e74b1b3889773f138c723acb7b5c"
        );
    }
}
