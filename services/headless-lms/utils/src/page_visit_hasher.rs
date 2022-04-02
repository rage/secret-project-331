use uuid::Uuid;

pub fn hash_anonymous_identifier(
    course_id: Uuid,
    hashing_key_for_the_day: Vec<u8>,
    user_agent: String,
    ip_address: String,
) -> anyhow::Result<String> {
    let mut hasher = blake3::Hasher::new();
    hasher.update(course_id.as_bytes());
    hasher.update(&hashing_key_for_the_day);
    hasher.update(ip_address.as_bytes());
    hasher.update(user_agent.as_bytes());
    let hash = hasher.finalize();
    let res = hash.to_hex().to_string();
    Ok(res)
}
