import { fetchDerivedSpec } from "../playgroundSpecRequests"

const SPEC = { prompt: "Pick one" }

const respondWith = (body: unknown, ok = true) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as unknown as typeof fetch
}

const derive = (declaresSpecFiles: boolean) =>
  fetchDerivedSpec({
    endpointUrl: "http://plugin.test/api/public-spec",
    privateSpec: { items: [] },
    uploadUrl: "http://host.test/api/v0/files/playground",
    declaresSpecFiles,
    specDescription: "public spec",
  })

describe("fetchDerivedSpec", () => {
  afterEach(() => jest.restoreAllMocks())

  it("returns the body a service that declares nothing answers with", async () => {
    respondWith(SPEC)

    await expect(derive(false)).resolves.toEqual(SPEC)
  })

  // Previewing the envelope instead of the spec would show a shape no student is ever sent.
  it("unwraps the envelope a declaring service answers with", async () => {
    respondWith({ spec: SPEC, files: ["7ab0a4f2-0000-4000-8000-000000000000"] })

    await expect(derive(true)).resolves.toEqual(SPEC)
  })

  it("keeps a null spec null rather than reporting a missing envelope", async () => {
    respondWith({ spec: null, files: [] })

    await expect(derive(true)).resolves.toBeNull()
  })

  it("reports a declaring service that answers with the bare spec", async () => {
    respondWith(SPEC)

    await expect(derive(true)).rejects.toThrow("declares spec files")
  })

  it("reports an envelope whose files are not a list of ids", async () => {
    respondWith({ spec: SPEC, files: null })

    await expect(derive(true)).rejects.toThrow("declares spec files")
  })

  it("reports a failed request by the spec it was deriving", async () => {
    respondWith(SPEC, false)

    await expect(derive(true)).rejects.toThrow("Failed to load public spec (500)")
  })
})
