// Ran after all test suites
async function globalTeardown(): Promise<void> {
  console.log("Executed globalTeardown")
}

export default globalTeardown
