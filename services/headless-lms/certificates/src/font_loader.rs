//! Provides a font database singleton and functions for loading fonts to the font database.

use headless_lms_utils::{
    file_store::file_utils::FileContentFetcherWithFilesystemCache, prelude::UtilResult,
};
use usvg::fontdb;

pub async fn get_font_database_with_fonts(
    url_loader: &FileContentFetcherWithFilesystemCache,
    font_urls: &[String],
) -> UtilResult<fontdb::Database> {
    let mut db = fontdb::Database::new();
    for url_string in font_urls {
        match get_font_data(url_loader, url_string).await {
            Ok(font_data) => {
                db.load_font_data(font_data);
            }
            Err(e) => {
                warn!("Could not load font: {}", e);
            }
        }
    }
    Ok(db)
}

async fn get_font_data(
    url_loader: &FileContentFetcherWithFilesystemCache,
    font_url: &str,
) -> UtilResult<Vec<u8>> {
    let parsed = url::Url::parse(font_url)?;
    let font_data = url_loader
        .fetch_file_content_or_use_filesystem_cache(&parsed)
        .await?;
    Ok(font_data)
}
