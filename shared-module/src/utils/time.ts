import { format } from "date-fns"

const dateToString = (date: Date, timeZone: boolean): string => {
  const datePart = `${format(date, "yyyy-MM-dd HH:mm")}`
  const timeZonePart = ` UTC ${format(date, `xxx`)}`
  return datePart + (timeZone ? timeZonePart : "")
}

export { dateToString }
