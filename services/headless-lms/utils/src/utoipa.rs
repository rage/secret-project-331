use utoipa::{Modify, openapi::OpenApi};

use crate::prelude::*;

pub struct DiscriminatorAddon;

impl Modify for DiscriminatorAddon {
    fn modify(&self, openapi: &mut OpenApi) {
        let lol = openapi.to_pretty_json().unwrap();
        panic!("ABCABCABC {}", &lol);
    }
}
