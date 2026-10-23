//! Server-side id assignment for new blocks and entities.

use std::sync::atomic::{AtomicU64, Ordering};

use uuid::Uuid;

/// Mints ids for everything an edit creates; agents never choose ids.
pub trait IdGenerator: Send + Sync {
    fn new_id(&self) -> Uuid;
}

/// Random v4 ids, for production.
#[derive(Debug, Default, Clone, Copy)]
pub struct RandomIds;

impl IdGenerator for RandomIds {
    fn new_id(&self) -> Uuid {
        Uuid::new_v4()
    }
}

/// Predictable ids (`00000000-0000-4000-8000-00000000000n`), for tests.
#[derive(Debug, Default)]
pub struct SequentialIds {
    issued: AtomicU64,
}

impl SequentialIds {
    pub fn new() -> Self {
        Self::default()
    }

    /// The id the n:th call (1-based) to `new_id` returns.
    pub fn nth(n: u64) -> Uuid {
        Uuid::from_u64_pair(0x0000_0000_0000_4000, 0x8000_0000_0000_0000 | n)
    }
}

impl IdGenerator for SequentialIds {
    fn new_id(&self) -> Uuid {
        let n = self.issued.fetch_add(1, Ordering::Relaxed) + 1;
        Self::nth(n)
    }
}
