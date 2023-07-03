//! Provides a font database singleton and functions for loading fonts to the font database.

use std::path::Path;

use headless_lms_models::prelude::PgConnection;
use headless_lms_utils::file_store::FileStore;
use headless_lms_utils::prelude::*;
use headless_lms_utils::prelude::{UtilError, UtilErrorType, UtilResult};
use tracing::info;
use tracing::log::warn;
use usvg::fontdb;

/// Creates an empty [fontdb::Database] and loads all the fonts specified in the database table `certificate_fonts` into it. Note that the font database will not contain any system fonts to prevent us from creating any accidential hidden dependencies on the system fonts.
pub async fn get_font_database_with_fonts(
    conn: &mut PgConnection,
    file_store: &dyn FileStore,
) -> UtilResult<fontdb::Database> {
    let mut fontdb = fontdb::Database::new();
    let certificate_fonts = headless_lms_models::certificate_fonts::get_all(&mut *conn)
        .await
        .map_err(|original_error| {
            UtilError::new(
                UtilErrorType::Other,
                "Could not get a list of fonts".into(),
                Some(original_error.into()),
            )
        })?;
    for certificate_font in certificate_fonts {
        match file_store
            .fetch_file_content_or_use_filesystem_cache(Path::new(&certificate_font.file_path))
            .await
        {
            Ok(font_data) => {
                fontdb.load_font_data(font_data);
            }
            Err(e) => {
                warn!("Could not load font: {}", e);
            }
        };
    }

    info!("Loaded {} fonts", fontdb.faces().count());
    fontdb.faces().for_each(|f| {
        info!("Font: {:?}, weight: {:?}", f.families, f.weight);
    });

    Ok(fontdb)
}
