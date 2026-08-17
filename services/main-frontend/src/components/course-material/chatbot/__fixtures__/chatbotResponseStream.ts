/**
 * Feeds the reader exactly the given chunks, one per `read()`, so a test controls where the chunk
 * boundaries fall. Also records whether the stream was cancelled.
 */
export const streamOf = (chunks: Uint8Array[]) => {
  let index = 0
  let cancelled = false
  const stream = {
    getReader: () => ({
      read: () =>
        Promise.resolve(
          index < chunks.length
            ? { done: false, value: chunks[index++] }
            : { done: true, value: undefined },
        ),
      cancel: () => {
        cancelled = true
        return Promise.resolve()
      },
    }),
  } as unknown as ReadableStream<Uint8Array>
  return { stream, wasCancelled: () => cancelled }
}
