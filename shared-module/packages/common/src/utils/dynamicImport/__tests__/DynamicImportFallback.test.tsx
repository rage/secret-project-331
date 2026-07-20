"use client"

import { render, screen } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"

import i18nTest from "../../testing/i18nTest"
import { createDynamicImportFallbackModule } from "../DynamicImportFallback"
import type { DynamicImportStatus } from "../dynamicImportStore"

const renderFallback = () => {
  const Module = createDynamicImportFallbackModule("test-id")
  const Fallback = Module.default

  return render(
    <I18nextProvider i18n={i18nTest}>
      <Fallback />
    </I18nextProvider>,
  )
}

describe("createDynamicImportFallbackModule", () => {
  test("renders generic failure message when no reason is available", () => {
    renderFallback()

    expect(screen.getByText("We were unable to load this part of the page.")).toBeInTheDocument()
    expect(screen.queryByText((content) => content.startsWith("Reason:"))).not.toBeInTheDocument()
  })

  test("renders reason from errorMessage when present", () => {
    const status: DynamicImportStatus = {
      state: "import_rejected",
      startedAt: Date.now(),
      errorMessage: "Network error",
    }

    const Module = createDynamicImportFallbackModule("test-id", status)
    const Fallback = Module.default

    render(
      <I18nextProvider i18n={i18nTest}>
        <Fallback />
      </I18nextProvider>,
    )

    expect(screen.getByText("We were unable to load this part of the page.")).toBeInTheDocument()
    expect(screen.getByText("Reason: Network error")).toBeInTheDocument()
  })

  test("renders reason from details when present", () => {
    const status: DynamicImportStatus = {
      state: "invalid_export",
      startedAt: Date.now(),
      details: "Missing default export",
    }

    const Module = createDynamicImportFallbackModule("test-id", status)
    const Fallback = Module.default

    render(
      <I18nextProvider i18n={i18nTest}>
        <Fallback />
      </I18nextProvider>,
    )

    expect(screen.getByText("Reason: Missing default export")).toBeInTheDocument()
  })

  test("shows reload button", () => {
    const status: DynamicImportStatus = {
      state: "import_rejected",
      startedAt: Date.now(),
      errorMessage: "boom",
    }

    const Module = createDynamicImportFallbackModule("test-id", status)
    const Fallback = Module.default

    render(
      <I18nextProvider i18n={i18nTest}>
        <Fallback />
      </I18nextProvider>,
    )

    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument()
  })
})
