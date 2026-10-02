use std::fmt::Debug;

use anyhow::Context;
use once_cell::sync::OnceCell;

static ICU4X_POSTCARD: OnceCell<Vec<u8>> = OnceCell::new();

#[derive(Clone, Copy)]
pub struct Icu4xBlob {
    postcard: &'static [u8],
}

impl Icu4xBlob {
    pub fn new(icu4x_postcard_path: &str) -> anyhow::Result<Self> {
        let data = ICU4X_POSTCARD.get_or_try_init(|| {
            let postcard = std::fs::read(icu4x_postcard_path).with_context(|| {
                format!("could not read icu4x postcard from {icu4x_postcard_path}")
            })?;
            anyhow::Ok(postcard)
        })?;

        Ok(Self {
            postcard: data.as_slice(),
        })
    }

    /// Tries to init from env
    pub fn try_from_env() -> anyhow::Result<Self> {
        let icu4x_postcard_path =
            std::env::var("ICU4X_POSTCARD_PATH").context("ICU4X_POSTCARD_PATH not defined")?;
        Self::new(&icu4x_postcard_path)
    }

    pub fn get(&self) -> &'static [u8] {
        self.postcard
    }
}

impl Debug for Icu4xBlob {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Icu4xBlob")
    }
}
