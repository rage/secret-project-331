//! A proof-of-work floor that rises for everybody while the signup or password reset form gets far
//! more requests than usual. Thresholds come from deployment configuration; without it the floor
//! stays at 1.

use std::sync::LazyLock;
use std::sync::atomic::{AtomicU32, Ordering};

use headless_lms_models::shared_rate_counts;
use sqlx::PgPool;

use crate::config::form_safety_config::form_safety_env;
use crate::domain::proof_of_work::ChallengePurpose;
use crate::domain::request_network::keyed_digest;
use crate::domain::shared_limits;
use crate::prelude::*;

const VOLUME_WINDOW_SECONDS: i64 = 900;

/// Levels by score, parsed from `"3:2,6:4"`: from a score of 3 level 2, from 6 level 4.
pub struct LevelSteps(Vec<(f64, u32)>);

impl LevelSteps {
    /// Parses steps in the format above, skipping malformed entries.
    pub fn parse(value: &str) -> Self {
        let mut steps: Vec<(f64, u32)> = value
            .split(',')
            .filter_map(|step| {
                let (threshold, level) = step.trim().split_once(':')?;
                Some((threshold.trim().parse().ok()?, level.trim().parse().ok()?))
            })
            .collect();
        steps.sort_by(|a, b| a.0.total_cmp(&b.0));
        Self(steps)
    }

    /// The level of the highest threshold `score` reaches, or 1.
    pub fn level(&self, score: f64) -> u32 {
        self.0
            .iter()
            .filter(|(threshold, _)| score >= *threshold)
            .map(|(_, level)| *level)
            .max()
            .unwrap_or(1)
            .max(1)
    }
}

struct VolumeConfig {
    /// Usual requests per window.
    baseline: f64,
    /// Levels by the ratio of the last window's requests to the baseline.
    steps: LevelSteps,
    /// The level last computed on this instance, so a change is logged once.
    last_level: AtomicU32,
}

fn volume_config(prefix: &str) -> VolumeConfig {
    VolumeConfig {
        baseline: form_safety_env(&format!("{prefix}_VOLUME_BASELINE"))
            .trim()
            .parse()
            .ok()
            .filter(|baseline: &f64| *baseline > 0.0)
            .unwrap_or(f64::INFINITY),
        steps: LevelSteps::parse(&form_safety_env(&format!("{prefix}_VOLUME_LEVELS"))),
        last_level: AtomicU32::new(1),
    }
}

static SIGNUP_VOLUME: LazyLock<VolumeConfig> = LazyLock::new(|| volume_config("SIGNUP"));
static RESET_VOLUME: LazyLock<VolumeConfig> = LazyLock::new(|| volume_config("PASSWORD_RESET"));

fn volume_key(purpose: ChallengePurpose) -> Vec<u8> {
    keyed_digest("volume", &format!("{purpose:?}"))
}

fn config_for(purpose: ChallengePurpose) -> &'static VolumeConfig {
    match purpose {
        ChallengePurpose::Signup => &SIGNUP_VOLUME,
        ChallengePurpose::PasswordReset => &RESET_VOLUME,
    }
}

/// Counts a submission of the form for `purpose`. See [`shared_limits::increment`] for `pool`.
pub async fn count(
    conn: &mut PgConnection,
    pool: &PgPool,
    purpose: ChallengePurpose,
) -> ModelResult<()> {
    shared_limits::increment(conn, pool, &volume_key(purpose), &[VOLUME_WINDOW_SECONDS]).await?;
    Ok(())
}

/// The level everybody's challenges for `purpose` get from the form's current volume.
pub async fn level(conn: &mut PgConnection, purpose: ChallengePurpose) -> ModelResult<u32> {
    let config = config_for(purpose);
    let recent =
        shared_rate_counts::sliding_count(conn, &volume_key(purpose), VOLUME_WINDOW_SECONDS)
            .await?;
    let level = config.steps.level(recent / config.baseline);
    if config.last_level.swap(level, Ordering::Relaxed) != level {
        if level > 1 {
            warn!(
                "The {purpose:?} form gets unusually many requests; its level is raised to {level}"
            );
        } else {
            info!("The {purpose:?} form's level is back to 1");
        }
    }
    Ok(level)
}
