import { createAction } from "typesafe-actions"

export const setAdvancedEditing = createAction(
  "SET_ADVANCED_EDITING",
  (itemId: string, editing: boolean) => ({ itemId: itemId, editing: editing }),
)<{ itemId: string; editing: boolean }>()

export const setScaleMax = createAction(
  "SET_SCALE_MAX",
  (itemId: string, newValue: number, valid: boolean) => ({
    itemId: itemId,
    newValue: newValue,
    valid: valid,
  }),
)<{ itemId: string; newValue: number; valid: boolean }>()

export const setScaleMin = createAction(
  "SET_SCALE_MIN",
  (itemId: string, newValue: number, valid: boolean) => ({
    itemId: itemId,
    newValue: newValue,
    valid: valid,
  }),
)<{ itemId: string; newValue: number; valid: boolean }>()

export const setMatrixCellValue = createAction(
  "SET_SCALE_MIN",
  (itemId: string, newValue: string, column: number, row: number) => ({
    itemId: itemId,
    newValue: newValue,
    column: column,
    row: row,
  }),
)<{ itemId: string; newValue: string; column: number; row: number }>()

export const setMatrixColumnSize = createAction(
  "SET_COLUMN_SIZE",
  (itemId: string, newValue: number, valid: boolean) => ({
    itemId: itemId,
    newValue: newValue,
    valid: valid,
  }),
)<{ itemId: string; newValue: number; valid: boolean }>()

export const setMatrixRowSize = createAction(
  "SET_ROW_SIZE",
  (itemId: string, newValue: number, valid: boolean) => ({
    itemId: itemId,
    newValue: newValue,
    valid: valid,
  }),
)<{ itemId: string; newValue: number; valid: boolean }>()

export const setMatrix = createAction("SET_MATRIX", (itemId: string, newValue: string[][]) => ({
  itemId: itemId,
  newValue: newValue,
}))<{ itemId: string; newValue: string[][] }>()

// regex testing state
export const toggleValidRegexTestingState = createAction(
  "SET_TESTING_REGEX",
  (itemId: string, testing: boolean) => ({
    itemId: itemId,
    testing: testing,
  }),
)<{ itemId: string; testing: boolean }>()

export const toggleFormatRegexTestingState = createAction(
  "SET_FORMAT_TESTING_REGEX",
  (itemId: string, testing: boolean) => ({
    itemId: itemId,
    testing: testing,
  }),
)<{ itemId: string; testing: boolean }>()

// input test regexes
export const setValidityTestRegex = createAction(
  "SET_TEST_REGEX",
  (itemId: string, testRegex: string) => ({
    itemId: itemId,
    testRegex: testRegex,
  }),
)<{ itemId: string; testRegex: string }>()

export const setFormatTestRegex = createAction(
  "SET_FORMAT_TEST_REGEX",
  (itemId: string, testRegex: string) => ({
    itemId: itemId,
    testRegex: testRegex,
  }),
)<{ itemId: string; testRegex: string }>()

// regex test answers
export const setValidityRegexTestAnswer = createAction(
  "SETREGEX_TESTANSWER",
  (itemId: string, testAnswer: string) => ({
    itemId: itemId,
    testAnswer: testAnswer,
  }),
)<{ itemId: string; testAnswer: string }>()

export const setFormatRegexTestAnswer = createAction(
  "SET_FORMAT_REGEX_TESTANSWER",
  (itemId: string, testAnswer: string) => ({
    itemId: itemId,
    testAnswer: testAnswer,
  }),
)<{ itemId: string; testAnswer: string }>()

// are the regexes valid
export const setValidValidityRegex = createAction(
  "SET_VALIDREGEX",
  (itemId: string, valid: boolean) => ({
    itemId: itemId,
    valid: valid,
  }),
)<{ itemId: string; valid: boolean }>()

export const setFormatValidityRegex = createAction(
  "SET_VALIDFORMATREGEX",
  (itemId: string, valid: boolean) => ({
    itemId: itemId,
    valid: valid,
  }),
)<{ itemId: string; valid: boolean }>()
