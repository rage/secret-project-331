import http from "http"

export const createHttpServer = (htmlContent: string) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end(htmlContent)
  })

  return server
}
