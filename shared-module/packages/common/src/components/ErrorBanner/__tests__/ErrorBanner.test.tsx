"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { createInstance } from "i18next"
import { I18nextProvider, initReactI18next } from "react-i18next"

import { AppApiError } from "../../../errors/AppApiError"
import sharedModuleTranslations from "../../../locales/en/shared-module.json"
import ErrorBanner from "../index"

const i18n = createInstance()

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

  it("renders backend message key and message in details", () => {
    const error = new AppApiError({
      kind: "api",
      status: 403,
      type: "forbidden",
      messageKey: "forbidden",
      userMessage: "No permission to view user details",
      metadata: { block_id: "block-1" },
      body: {
        type: "forbidden",
        message_key: "forbidden",
        message: "No permission to view user details",
      },
    })

    render(
      <I18nextProvider i18n={i18n}>
        <ErrorBanner error={error} variant="readOnly" />
      </I18nextProvider>,
    )

    fireEvent.click(screen.getByText("Show source"))
    const details = screen.getByText("Show source").closest("details")
    expect(details).not.toBeNull()
    const detailsScope = within(details as HTMLDetailsElement)
    expect(detailsScope.getByText("Message key: forbidden")).toBeInTheDocument()
    expect(detailsScope.getByText("No permission to view user details")).toBeInTheDocument()
    expect(detailsScope.getByText(/"messageKey": "forbidden"/)).toBeInTheDocument()
  })
})
