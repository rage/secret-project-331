"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import React, { useState } from "react"

import EditUserPopup from "../EditUserPopup"

const PARENT_ROLE_TEST_ID = "parent-role"

const popupProps = (role: string, setRole: React.Dispatch<React.SetStateAction<string>>) => ({
  show: true,
  setShow: jest.fn(),
  name: "Teacher Example",
  email: "teacher@example.com",
  role,
  setRole,
  handleSave: jest.fn(),
})

/** Mirrors the manage-organization page, which owns the role and passes its setter down. */
const PopupWithRoleState: React.FC<{ initialRole: string }> = ({ initialRole }) => {
  const [role, setRole] = useState(initialRole)
  return (
    <>
      <EditUserPopup {...popupProps(role, setRole)} />
      <span data-testid={PARENT_ROLE_TEST_ID}>{role}</span>
    </>
  )
}

const getRoleTrigger = (): HTMLElement => {
  const trigger = document.querySelector("#edit-user-role")
  if (trigger === null) {
    throw new Error("Role select trigger not found")
  }
  return trigger as HTMLElement
}

const chooseRole = (label: string) => {
  fireEvent.keyDown(getRoleTrigger(), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: label }))
}

describe("EditUserPopup", () => {
  it("shows the role it was given", () => {
    render(<EditUserPopup {...popupProps("Admin", jest.fn())} />)

    expect(getRoleTrigger()).toHaveTextContent("role-admin")
  })

  it("hands a picked role to the parent and keeps showing it", () => {
    render(<PopupWithRoleState initialRole="Admin" />)

    chooseRole("role-reviewer")

    expect(screen.getByTestId(PARENT_ROLE_TEST_ID)).toHaveTextContent("Reviewer")
    expect(getRoleTrigger()).toHaveTextContent("role-reviewer")
  })

  it("follows the role prop when the dialog is reopened for another user", () => {
    const setRole = jest.fn()
    const { rerender } = render(<EditUserPopup {...popupProps("Admin", setRole)} />)

    rerender(<EditUserPopup {...popupProps("Reviewer", setRole)} />)

    expect(getRoleTrigger()).toHaveTextContent("role-reviewer")
    expect(setRole).toHaveBeenLastCalledWith("Reviewer")
  })
})
