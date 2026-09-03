"use client"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createInstance } from "i18next"
import type React from "react"
import { I18nextProvider, initReactI18next } from "react-i18next"

import sharedModuleTranslations from "../../locales/en/shared-module.json"
import DebugModal from "../DebugModal"

const mockMonacoEditor = jest.fn()

jest.mock("../monaco/MonacoEditor", () => ({
  __esModule: true,
  default: (props: { defaultValue?: string }) => {
    mockMonacoEditor(props)
    return null
  },
}))

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

beforeEach(() => {
  mockMonacoEditor.mockClear()
})

function renderDebugModal(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

function openTrigger() {
  return screen.getByRole("button", { name: "Data View" })
}

const SAMPLE_DATA = [
  { id: 1, name: "Ada" },
  { id: 2, name: "Grace" },
]

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => resolve(reader.result as string))
    reader.addEventListener("error", () => reject(reader.error))
    // oxlint-disable-next-line unicorn/prefer-blob-reading-methods -- jsdom's Blob has no .text()
    reader.readAsText(blob)
  })
}

describe("DebugModal", () => {
  test("opens on trigger click and closes on the dialog close button", async () => {
    renderDebugModal(<DebugModal data={SAMPLE_DATA} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(openTrigger())
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    // The dialog stays mounted through its exit animation before actually unmounting.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  test("renders the given data in the editor", () => {
    renderDebugModal(<DebugModal data={SAMPLE_DATA} />)
    fireEvent.click(openTrigger())

    expect(mockMonacoEditor).toHaveBeenCalled()
    const props = mockMonacoEditor.mock.lastCall?.[0] as { defaultValue?: string }
    expect(props.defaultValue).toBe(JSON.stringify(SAMPLE_DATA, null, 2))
  })

  test("downloads a CSV matching the given data", async () => {
    const createObjectURL = jest.fn().mockReturnValue("blob:mock-url")
    const revokeObjectURL = jest.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    const anchorClick = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    renderDebugModal(<DebugModal data={SAMPLE_DATA} />)
    fireEvent.click(openTrigger())
    fireEvent.click(screen.getByRole("button", { name: /Download CSV/ }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    await expect(readBlobAsText(blob)).resolves.toBe('"id","name"\n1,"Ada"\n2,"Grace"')
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url")

    anchorClick.mockRestore()
  })

  test("hides the CSV download action when the data isn't an array", () => {
    renderDebugModal(<DebugModal data={{ id: 1, name: "Ada" }} />)
    fireEvent.click(openTrigger())

    expect(screen.queryByRole("button", { name: /Download CSV/ })).not.toBeInTheDocument()
  })
})
