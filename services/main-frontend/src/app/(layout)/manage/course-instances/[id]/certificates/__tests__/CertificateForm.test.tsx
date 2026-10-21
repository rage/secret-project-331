"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import CertificateForm, { type CertificateFields } from "../CertificateForm"

function changeFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", { configurable: true, value: files })
  fireEvent.change(input)
}

describe("CertificateForm", () => {
  it("submits the selected background SVG and leaves the optional overlay empty", async () => {
    const onClickSave = jest.fn()
    const { container } = render(
      <CertificateForm
        generatingCertificatesEnabled={false}
        configurationAndRequirements={null}
        onClickSave={onClickSave}
        onClickCancel={jest.fn()}
      />,
    )

    const [backgroundInput] = container.querySelectorAll('input[type="file"]')
    const backgroundFile = new File(["<svg></svg>"], "background.svg", { type: "image/svg+xml" })
    changeFiles(backgroundInput as HTMLInputElement, [backgroundFile])

    fireEvent.click(screen.getByRole("button", { name: "button-text-save" }))

    await waitFor(() => expect(onClickSave).toHaveBeenCalledTimes(1))
    const submitted = onClickSave.mock.calls[0][0] as CertificateFields
    expect(submitted.backgroundSvg).toEqual([backgroundFile])
    expect(submitted.overlaySvg).toEqual([])
  })

  it("rejects submission without a background SVG when there is no existing configuration", async () => {
    const onClickSave = jest.fn()
    render(
      <CertificateForm
        generatingCertificatesEnabled={false}
        configurationAndRequirements={null}
        onClickSave={onClickSave}
        onClickCancel={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "button-text-save" }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("required-field"))
    expect(onClickSave).not.toHaveBeenCalled()
  })
})
