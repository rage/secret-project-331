import { useEffect, useState } from "react"

export interface Item {
  id: string
  title: string
}

export interface NestedHeadings {
  id: string
  title: string
  items: Item[]
  offsetHeight: number
  offsetTop: number
}

const getNestedHeadings = (headingElements: HTMLElement[]) => {
  const nestedHeadings: NestedHeadings[] = []

  headingElements.forEach((heading) => {
    const { innerText: title, id, offsetHeight, offsetTop } = heading

    if (heading.nodeName === "H2") {
      nestedHeadings.push({ id, title, offsetHeight, offsetTop, items: [] })
    } else if (heading.nodeName === "H3" && nestedHeadings.length > 0) {
      nestedHeadings[nestedHeadings.length - 1].items.push({
        id,
        title,
      })
    }
  })

  return nestedHeadings
}

export default function useHeadingData() {
  const [headings, setHeadings] = useState<NestedHeadings[]>([])

  useEffect(() => {
    // eslint-disable-next-line i18next/no-literal-string
    const headingElements = Array.from(document.querySelectorAll<HTMLElement>("h2, h3"))

    const result = getNestedHeadings(headingElements)
    setHeadings(result)
  }, [])

  return { headings }
}
