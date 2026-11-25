"use client"

import { render, screen } from "@testing-library/react"

import type { ExerciseSlideSubmission } from "@/generated/api/types.generated"

import ExerciseSubmissionList from "../ExerciseSubmissionList"

jest.mock("@/hooks/useUserDetails", () => ({
  ...jest.requireActual("@/hooks/useUserDetails"),
  useUserDetailsLookup: () => (userId: string) =>
    userId === "u1"
      ? { user_id: "u1", first_name: "Elsa", last_name: "Partanen", email: "e@example.com" }
      : undefined,
}))

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { name: string; time: string }) =>
      o ? `${key} ${o.name} ${o.time}` : key,
  }),
}))

describe("ExerciseSubmissionList", () => {
  it("names each submission link after the submitter and time", () => {
    const submissions = [
      { id: "s1", user_id: "u1", created_at: new Date("2024-01-02T10:00:00Z") },
    ] as unknown as ExerciseSlideSubmission[]
    render(<ExerciseSubmissionList exerciseSubmissions={submissions} courseId="c1" />)
    expect(screen.getByRole("link", { name: /Elsa Partanen/ }).getAttribute("href")).toBe(
      "/submissions/s1",
    )
  })
})
