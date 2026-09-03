"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import NewCourseModuleForm from "../NewCourseModuleForm"

describe("NewCourseModuleForm", () => {
  it("submits the module name with the default start and end chapters", async () => {
    const onSubmitForm = jest.fn()
    render(<NewCourseModuleForm chapters={[1, 2, 3]} onSubmitForm={onSubmitForm} />)

    fireEvent.change(document.querySelector('input[name="name"]') as HTMLInputElement, {
      target: { value: "Module 1" },
    })

    const confirmButton = screen.getByRole("button", { name: "confirm" })
    await waitFor(() => expect(confirmButton).not.toBeDisabled())
    fireEvent.click(confirmButton)

    await waitFor(() => expect(onSubmitForm).toHaveBeenCalledTimes(1))
    const fields = onSubmitForm.mock.calls[0][0]
    expect(fields.name).toBe("Module 1")
    expect(fields.starts).toBe(1)
    expect(fields.ends).toBe(3)
  })
})
