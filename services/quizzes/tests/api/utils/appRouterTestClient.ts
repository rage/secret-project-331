// Request-based test client for the API handlers: each call builds a real Web `Request` (matching
// what headless-lms sends), invokes the handler, and exposes the `Response` as
// `{ status, text, body, headers }` behind a `.get()/.post().send()/.expect()` surface.
type Handler = (req: Request) => Promise<Response> | Response

interface TestResponse {
  status: number
  text: string
  // Parsed JSON response body. Typed loosely so tests can read response shapes without casts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
  headers: Headers
}

type Expectation = (res: TestResponse) => void

class RequestBuilder implements PromiseLike<TestResponse> {
  private payload: unknown
  private hasPayload = false
  private readonly expectations: Expectation[] = []

  constructor(
    private readonly handler: Handler,
    private readonly method: string,
    private readonly path: string,
  ) {}

  send(body: unknown): this {
    this.payload = body
    this.hasPayload = true
    return this
  }

  expect(statusOrHeader: number | string, matcher?: RegExp | string): this {
    if (typeof statusOrHeader === "number") {
      const expectedStatus = statusOrHeader
      this.expectations.push((res) => {
        if (res.status !== expectedStatus) {
          throw new Error(`expected status ${expectedStatus} but got ${res.status}`)
        }
      })
    } else {
      const headerName = statusOrHeader
      this.expectations.push((res) => {
        const value = res.headers.get(headerName) ?? ""
        const matches = matcher instanceof RegExp ? matcher.test(value) : value === matcher
        if (!matches) {
          throw new Error(
            `expected header ${headerName} to match ${String(matcher)} but got "${value}"`,
          )
        }
      })
    }
    return this
  }

  private async run(): Promise<TestResponse> {
    const init: RequestInit = { method: this.method }
    if (this.hasPayload) {
      init.body = JSON.stringify(this.payload)
      init.headers = { "content-type": "application/json" }
    }
    const response = await this.handler(new Request(`http://localhost${this.path}`, init))
    const text = await response.text()
    let body: unknown
    try {
      body = text ? JSON.parse(text) : undefined
    } catch {
      body = undefined
    }
    const result: TestResponse = { status: response.status, text, body, headers: response.headers }
    for (const expectation of this.expectations) {
      expectation(result)
    }
    return result
  }

  then<TResult1 = TestResponse, TResult2 = never>(
    onfulfilled?: ((value: TestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected)
  }
}

const appRouterTestClient = (handler: Handler) => ({
  get: (path: string) => new RequestBuilder(handler, "GET", path),
  post: (path: string) => new RequestBuilder(handler, "POST", path),
})

export default appRouterTestClient
