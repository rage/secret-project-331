use std::{ffi::OsStr, path::Path};

use rand::distributions::{Alphanumeric, DistString};

pub fn get_extension_from_filename(filename: &str) -> Option<&str> {
    Path::new(filename).extension().and_then(OsStr::to_str)
}

pub fn random_filename() -> String {
    Alphanumeric.sample_string(&mut rand::thread_rng(), 32)
}
