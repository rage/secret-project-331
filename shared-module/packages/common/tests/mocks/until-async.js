// Mock for until-async to avoid ES module issues with pnpm in Jest
// This package is a dependency of MSW and causes Jest to fail when pnpm's
// symlinked node_modules structure exposes ES modules that Jest can't handle
module.exports = {
  until: async (fn) => {
    try {
      const result = await fn()
      return [null, result]
    } catch (error) {
      return [error, null]
    }
  },
}
