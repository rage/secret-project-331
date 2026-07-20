"use client"

import { render, waitFor } from "@testing-library/react"

import dynamicImport from "../../src/utils/dynamicImport"

describe("dynamicImport chunk error handling", () => {
  it("reloads the page on chunk load error", async () => {
    const reload = jest.fn()

    const failingImport = jest.fn().mockRejectedValue(
      Object.assign(new Error("Failed to load chunk"), {
        name: "ChunkLoadError",
      }),
    )

    const Component = dynamicImport(
      async () => {
        await failingImport()
        // This should never be reached
        return { default: () => <div>Loaded</div> }
      },
      {
        reload,
      },
    )

    render(<Component />)

    await waitFor(() => {
      expect(reload).toHaveBeenCalled()
    })
  })
})
