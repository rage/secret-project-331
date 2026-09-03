"use client"

import { fireEvent, render, screen } from "@testing-library/react"
import { createInstance } from "i18next"
import type React from "react"
import { I18nextProvider, initReactI18next } from "react-i18next"

import sharedModuleTranslations from "../../locales/en/shared-module.json"
import PaginationItemsPerPage from "../PaginationItemsPerPage"

const i18n = createInstance()

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

function renderItemsPerPage(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

function makePaginationInfo(limit: number) {
  return {
    page: 1,
    setPage: jest.fn(),
    limit,
    setLimit: jest.fn(),
  }
}

function trigger() {
  return screen.getByRole("button", { name: /Items per page/ })
}

describe("PaginationItemsPerPage", () => {
  test("selecting a different value calls setLimit with a number", () => {
    const paginationInfo = makePaginationInfo(100)
    renderItemsPerPage(<PaginationItemsPerPage paginationInfo={paginationInfo} />)

    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole("option", { name: "1000" }))

    expect(paginationInfo.setLimit).toHaveBeenCalledWith(1000)
    expect(paginationInfo.setLimit).toHaveBeenCalledTimes(1)
  })

  test("reflects an external change to paginationInfo.limit without calling setLimit back", () => {
    const paginationInfo = makePaginationInfo(100)
    const { rerender } = renderItemsPerPage(
      <PaginationItemsPerPage paginationInfo={paginationInfo} />,
    )
    expect(trigger()).toHaveTextContent("100")

    const updatedPaginationInfo = { ...paginationInfo, limit: 1000 }
    rerender(
      <I18nextProvider i18n={i18n}>
        <PaginationItemsPerPage paginationInfo={updatedPaginationInfo} />
      </I18nextProvider>,
    )

    expect(trigger()).toHaveTextContent("1000")
    expect(paginationInfo.setLimit).not.toHaveBeenCalled()
    expect(updatedPaginationInfo.setLimit).not.toHaveBeenCalled()
  })

  test("injects a custom URL limit into the option list in sorted order", () => {
    const paginationInfo = makePaginationInfo(250)
    renderItemsPerPage(<PaginationItemsPerPage paginationInfo={paginationInfo} />)

    expect(trigger()).toHaveTextContent("250")

    fireEvent.click(trigger())
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "100",
      "250",
      "1000",
      "10000",
    ])
  })
})
