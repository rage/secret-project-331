/* eslint-disable i18next/no-literal-string */
import { render, waitFor } from "@testing-library/react"
import { rest } from "msw"
import { setupServer } from "msw/node"
import { I18nextProvider } from "react-i18next"

import MessageChannelIFrame from "../../src/components/MessageChannelIFrame"
import i18nTest from "../../src/utils/testing/i18nTest"

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
  window.MessageChannel = jest
    .fn()
    .mockReturnValue({ port1: { postMessage: jest.fn() }, port2: {} })

  const res = render(
    <I18nextProvider i18n={i18nTest}>
      <MessageChannelIFrame
        url="http://example.com/example-iframe-page"
        postThisStateToIFrame={{
          view_type: "exercise",
          exercise_task_id: "2c75563d-4129-49dd-9515-e55e006f875d",
          data: { public_spec: {}, previous_submission: null },
        }}
        onMessageFromIframe={(message, responsePort) => {
          console.log(message, responsePort)
        }}
      />
    </I18nextProvider>,
  )
  await waitFor(() => res.container.querySelector("iframe"))
  expect(res.container.querySelector("iframe")?.src).toBe("http://example.com/example-iframe-page")
})
