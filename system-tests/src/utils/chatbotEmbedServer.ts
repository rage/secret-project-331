import http from "http"

const REDIRECT_BASE_PORT = 8765
const REDIRECT_PORT_COUNT = 20
const GLOBAL_CHATBOT_CONFIGURATION_ID_TEST = "16feef52-67ba-405a-97f8-effd0653df00"

let _chatbotEmbedServer: http.Server | null = null
let _setupCount = 0
let _setupPromise: Promise<void> | null = null

export function getChatbotEmbedPort(): number {
  if (!_chatbotEmbedServer) {
    throw new Error("ChatbotEmbedServer is undefined")
  }

  const address = _chatbotEmbedServer.address()

  if (!address || typeof address === "string") {
    throw new Error("Incorrect address type")
  }

  return address.port
}

export async function setupChatbotEmbedServer(): Promise<void> {
  if (_setupPromise) {
    await _setupPromise
    return
  }

  _setupCount++
  if (_chatbotEmbedServer) {
    return
  }

  _setupPromise = new Promise<void>((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(`<!doctype html>
              <html>
                <head>
                  <title>ChatbotEmbed server</title>
                </head>
                <body>
                  <iframe width="750" height="750" src="http://project-331.local/chatbot-embed/${GLOBAL_CHATBOT_CONFIGURATION_ID_TEST}"></iframe>
                </body>
              </html>`)
    })

    function tryPort(port: number) {
      if (port > REDIRECT_BASE_PORT + REDIRECT_PORT_COUNT - 1) {
        _setupPromise = null
        reject(new Error("No free port in chatbotEmbed redirect range 8765..8784"))
        return
      }
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          tryPort(port + 1)
        } else {
          _setupPromise = null
          reject(err)
        }
      })

      server.listen(port, "127.0.0.1", () => {
        _chatbotEmbedServer = server
        _setupPromise = null
        resolve()
      })
    }

    tryPort(REDIRECT_BASE_PORT)
  })

  await _setupPromise
}

// oxlint-disable-next-line require-await -- async for the Promise<void> public API; callers await it
export async function teardownChatbotEmbedServer(): Promise<void> {
  _setupCount--
  if (_setupCount <= 0) {
    _setupCount = 0
    // Do not close the server; process exit cleans up. Avoids races with in-flight redirects.
  }
}
