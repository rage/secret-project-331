export const waitForNextTick = async () => {
  new Promise((resolve) => setTimeout(resolve, 0))
}
