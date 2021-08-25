import { format } from "date-fns"

const dateToString = (date: Date, timeZone: boolean): string => {
  return `${format(date, "yyyy-MM-dd HH:mm")} ${timeZone ? "UTC+8" : ""}`
}

export { dateToString }
