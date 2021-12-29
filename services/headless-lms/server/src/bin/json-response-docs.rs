use headless_lms_actix::controllers::UploadResult;
use serde::Serialize;
use serde_json::{ser::PrettyFormatter, Serializer};
use uuid::Uuid;

macro_rules! write_docs {
    ($t: ident :: $($e: tt)*) => {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/json-docs/",
            stringify!($t),
            ".json"
        );
        write(path, $t::$($e)*);
    };
    ($t: ident  $($e: tt)*) => {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/json-docs/",
            stringify!($t),
            ".json"
        );
        write(path, $t $($e)*);
    };
}

fn main() {
    write_docs!(UploadResult {
        url: "http://project-331.local/api/v0/files/courses/1b89e57e-8b57-42f2-9fed-c7a6736e3eec/courses/d86cf910-4d26-40e9-8c9c-1cc35294fdbb/images/iHZMHdvsazy43ZtP0Ea01sy8AOpUiZ.png".to_string()
    });
    write_docs!(Uuid::parse_str("307fa56f-9853-4f5c-afb9-a6736c232f32").unwrap());
}

fn write<T: Serialize>(path: &str, value: T) {
    let mut file = std::fs::File::create(path).unwrap();
    let formatter = PrettyFormatter::with_indent(b"    ");
    let mut serializer = Serializer::with_formatter(&mut file, formatter);
    serde::Serialize::serialize(&value, &mut serializer).unwrap();
}
