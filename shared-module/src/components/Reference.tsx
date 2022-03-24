/* eslint-disable i18next/no-literal-string */
import { css, keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useEffect, useState } from "react"

import { baseTheme } from "../styles"

const arr = [
  {
    id: "ref-1",
    text: "Juntunen, Marja-Leena & Kivijärvi, Sanna. (2019). Opetuksen saavutettavuuden lisääminen taiteen perusopetusta antavissa oppilaitoksissa. The Finnish Journal of Music Education, 22(1–2), 70–87.",
  },
  {
    id: "ref-2",
    text: "Juntunen, Marja-Leena & Kivijärvi, Sanna. (2019). Opetuksen saavutettavuuden lisääminen taiteen perusopetusta antavissa oppilaitoksissa. The Finnish Journal of Music Education, 22(1–2), 70–87.",
  },
  {
    id: "ref-3",
    text: "Juntunen, Marja-Leena & Kivijärvi, Sanna. (2019). Opetuksen saavutettavuuden lisääminen taiteen perusopetusta antavissa oppilaitoksissa. The Finnish Journal of Music Education, 22(1–2), 70–87.",
  },
  {
    id: "ref-4",
    text: "Juntunen, Marja-Leena & Kivijärvi, Sanna. (2019). Opetuksen saavutettavuuden lisääminen taiteen perusopetusta antavissa oppilaitoksissa. The Finnish Journal of Music Education, 22(1–2), 70–87.",
  },
  {
    id: "ref-5",
    text: "Juntunen, Marja-Leena & Kivijärvi, Sanna. (2019). Opetuksen saavutettavuuden lisääminen taiteen perusopetusta antavissa oppilaitoksissa. The Finnish Journal of Music Education, 22(1–2), 70–87.",
  },
  {
    id: "ref-6",
    text: "Juntunen, Marja-Leena & Kivijärvi, Sanna. (2019). Opetuksen saavutettavuuden lisääminen taiteen perusopetusta antavissa oppilaitoksissa. The Finnish Journal of Music Education, 22(1–2), 70–87.",
  },
  {
    id: "ref-7",
    text: "Juntunen, Marja-Leena & Kivijärvi, Sanna. (2019). Opetuksen saavutettavuuden lisääminen taiteen perusopetusta antavissa oppilaitoksissa. The Finnish Journal of Music Education, 22(1–2), 70–87.",
  },
  {
    id: "ref-8",
    text: "Juntunen, Marja-Leena & Kivijärvi, Sanna. (2019). Opetuksen saavutettavuuden lisääminen taiteen perusopetusta antavissa oppilaitoksissa. The Finnish Journal of Music Education, 22(1–2), 70–87.",
  },
  {
    id: "ref-9",
    text: "Juntunen, Marja-Leena & Kivijärvi, Sanna. (2019). Opetuksen saavutettavuuden lisääminen taiteen perusopetusta antavissa oppilaitoksissa. The Finnish Journal of Music Education, 22(1–2), 70–87.",
  },
  {
    id: "ref-10",
    text: "Juntunen, Marja-Leena & Kivijärvi, Sanna. (2019). Opetuksen saavutettavuuden lisääminen taiteen perusopetusta antavissa oppilaitoksissa. The Finnish Journal of Music Education, 22(1–2), 70–87.",
  },
]

const openAnimation = keyframes`
0% { opacity: 0; }
100% { opacity: 1; }
`

const slideDown = keyframes`
from { opacity: 0; height: 0; padding: 0;}
to { opacity: 1; height: 100%; padding: 10px;}
`
const Wrapper = styled.div`
  span {
    text-decoration: underline;
    color: #46749b;
  }
`

