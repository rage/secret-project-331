import { ParsedError, parseError } from "../parseError"

function makeFakeBlob(text: string): { text: () => Promise<string> } {
  return { text: async () => text }
}

describe("parseError", () => {
  const defaultTitle = "Translated Error"

  test("parses string error", async () => {
    const result = await parseError("something went wrong", defaultTitle)
    expect(result).toEqual<ParsedError>({
      title: defaultTitle,
      message: "something went wrong",
    })
  })

  test("parses ErrorResponse in .data", async () => {
    const errorResponse = {
      title: "Backend Error",
      message: "Detailed message",
      data: { block_id: "abc" },
      source: "stacktrace or source",
    }
    const input = { status: 500, data: errorResponse }
    const result = await parseError(input, defaultTitle)
    expect(result).toEqual({
      title: "Backend Error",
      message: "Detailed message",
      sourceData: "stacktrace or source",
      linkBlockId: "abc",
      status: 500,
    })
  })

  test("parses Axios-like error with backend ErrorResponse payload", async () => {
    const backend = {
      title: "Internal Server Error",
      message: "Something broke",
      data: { block_id: "block-123" },
      source: "trace...",
    }
    const input = {
      isAxiosError: true,
      message: "Request failed with status code 500",
      response: { status: 500, data: backend },
    }
    const result = await parseError(input, defaultTitle)
    expect(result).toEqual({
      title: "Internal Server Error",
      message: "Something broke",
      sourceData: "trace...",
      linkBlockId: "block-123",
      status: 500,
    })
  })

  test("parses HTTP-like response with backend ErrorResponse payload", async () => {
    const backend = {
      title: "Bad Request",
      message: "Invalid input",
      data: { block_id: "block-xyz" },
      source: "validation trace",
    }
    const input = {
      status: 400,
      statusText: "Bad Request",
      request: { responseURL: "https://api.example.com/endpoint" },
      data: backend,
    }
    const result = await parseError(input, defaultTitle)
    expect(result).toEqual({
      title: "Bad Request",
      message: "Invalid input",
      sourceData: "validation trace",
      linkBlockId: "block-xyz",
      status: 400,
    })
  })

  test("parses blob backend ErrorResponse payload (non-axios)", async () => {
    const backend = {
      title: "Unauthorized",
      message: "Missing token",
      data: { block_id: "auth-block" },
      source: "auth trace",
    }
    const blob = makeFakeBlob(JSON.stringify(backend))
    const input = { status: 401, data: blob }
    const result = await parseError(input, defaultTitle)
    expect(result).toEqual({
      title: "Unauthorized",
      message: "Missing token",
      sourceData: "auth trace",
      linkBlockId: "auth-block",
      status: 401,
    })
  })

  test("parses Axios-like error", async () => {
    const input = {
      isAxiosError: true,
      message: "Request failed",
      response: { data: { message: "Bad request" } },
    }
    const result = await parseError(input, defaultTitle)
    expect(result).toEqual({
      title: "Request failed",
      message: "Bad request",
      sourceData: { message: "Bad request" },
    })
  })

  test("parses HTTP-like response without ErrorResponse", async () => {
    const input = {
      status: 404,
      statusText: "Not Found",
      request: { responseURL: "https://example.com/foo" },
      data: { cause: "missing" },
    }
    const result = await parseError(input, defaultTitle)
    expect(result).toEqual({
      title: "Not Found",
      message: "https://example.com/foo",
      sourceData: { cause: "missing" },
      status: 404,
    })
  })

  test("parses plain Error", async () => {
    const err = new Error("Boom")
    const result = await parseError(err, defaultTitle)
    expect(result.title).toBe("Boom")
    expect(typeof result.sourceData).toBe("string")
    expect(result.sourceData).toContain("Boom")
  })

  test("parses unknown object", async () => {
    const input = { foo: "bar" }
    const result = await parseError(input, defaultTitle)
    expect(result).toEqual({
      title: defaultTitle,
      sourceData: input,
    })
  })

  test("parses Blob in data and JSON content", async () => {
    const blob = makeFakeBlob(JSON.stringify({ message: "from blob" }))
    const input = { data: blob, isAxiosError: true, message: "Blob axios" }
    const result = await parseError(input, defaultTitle)
    expect(result).toEqual({
      title: "Blob axios",
      message: "from blob",
      sourceData: { message: "from blob" },
    })
  })

  test("parses Blob in data and non-JSON content", async () => {
    const blob = makeFakeBlob("not json")
    const input = { data: blob, isAxiosError: true, message: "Blob axios" }
    const result = await parseError(input, defaultTitle)
    expect(result).toEqual({
      title: "Blob axios",
      message: undefined,
      sourceData: "not json",
    })
  })
})
