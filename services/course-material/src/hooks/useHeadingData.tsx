import { Dispatch, SetStateAction, useEffect, useState } from "react"

import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "@/shared-module/common/utils/constants"

export interface Heading {
  title: string
  level: number
  headingsNavigationIndex: string | undefined
  element: HTMLHeadingElement
}

const getHeadings = (headingElements: HTMLHeadingElement[]) => {
  const headings: Heading[] = []

  headingElements.forEach((heading) => {
    try {
      const { innerText: title, tagName, dataset } = heading
      const headingsNavigationIndex = dataset.headingsNavigationIndex
      const level = parseInt(tagName.replace(/[^0-6]+/g, ""))

      headings.push({
        headingsNavigationIndex,
        title,
        level,
        element: heading,
      })
    } catch (e) {
      console.error(`Could not parse heading`, heading, e)
    }
  })

  return headings
}

function updateHeadings(setHeadings: Dispatch<SetStateAction<Heading[]>>) {
  const headingElements = Array.from(
    document.querySelectorAll<HTMLHeadingElement>(
      `h1.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS},
        h2.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS},
        h3.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS},
        h4.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS},
        h5.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS},
        h6.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS}`,
    ),
  )

  headingElements.forEach((heading, idx) => {
    heading.dataset.headingsNavigationIndex = idx.toString()
  })
  const result = getHeadings(headingElements)
  setHeadings(result)
}

export default function useHeadingData() {
  const [headings, setHeadings] = useState<Heading[]>([])

  useEffect(() => {
    updateHeadings(setHeadings)
    // Handle headings that get added to the page once it has finished loading
    setTimeout(() => {
      updateHeadings(setHeadings)
    }, 1000)
    setTimeout(() => {
      updateHeadings(setHeadings)
    }, 2000)
    setTimeout(() => {
      updateHeadings(setHeadings)
    }, 5000)
    setTimeout(() => {
      updateHeadings(setHeadings)
    }, 10000)
  }, [])

  return { headings }
}