// eslint-disable-next-line i18next/no-literal-string
const TextWrapper = styled.div`
  padding: 0;
  margin: 0;
  background: #f3f3f3;

  details[open] summary ~ * {
    animation: ${openAnimation} 0.3s ease-in-out;
    color: ${baseTheme.colors.grey[700]};
  }

  details {
    border-left: 4px solid ${baseTheme.colors.grey[700]};
  }

  details[open] > div {
    animation-name: ${slideDown};
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
  }

  details summary {
    padding: 1rem 1rem 1rem 3rem;
    position: relative;
    cursor: pointer;
    font-size: 1.25rem;
    font-weight: medium;
    list-style: none;
    height: 100px;
    outline: 0;
    height: auto;
    color: ${baseTheme.colors.grey[700]};
    justify-content: center;
  }

  details summary::-webkit-details-marker {
    display: none;
  }

  details[open] > summary {
    color: #1c1c1c;
  }

  details summary:after {
    content: "+";
    color: black;
    position: absolute;
    font-size: 1.75rem;
    line-height: 0;
    margin-top: 0.75rem;
    left: 20px;
    font-weight: 200;
    transform-origin: center;
    transition: all 200ms linear;
  }
  details[open] summary:after {
    transform: rotate(45deg);
    font-size: 2rem;
  }
  details[open] summary {
    font-weight: 600;
    opacity: 0.9;
  }

  ul {
    padding: 0 3rem 3rem 3rem;
    counter-reset: ref;
  }

  details ul li {
    counter-increment: ref;
    font-size: 1.1rem;
    line-height: 1.6;
    margin: 0 0 0.2rem;
    padding-left: 8px;
    list-style-position: outside;
  }

  ul li::marker {
    display: list-item;
    content: "[" counter(ref) "]";
    text-align: center;
    margin-left: 2rem !important;
  }
`
const StyledLink = styled.a`
  text-decoration: underline;
`

interface Reference {
  id: string
  text: string
}

const PLACEHOLDER_HEADING = "Reference"

export type ReferenceProps = React.QuoteHTMLAttributes<HTMLDivElement>

