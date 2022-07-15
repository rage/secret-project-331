import { useEffect, useState } from "react"

export const INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS =
  "include-this-heading-in-headings-navigation"

export interface Heading {
  id: string
  title: string
  offsetHeight: number
  offsetTop: number
  level: number
}

const getHeadings = (headingElements: HTMLHeadingElement[]) => {
  const headings: Heading[] = []

  headingElements.forEach((heading) => {
    try {
      const { innerText: title, id, offsetHeight, offsetTop, tagName } = heading
      const level = parseInt(tagName.replace(/[^0-6]+/g, ""))

      headings.push({ id, title, offsetHeight, offsetTop, level })
    } catch (e) {
      // eslint-disable-next-line i18next/no-literal-string
      console.error(`Could not parse heading`, heading, e)
    }
  })

  return headings
}

export default function useHeadingData() {
  const [headings, setHeadings] = useState<Heading[]>([])

  useEffect(() => {
    // eslint-disable-next-line i18next/no-literal-string
    const headingElements = Array.from(
      document.querySelectorAll<HTMLHeadingElement>(
        // eslint-disable-next-line i18next/no-literal-string
        `h1.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS},
        h2.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS},
        h3.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS},
        h4.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS},
        h5.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS},
        h6.${INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS}`,
      ),
    )

    headingElements.forEach((heading, idx) => {
      // eslint-disable-next-line i18next/no-literal-string
      heading.id = `course-page-heading-${idx}`
    })
    const result = getHeadings(headingElements)
    setHeadings(result)
  }, [])

  return { headings }
}
