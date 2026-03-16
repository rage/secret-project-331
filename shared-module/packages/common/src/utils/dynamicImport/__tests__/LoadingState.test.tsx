"use client"

import { act, render, screen } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"

import i18nTest from "../../testing/i18nTest"
import LoadingState from "../LoadingState"
import {
  DYNAMIC_IMPORT_STATE_COMMITTED,
  DYNAMIC_IMPORT_STATE_IMPORT_REJECTED,
  DYNAMIC_IMPORT_STATE_IMPORT_RESOLVED_PENDING_COMMIT,
  DYNAMIC_IMPORT_STATE_INVALID_EXPORT,
  DYNAMIC_IMPORT_STATE_LOADING,
  DynamicImportStatus,
  setDynamicImportStatus,
} from "../dynamicImportStore"

const renderWithI18n = (debugId: string) =>
  render(
    <I18nextProvider i18n={i18nTest}>
      <LoadingState debugId={debugId} />
    </I18nextProvider>,
  )

const setStatus = (id: string, status: DynamicImportStatus) => {
  setDynamicImportStatus(id, status)
}

describe("LoadingState", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("shows slow and very slow warnings over time", () => {
    const id = "slow-id"
    setStatus(id, { state: DYNAMIC_IMPORT_STATE_LOADING, startedAt: Date.now() })

    renderWithI18n(id)

    expect(
      screen.queryByText("Loading a part of the application is taking longer than expected."),
    ).toBeNull()

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(
      screen.getByText("Loading a part of the application is taking longer than expected."),
    ).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(25000)
    })

    expect(
      screen.getByText(
        "This may be due to network issues. If loading does not finish soon, please reload the page.",
      ),
    ).toBeInTheDocument()
  })

  test("shows detected hard failure message and reload button for rejected import", () => {
    const id = "rejected-id"
    setStatus(id, {
      state: DYNAMIC_IMPORT_STATE_IMPORT_REJECTED,
      startedAt: Date.now(),
      errorMessage: "boom",
    })

    renderWithI18n(id)

    expect(
      screen.getByText("We tried to load this part of the app, but the import failed."),
    ).toBeInTheDocument()
    expect(screen.getByText("boom")).toBeInTheDocument()

    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument()
  })

  test("shows hard-timeout fallback reload UI when still not committed", () => {
    const id = "timeout-id"
    setStatus(id, { state: DYNAMIC_IMPORT_STATE_LOADING, startedAt: Date.now() })

    renderWithI18n(id)

    act(() => {
      jest.advanceTimersByTime(90000)
    })

    const warnings = screen.getAllByText(
      "This may be due to network issues. If loading does not finish soon, please reload the page.",
    )
    expect(warnings.length).toBe(1)
    expect(
      screen.getByText("Loading has stalled. Please try reloading the page."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument()
  })

  test("shows resolved-no-commit detected message after slow warning delay", () => {
    const id = "resolved-no-commit-id"
    setStatus(id, {
      state: DYNAMIC_IMPORT_STATE_IMPORT_RESOLVED_PENDING_COMMIT,
      startedAt: Date.now(),
      resolvedAt: Date.now() + 100,
    })

    renderWithI18n(id)

    expect(
      screen.queryByText("We loaded the code, but the component has not finished rendering yet."),
    ).toBeNull()

    act(() => {
      jest.advanceTimersByTime(5_000)
    })

    expect(
      screen.getByText("We loaded the code, but the component has not finished rendering yet."),
    ).toBeInTheDocument()
  })

  test("does not show hard-timeout fallback when already committed", () => {
    const id = "committed-id"
    setStatus(id, {
      state: DYNAMIC_IMPORT_STATE_COMMITTED,
      startedAt: Date.now(),
      committedAt: Date.now(),
    })

    renderWithI18n(id)

    act(() => {
      jest.advanceTimersByTime(90000)
    })

    expect(screen.queryByRole("button", { name: "Reload page" })).toBeNull()
  })

  test("handles invalid export hard failure", () => {
    const id = "invalid-id"
    setStatus(id, {
      state: DYNAMIC_IMPORT_STATE_INVALID_EXPORT,
      startedAt: Date.now(),
      details: "not a component",
    })

    renderWithI18n(id)

    expect(
      screen.getByText("We loaded the module, but it did not export a usable React component."),
    ).toBeInTheDocument()
    expect(screen.getByText("not a component")).toBeInTheDocument()
  })
})
