use uuid::Uuid;

use crate::stable_digest::stable_digest;

/// A visitor identifier that cannot be traced back to the visitor once the day's key is rotated
/// away.
///
/// `hashing_key_for_the_day` is what keeps the identifier from being reproducible from an IP
/// address alone, so it must be the current day's secret and never a constant. The same visitor
/// gets a different identifier on the next day and on another course.
///
/// Touching how the parts are combined re-keys every identifier the moment it deploys, so
/// `COUNT(DISTINCT anonymous_identifier)` counts every visitor already seen that day a second time.
/// The key rotation caps that to the day of the deploy; nothing else does.
pub fn hash_anonymous_identifier(
    course_id: Uuid,
    hashing_key_for_the_day: Vec<u8>,
    user_agent: String,
    ip_address: String,
) -> anyhow::Result<String> {
    Ok(stable_digest(&[
        course_id.as_bytes(),
        &hashing_key_for_the_day,
        ip_address.as_bytes(),
        user_agent.as_bytes(),
    ]))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The identifier is the join key for a course's visit counts, so two visitors that differ only
    /// in where one field ends and the next begins have to be told apart. Unframed fields run
    /// together and count that pair as one visitor.
    #[test]
    fn visitors_whose_fields_run_together_get_different_identifiers() {
        let course_id = Uuid::new_v4();
        let key = vec![1, 2, 3];

        assert_ne!(
            hash_anonymous_identifier(
                course_id,
                key.clone(),
                "Firefox".to_string(),
                "10.0.0.1".to_string()
            )
            .expect("the identifier is computed"),
            hash_anonymous_identifier(
                course_id,
                key,
                "efox".to_string(),
                "10.0.0.1Fir".to_string()
            )
            .expect("the identifier is computed"),
        );
    }
}
