/*!
Error utilities and the error and result types for all the util functions.
*/

pub mod util_error;

#[macro_use]
pub mod macros;

/// True when anything in `error`'s cause chain is a `sqlx::Error::Io`: usually the database being
/// reset under a local development cluster, and the cue to reacquire a connection held across ticks.
pub fn is_db_disconnect(error: &(dyn std::error::Error + 'static)) -> bool {
    std::iter::successors(Some(error), |error| error.source()).any(|error| {
        matches!(
            error.downcast_ref::<sqlx::Error>(),
            Some(sqlx::Error::Io(..))
        )
    })
}
