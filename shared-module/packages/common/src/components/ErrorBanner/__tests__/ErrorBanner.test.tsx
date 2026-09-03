"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import { createInstance } from "i18next"
import type React from "react"
import { I18nextProvider, initReactI18next } from "react-i18next"

import { AppApiError } from "../../../errors/AppApiError"
import sharedModuleTranslations from "../../../locales/en/shared-module.json"
import ErrorBanner from "../index"

const i18n = createInstance()

function renderBanner(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

describe("ErrorBanner", () => {
  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: "en",
      fallbackLng: "en",
      ns: ["shared-module"],
      defaultNS: "shared-module",
      resources: {
        en: {
          "shared-module": sharedModuleTranslations,
        },
      },
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    })
  })

  test("maps a canonical api error onto the notice", () => {
    const error = new AppApiError({
      kind: "api",
      status: 403,
      type: "forbidden",
      messageKey: "forbidden",
      requestId: "req-7",
      userMessage: "No permission to view user details",
      metadata: { block_id: "block-1" },
      body: {
        type: "forbidden",
        message_key: "forbidden",
        message: "No permission to view user details",
      },
    })

    renderBanner(<ErrorBanner error={error} variant="readOnly" />)

    expect(screen.getByRole("heading", { name: "Forbidden" })).toBeInTheDocument()
    expect(screen.getByText("req-7")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to error" })).toHaveAttribute("href", "#block-1")

    fireEvent.click(screen.getByRole("button", { name: /Technical details/ }))

    expect(screen.getByText("Message key").nextElementSibling).toHaveTextContent("forbidden")
    expect(screen.getByText("Status").nextElementSibling).toHaveTextContent("403")
  })

  test("renders the context message above the parsed copy", () => {
    renderBanner(
      <ErrorBanner error={new Error("Boom")} contextMessage={<span>While saving</span>} />,
    )

    expect(screen.getByText("While saving")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Boom" })).toBeInTheDocument()
  })

  test("translates the viewport height caps into CSS lengths", () => {
    const { container } = renderBanner(
      <ErrorBanner error={new Error("Boom")} maxHeightVH={50} listMaxHeightVH={30} />,
    )

    expect(container.firstElementChild).toHaveStyle({ maxHeight: "50vh" })
  })
})
