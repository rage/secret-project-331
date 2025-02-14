import { NextWebVitalsMetric } from "next/dist/shared/lib/utils"

const generateWebVitalsReporter = (serviceName: string) => {
  let webVitals: NextWebVitalsMetric[] = []
  const reportWebVitals = (metric: NextWebVitalsMetric) => {
    webVitals.push(metric)
    const length = webVitals.length

    // Prints web vitals once 10 seconds has passed since we've received a previous web vitals metric
    setTimeout(() => {
      if (webVitals.length <= 0 || webVitals.length !== length) {
        return
      }
      const vitals = webVitals
      webVitals = []
      console.groupCollapsed(`[${serviceName}] Web vitals`)
      console.table(vitals, ["label", "name", "value", "startTime"])
      console.groupEnd()
    }, 10000)
  }
  return reportWebVitals
}

export default generateWebVitalsReporter
