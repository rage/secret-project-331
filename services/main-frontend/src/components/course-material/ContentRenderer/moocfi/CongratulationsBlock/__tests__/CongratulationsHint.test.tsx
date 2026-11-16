"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import type { UserModuleCompletionStatus } from "@/generated/course-material-api/types.generated"

import CongratulationsLinks from "../CongratulationsLinks"

const module_: UserModuleCompletionStatus = {
  certificate_configuration_id: null,
  certification_enabled: false,
  completed: false,
  default: false,
  register_credits_via_suotar: false,
  grade: 5,
  module_id: "m",
  name: "Intro",
  order_number: 1,
  passed: true,
  prerequisite_modules_completed: true,
  registers_credits: true,
} as UserModuleCompletionStatus

describe("disabled Register CTA (F-48)", () => {
  it("stays focusable and explains why it is disabled", () => {
    render(<CongratulationsLinks certificateConfigurationId={null} module={module_} />)
    const button = screen.getByRole("button", { name: "register" })
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute("aria-disabled", "true")
    expect(button).toHaveAccessibleDescription("credit-registration-registers-on-module-completion")
  })
})
