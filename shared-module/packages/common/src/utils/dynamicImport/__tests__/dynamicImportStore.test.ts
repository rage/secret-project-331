import {
  DYNAMIC_IMPORT_STATE_LOADING,
  DynamicImportStatus,
  getDynamicImportStatus,
  setDynamicImportStatus,
} from "../dynamicImportStore"

const createStatus = (overrides?: Partial<Extract<DynamicImportStatus, { state: "loading" }>>) => {
  const base: Extract<DynamicImportStatus, { state: "loading" }> = {
    state: DYNAMIC_IMPORT_STATE_LOADING,
    startedAt: 123,
  }
  return { ...base, ...overrides }
}

describe("dynamicImportStore", () => {
  test("setDynamicImportStatus and getDynamicImportStatus roundtrip for one id", () => {
    const id = "test-id"
    const status = createStatus()

    setDynamicImportStatus(id, status)

    expect(getDynamicImportStatus(id)).toEqual(status)
  })

  test("statuses are isolated per id", () => {
    const idA = "id-a"
    const idB = "id-b"

    const statusA = createStatus()
    const statusB = createStatus({ startedAt: 999 })

    setDynamicImportStatus(idA, statusA)
    setDynamicImportStatus(idB, statusB)

    expect(getDynamicImportStatus(idA)).toEqual(statusA)
    expect(getDynamicImportStatus(idB)).toEqual(statusB)
  })
})
