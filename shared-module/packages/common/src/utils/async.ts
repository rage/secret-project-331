export const waitForNextTick = async () => {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
