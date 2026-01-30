"use client"

import { OverlayProvider } from "@react-aria/overlays"
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import React from "react"
import { I18nextProvider } from "react-i18next"

import i18nTest from "../../../utils/testing/i18nTest"
import { DialogProvider, useDialog } from "../DialogProvider"

// Test wrapper with all necessary providers
const TestWrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <I18nextProvider i18n={i18nTest}>
    <OverlayProvider>
      <DialogProvider>{children}</DialogProvider>
    </OverlayProvider>
  </I18nextProvider>
)

describe("useDialog hook", () => {
  it("should throw an error if used outside of DialogProvider", () => {
    expect(() => {
      renderHook(() => useDialog())
    }).toThrow("useDialog must be used within a DialogProvider")
  })

  it("should return alert, confirm, and prompt functions when inside DialogProvider", () => {
    const { result } = renderHook(() => useDialog(), { wrapper: TestWrapper })

    expect(typeof result.current.alert).toBe("function")
    expect(typeof result.current.confirm).toBe("function")
    expect(typeof result.current.prompt).toBe("function")
  })

  describe("dialog UI behavior", () => {
    it("opens alert dialog and resolves after OK click", async () => {
      let resolved = false
      const AlertOpener: React.FC = () => {
        const { alert } = useDialog()
        return (
          <button
            onClick={async () => {
              await alert("Alert body", "Alert title")
              resolved = true
            }}
          >
            Open Alert
          </button>
        )
      }

      render(<AlertOpener />, { wrapper: TestWrapper })

      fireEvent.click(screen.getByText("Open Alert"))

      // Alert dialog appears
      expect(await screen.findByText("Alert title")).toBeInTheDocument()
      expect(screen.getByText("Alert body")).toBeInTheDocument()

      // Click OK
      fireEvent.click(screen.getByRole("button", { name: /OK/i }))

      await waitFor(() => expect(resolved).toBe(true))
    })

    it("opens confirm dialog and resolves true/false based on button click", async () => {
      let resultTrue = false
      let resultFalse = false

      const ConfirmOpener: React.FC = () => {
        const { confirm } = useDialog()
        return (
          <>
            <button
              onClick={async () => {
                resultTrue = await confirm("Confirm message", "Confirm title")
              }}
            >
              Open Confirm True
            </button>
            <button
              onClick={async () => {
                resultFalse = await confirm("Confirm message", "Confirm title")
              }}
            >
              Open Confirm False
            </button>
          </>
        )
      }

      render(<ConfirmOpener />, { wrapper: TestWrapper })

      // First, test true
      fireEvent.click(screen.getByText("Open Confirm True"))
      expect(await screen.findByText("Confirm title")).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: /yes/i }))
      await waitFor(() => expect(resultTrue).toBe(true))

      // Then, test false
      fireEvent.click(screen.getByText("Open Confirm False"))
      expect(await screen.findByText("Confirm title")).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: /no/i }))
      await waitFor(() => expect(resultFalse).toBe(false))
    })

    it("opens prompt dialog and resolves input value or null on cancel", async () => {
      let promptResult: string | null = null

      const PromptOpener: React.FC = () => {
        const { prompt } = useDialog()
        return (
          <button
            onClick={async () => {
              promptResult = await prompt("Enter name", "Prompt title", "Default")
            }}
          >
            Open Prompt
          </button>
        )
      }

      render(<PromptOpener />, { wrapper: TestWrapper })

      // Open prompt and confirm
      fireEvent.click(screen.getByText("Open Prompt"))
      expect(await screen.findByText("Prompt title")).toBeInTheDocument()

      const input = screen.getByRole("textbox")
      fireEvent.change(input, { target: { value: "New Value" } })
      fireEvent.click(screen.getByRole("button", { name: /OK/i }))
      await waitFor(() => expect(promptResult).toBe("New Value"))

      // Open again and cancel
      fireEvent.click(screen.getByText("Open Prompt"))
      expect(await screen.findByText("Prompt title")).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: /Cancel/i }))
      await waitFor(() => expect(promptResult).toBeNull())
    })
  })
})
