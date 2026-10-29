//! Preview links that show a page as staged without logging in.

mod page;
mod token;

pub use page::{PagePreview, PreviewExercise, PreviewPage, resolve_preview};
pub use token::{
    PreviewClaim, PreviewToken, mint_preview_token, preview_path, validate_preview_token,
};
