export const waitForNextTick = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}