const Reference: React.FC<ReferenceProps> = () => {
  const [reference, setReference] = useState<Reference[]>([])
  const [active, setActive] = useState<string>()

  useEffect(() => {
    const x: Reference[] = []
    const referenceEl = Array.from(document.querySelectorAll<HTMLElement>("#ref"))

    referenceEl.forEach((ref) => {
      const { innerText: text, id } = ref
      x.push({ id, text })
    })
    setReference(x)
  }, [])

  console.log("***ref", reference)

  useEffect(() => {
    const eventHandler = (evt: any) => {
      if (reference) {
        reference.forEach(({ text }) => {
          if (text === evt.target.innerText) {
            evt.preventDefault()
            let elementId = evt.target.innerText
            elementId = elementId.substring(1, elementId.length - 1)
            const details = document.querySelector<HTMLDetailsElement>("#reference")
            setActive(`ref-${elementId}`)

            if (details) {
              if (!details.open) {
                details.open = true
              }
            }
            document.querySelector(`#ref-${elementId}`)?.scrollIntoView({
              behavior: "smooth",
            })
            console.log("details", details)
          }
        })
      }
    }

    window.addEventListener("click", eventHandler)
    return () => {
      window.removeEventListener("click", eventHandler)
    }
  }, [reference])

  return (
    <Wrapper>
      <h1>What is the meaning of Life</h1>
      <p>
        Contrary to popular belief, Lorem Ipsum is not simply random text.
        <StyledLink id="ref" href="#ref-1">
          [1]
        </StyledLink>
        It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years
        old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up
        one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going
        through the cites of the word in classical literature, discovered the undoubtable source.
        Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus Bonorum et Malorum (The
        Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the
        theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem
        ipsum dolor sit amet., comes from a line in section 1.10.32. The standard chunk of Lorem
        Ipsum used since the 1500s is reproduced below for those interested. Sections 1.10.32 and
        1.10.33 from de Finibus Bonorum et Malorum by Cicero are also reproduced in their exact
        original form, accompanied by English versions from the 1914 translation by H. Rackham.
        Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece
        of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock,
        a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure
        Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the
        word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from
        sections 1.10.32{" "}
        <StyledLink id="ref" href="#ref-2">
          [2]
        </StyledLink>
        and 1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero,
        written in 45 BC. This book is a treatise on the theory of ethics, very popular during the
        Renaissance. The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line
        in section 1.10.32. The standard chunk of Lorem Ipsum used since the 1500s is reproduced
        below for those interested. Sections 1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum
        by Cicero are also reproduced in their exact original form, accompanied by English versions
        from the 1914 translation by H. Rackham. Contrary to popular belief, Lorem Ipsum is not
        simply random text. It has roots in a piece of classical Latin literature from 45 BC, making
        it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in
        Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum
        passage, and going through the cites of the word in classical literature, discovered the
        undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus
        Bonorum et Malorum (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is
        a treatise on the theory of ethics, very popular during the Renaissance. The first line of
        Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in section 1.10.32. The standard
        chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested. Sections
        1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum by Cicero are also reproduced in
        their exact original form, accompanied by English versions from the 1914 translation by H.
        Rackham. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in
        a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard
        McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the
        more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the
        cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum
        comes from sections 1.10.32{" "}
        <StyledLink id="ref" href="#ref-3">
          [3]
        </StyledLink>{" "}
        and 1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero,
        written in 45 BC. This book is a treatise on the theory of ethics, very popular during the
        Renaissance. The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line
        in section 1.10.32. The standard chunk of Lorem Ipsum used since the 1500s is reproduced
        below for those interested. Sections 1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum
        by Cicero are also reproduced in their exact original form, accompanied by English versions
        from the 1914 translation by H. Rackham. Contrary to popular belief, Lorem Ipsum is not
        simply random text. It has roots in a piece of classical Latin literature from 45 BC, making
        it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in
        Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum
        passage, and going through the cites of the word in classical literature, discovered the
        undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus
        Bonorum et Malorum (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is
        a treatise on the theory of ethics, very popular during the Renaissance. The first line of
        Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in section 1.10.32. The standard
      </p>
      <h1>Why do spongebob have a square pant?</h1>
      <p>
        Contrary to popular belief, Lorem Ipsum is not simply random text.
        <StyledLink id="ref" href="#ref-4">
          [3]
        </StyledLink>
        It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years
        old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up
        one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going
        through the cites of the word in classical literature, discovered the undoubtable source.
        Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus Bonorum et Malorum (The
        Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the
        theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem
        ipsum dolor sit amet., comes from a line in section 1.10.32. The standard chunk of Lorem
        Ipsum used since the 1500s is reproduced below for those interested. Sections 1.10.32 and
        1.10.33 from de Finibus Bonorum et Malorum by Cicero are also reproduced in their exact
        original form, accompanied by English versions from the 1914 translation by H. Rackham.
        Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece
        of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock,
        a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure
        Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the
        word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from
        sections 1.10.32{" "}
        <StyledLink id="ref" href="#ref-5">
          [4]
        </StyledLink>
        and 1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero,
        written in 45 BC. This book is a treatise on the theory of ethics, very popular during the
        Renaissance. The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line
        in section 1.10.32. The standard chunk of Lorem Ipsum used since the 1500s is reproduced
        below for those interested. Sections 1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum
        by Cicero are also reproduced in their exact original form, accompanied by English versions
        from the 1914 translation by H. Rackham. Contrary to popular belief, Lorem Ipsum is not
        simply random text. It has roots in a piece of classical Latin literature from 45 BC, making
        it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in
        Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum
        passage, and going through the cites of the word in classical literature, discovered the
        undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus
        Bonorum et Malorum (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is
        a treatise on the theory of ethics, very popular during the Renaissance. The first line of
        Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in section 1.10.32. The standard
        chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested. Sections
        1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum by Cicero are also reproduced in
        their exact original form, accompanied by English versions from the 1914 translation by H.
        Rackham. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in
        a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard
        McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the
        more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the
        cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum
        comes from sections 1.10.32{" "}
        <StyledLink id="ref" href="#ref-6">
          [5]
        </StyledLink>{" "}
        and 1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero,
        written in 45 BC. This book is a treatise on the theory of ethics, very popular during the
        Renaissance. The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line
        in section 1.10.32. The standard chunk of Lorem Ipsum used since the 1500s is reproduced
        below for those interested. Sections 1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum
        by Cicero are also reproduced in their exact original form, accompanied by English versions
        from the 1914 translation by H. Rackham. Contrary to popular belief, Lorem Ipsum is not
        simply random text. It has roots in a piece of classical Latin literature from 45 BC, making
        it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in
        Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum
        passage, and going through the cites of the word in classical literature, discovered the
        undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus
        Bonorum et Malorum (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is
        a treatise on the theory of ethics, very popular during the Renaissance. The first line of
        Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in section 1.10.32. The standard
      </p>
      <h1>Who is a project manager?</h1>
      <p>
        Contrary to popular belief, Lorem Ipsum is not simply random text.
        <StyledLink id="ref" href="#ref-7">
          [6]
        </StyledLink>
        It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years
        old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up
        one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going
        through the cites of the word in classical literature, discovered the undoubtable source.
        Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus Bonorum et Malorum (The
        Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the
        theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem
        ipsum dolor sit amet., comes from a line in section 1.10.32. The standard chunk of Lorem
        Ipsum used since the 1500s is reproduced below for those interested. Sections 1.10.32 and
        1.10.33 from de Finibus Bonorum et Malorum by Cicero are also reproduced in their exact
        original form, accompanied by English versions from the 1914 translation by H. Rackham.
        Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece
        of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock,
        a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure
        Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the
        word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from
        sections 1.10.32{" "}
        <StyledLink id="ref" href="#ref-8">
          [7]
        </StyledLink>
        and 1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero,
        written in 45 BC. This book is a treatise on the theory of ethics, very popular during the
        Renaissance. The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line
        in section 1.10.32. The standard chunk of Lorem Ipsum used since the 1500s is reproduced
        below for those interested. Sections 1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum
        by Cicero are also reproduced in their exact original form, accompanied by English versions
        from the 1914 translation by H. Rackham. Contrary to popular belief, Lorem Ipsum is not
        simply random text. It has roots in a piece of classical Latin literature from 45 BC, making
        it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in
        Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum
        passage, and going through the cites of the word in classical literature, discovered the
        undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus
        Bonorum et Malorum (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is
        a treatise on the theory of ethics, very popular during the Renaissance. The first line of
        Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in section 1.10.32. The standard
        chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested. Sections
        1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum by Cicero are also reproduced in
        their exact original form, accompanied by English versions from the 1914 translation by H.
        Rackham. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in
        a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard
        McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the
        more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the
        cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum
        comes from sections 1.10.32{" "}
        <StyledLink id="ref" href="#ref-9">
          [8]
        </StyledLink>{" "}
        and 1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero,
        written in 45 BC. This book is a treatise on the theory of ethics, very popular during the
        Renaissance. The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line
        in section 1.10.32. The standard chunk of Lorem Ipsum used since the 1500s is reproduced
        below for those interested. Sections 1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum
        by Cicero are also reproduced in their exact original form, accompanied by English versions
        from the 1914 translation by H. Rackham. Contrary to popular belief, Lorem Ipsum is not
        simply random text. It has roots in a piece of classical Latin literature from 45 BC, making
        it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in
        Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum
        passage, and going through the cites of the word in classical literature, discovered the
        undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus
        Bonorum et Malorum (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is
        a treatise on the theory of ethics, very popular during the Renaissance. The first line of
        Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in section 1.10.32. The standard
      </p>
      <TextWrapper>
        <details id="reference">
          <summary>{PLACEHOLDER_HEADING}</summary>
          <ul>
            {arr.map(({ id, text }) => (
              <li
                key={id}
                id={id}
                className={css`
                  ${active === id && `background: red;`}
                `}
              >
                {text}
              </li>
            ))}
          </ul>
        </details>
      </TextWrapper>
    </Wrapper>
  )
}

export default Reference
