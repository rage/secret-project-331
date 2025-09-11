use headless_lms_models::PKeyPolicy;
use uuid::Uuid;

/// Strategy for generating primary keys or deterministic UUIDs.
///
/// Use V5 with a stable namespace to keep seeds idempotent.
#[derive(Clone, Copy, Debug)]
pub enum IdStrategy<'a> {
    /// Let database generate random IDs (use sparingly in seeds)
    Generate,
    /// Use a specific UUID
    Fixed(Uuid),
    /// Generate deterministic UUIDv5 from namespace + name
    V5 { ns: &'a Uuid, name: &'a [u8] },
}

impl<'a> IdStrategy<'a> {
    /// Converts to a concrete UUID value.
    pub fn to_uuid(self) -> Uuid {
        match self {
            IdStrategy::Generate => Uuid::new_v4(),
            IdStrategy::Fixed(u) => u,
            IdStrategy::V5 { ns, name } => Uuid::new_v5(ns, name),
        }
    }

    /// Converts to a PKeyPolicy for database insert helpers.
    pub fn to_pkey(self) -> PKeyPolicy<Uuid> {
        match self {
            IdStrategy::Generate => PKeyPolicy::Generate,
            IdStrategy::Fixed(u) => PKeyPolicy::Fixed(u),
            IdStrategy::V5 { ns, name } => PKeyPolicy::Fixed(Uuid::new_v5(ns, name)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v5_is_deterministic() {
        let ns = Uuid::nil();
        let a1 = IdStrategy::V5 {
            ns: &ns,
            name: b"hello",
        }
        .to_uuid();
        let a2 = IdStrategy::V5 {
            ns: &ns,
            name: b"hello",
        }
        .to_uuid();
        assert_eq!(a1, a2);
    }

    #[test]
    fn fixed_roundtrips() {
        let u = Uuid::new_v4();
        if let PKeyPolicy::Fixed(got) = IdStrategy::Fixed(u).to_pkey() {
            assert_eq!(got, u);
        } else {
            panic!("expected fixed");
        }
    }

    #[test]
    fn v5_deterministic() {
        let ns = Uuid::new_v4();
        let a = IdStrategy::V5 {
            ns: &ns,
            name: b"page-1",
        }
        .to_uuid();
        let b = IdStrategy::V5 {
            ns: &ns,
            name: b"page-1",
        }
        .to_uuid();
        assert_eq!(a, b);
        assert_ne!(a, Uuid::new_v4());
    }
}
