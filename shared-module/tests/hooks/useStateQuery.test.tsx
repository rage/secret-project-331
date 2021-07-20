import { renderHook } from "@testing-library/react-hooks/dom"
import { QueryClient, QueryClientProvider } from "react-query"

import useStateQuery from "../../src/hooks/useStateQuery"

const testClient = new QueryClient({
  defaultOptions: {
    queries: {
      //Long cache time to prevent unnecessary refetching but remember to use different keys in tests
      cacheTime: 10000,
      // Do not attempt to refetch when testing
      retry: () => false,
    },
  },
})

const Wrapper: React.FC = ({ children }) => (
  <QueryClientProvider client={testClient}>{children}</QueryClientProvider>
)

describe("useStateQuery hook", () => {
  test("doesn't execute query if one of the keys is undefined", () => {
    const query = jest.fn()
    const hookResult = renderHook(() => useStateQuery(["disabled-test", undefined], query), {
      wrapper: Wrapper,
    })
    expect(hookResult.result.current.state).toBe("disabled")
    hookResult.rerender()
    expect(hookResult.result.current.state).toBe("disabled")
    expect(query).not.toBeCalled()
  })

  test("executes query if all keys are defined", async () => {
    const query = jest.fn().mockReturnValue(Promise.resolve({ courseId: "123" }))
    const hookResult = renderHook(() => useStateQuery(["enabled-test"], query), {
      wrapper: Wrapper,
    })
    hookResult.rerender()
    expect(hookResult.result.current.state).toBe("loading")
    await hookResult.waitForNextUpdate()
    expect(hookResult.result.current.state).toBe("ready")
    expect(query).toBeCalled()
  })

  test("results in error if query fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {
      // No console spam
    })
    const query = jest.fn().mockReturnValue(Promise.reject(new Error("Query failed")))
    const hookResult = renderHook(() => useStateQuery(["error-test"], query), {
      wrapper: Wrapper,
    })
    hookResult.rerender()
    expect(hookResult.result.current.state).toBe("loading")
    await hookResult.waitForNextUpdate()
    expect(hookResult.result.current.state).toBe("error")
  })
})
