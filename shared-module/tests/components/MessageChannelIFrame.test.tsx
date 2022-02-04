/* eslint-disable i18next/no-literal-string */
import { render, waitFor } from "@testing-library/react"
import { rest } from "msw"
import { setupServer } from "msw/node"

import MessageChannelIFrame from "../../src/components/MessageChannelIFrame"

const server = setupServer(
  rest.get("/example-iframe-page", (_req, res, ctx) => {
    return res(ctx.body("<html>Hello from iframe</html>"))
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test("It renders", async () => {
  // @ts-ignore: jsdom does not have MessageChannel
  window.MessageChannel = jest.fn().mockReturnValue({ port1: {}, port2: {} })
  const res = render(
    <MessageChannelIFrame
      url="http://example.com/example-iframe-page"
      postThisStateToIFrame={{
        view_type: "exercise",
        data: { public_spec: {}, previous_submission: null },
      }}
      onMessageFromIframe={(message, responsePort) => {
        console.log(message, responsePort)
      }}
    />,
  )
  await waitFor(() => res.container.querySelector("iframe"))
  expect(res.container.querySelector("iframe")?.src).toBe("http://example.com/example-iframe-page")
})
