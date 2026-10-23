/** Starts the block validator with the server, so it's warm before the first agent write. */
export const register = async (): Promise<void> => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBlockValidator } = await import("./blockValidator/validatorWorker")
    startBlockValidator()
  }
}
