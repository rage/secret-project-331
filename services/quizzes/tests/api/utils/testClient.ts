import { createServer, RequestListener } from "http"
import { NextApiHandler } from "next"
import { apiResolver } from "next/dist/server/api-utils/node/api-resolver"
import request from "supertest"

const testClient = (handler: NextApiHandler) => {
  const listener: RequestListener = (req, res) => {
    return apiResolver(
      req,
      res,
      undefined,
      handler,
      {
        previewModeId: "",
        previewModeEncryptionKey: "",
        previewModeSigningKey: "",
        dev: false,
        projectDir: "",
      },
      false,
    )
  }

  return request(createServer(listener))
}

export default testClient
