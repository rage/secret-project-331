import type { NativeInputFieldProps } from "../NativeInputField"

export type SegmentedFieldKind = "date" | "time" | "datetime"

export type SegmentedTemporalFieldProps = Omit<NativeInputFieldProps, "type"> & {
  hourCycle?: 12 | 24
}

export type SegmentedDateInputFieldProps = SegmentedTemporalFieldProps & {
  kind: SegmentedFieldKind
}

export type DateLikeFieldProps = SegmentedDateInputFieldProps & {
  kind: "date" | "datetime"
}

export type TimeOnlyFieldProps = SegmentedDateInputFieldProps & {
  kind: "time"
}
