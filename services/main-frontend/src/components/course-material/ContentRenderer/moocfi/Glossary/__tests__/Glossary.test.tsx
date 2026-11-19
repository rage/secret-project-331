"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import Glossary from "../Glossary"

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: () => ({
    isSuccess: true,
    isLoading: false,
    isError: false,
    data: [{ id: "1", term: "saga", definition: "A story" }],
  }),
}))

jest.mock("@/generated/course-material-api/sdk.generated", () => ({
  getCourseMaterialGlossary: jest.fn(),
}))

describe("Glossary block (F-34b)", () => {
  it("renders an h2 and no h1 when embedded in a page", () => {
    render(<Glossary courseId="c" />)
    expect(screen.getByRole("heading", { level: 2, name: "glossary" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  })
})
