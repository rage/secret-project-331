use serde::Serialize;

#[derive(Serialize)]
pub struct Jwk {
    pub kty: String,
    #[serde(rename = "use")]
    pub use_: String,
    pub alg: String,
    pub kid: String,
    pub n: String,
    pub e: String,
}

#[derive(Serialize)]
pub struct Jwks {
    pub keys: Vec<Jwk>,
}
