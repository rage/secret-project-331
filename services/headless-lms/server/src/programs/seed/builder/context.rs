use uuid::Uuid;

/// Shared context for seed operations with database connection and deterministic ID generation.
pub struct SeedContext {
    pub teacher: Uuid,
    pub org: Uuid,
    /// Namespace for generating deterministic UUIDv5 IDs
    pub base_course_ns: Uuid,
}

impl SeedContext {
    /// Generates a deterministic UUIDv5 using the course namespace.
    pub fn v5(&self, name: &[u8]) -> Uuid {
        Uuid::new_v5(&self.base_course_ns, name)
    }
}
