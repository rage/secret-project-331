import { createServer, RequestListener } from "http"
import request from "supertest"

// Type for headers that can be passed to Request constructor
type HeadersInit = Headers | Record<string, string> | [string, string][]

type AppRouterHandler = (req: Request) => Promise<Response>

const appRouterTestClient = (handler: AppRouterHandler) => {
  const listener: RequestListener = async (req, res) => {
    try {
      // Convert Node.js IncomingMessage to Web API Request
      const url = `http://localhost${req.url}`
      const body = req.method !== "GET" && req.method !== "HEAD" ? await getBody(req) : undefined

      // Create a proper Request object using the Web API
      const requestObj = new Request(url, {
        method: req.method,
        headers: req.headers as HeadersInit,
        body,
      })

      const response = await handler(requestObj)

      // Set response status
      res.statusCode = response.status

      // Set response headers
      response.headers.forEach((value, key) => {
        res.setHeader(key, value)
      })

      // Ensure Content-Type is set for JSON responses
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json")
      }

      // Send response body
      const responseBody = await response.text()
      res.end(responseBody)
    } catch (error) {
      console.error("Test client error:", error)
      res.statusCode = 500
      res.end(JSON.stringify({ error: "Internal Server Error" }))
    }
  }

  return request(createServer(listener))
}

// Helper function to get request body
function getBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on("end", () => {
      resolve(body)
    })
    req.on("error", reject)
  })
}

export default appRouterTestClient
