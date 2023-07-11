use futures::Future;

/// For use with join! or try_join! Makes the future to run parallelly with other tasks instead of concurrently. See: <https://docs.rs/tokio/latest/tokio/macro.try_join.html#runtime-characteristics>.
pub async fn run_parallelly<T>(
    future: impl Future<Output = anyhow::Result<T>> + std::marker::Send + 'static,
) -> anyhow::Result<T>
where
    T: std::marker::Send + 'static,
{
    // boxing our futures helps avoid stack overflow
    let handle = tokio::spawn(Box::pin(future));
    match handle.await {
        Ok(Ok(result)) => Ok(result),
        Ok(Err(err)) => Err(err),
        Err(err) => anyhow::bail!("{}", err),
    }
}
