/* eslint-disable i18next/no-literal-string */
import { css, keyframes } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useEffect, useState } from "react"

import { baseTheme } from "../styles"

const arr = [
  {
    id: "ref-1",
    text: "Juntunen, Marja-Leena & Kivijärvi, Sanna. (2019). Opetuksen saavutettavuuden lisääminen taiteen perusopetusta antavissa toksissa. The Finnish Journal of Music Education, 22(1–2), 70–87.",
  },
  {
    id: "ref-2",
    text: "Kokkonen, H. (2020). Recycling should be easy! Factors affecting the sorting of household waste: Region and Environment, 49 (2), 110-129 https://doi.org/10.30663/ay.88321",
  },
  {
    id: "ref-3",
    text: "Lagström, H., Luoto, S., Mäkelä, J., Iirola, J., & Kunttu, K. (2017). Factors associated with a health-promoting diet in college students. Social Medicine Magazine, 54 (2), 104–120. https://doi.org/10.23990/sa.63652.",
  },
  {
    id: "ref-4",
    text: "Lilja, N., Laakkonen, R., Sariola, L. & Tapaninen, T. (2020). The bodily representations of experience: The interaction of the social circus in supporting the use and learning of language. AFinLA-e Studies in Applied Linguistics, 32–56. https://doi.org/10.30660/afinla.84314",
  },
  {
    id: "ref-5",
    text: "Myllykoski, TJ, Mattila, P., Ali-Löytty, S., Kaarakka, T., & Estonia, E. (2018). Development of Electronic Problems and Mathematical Thinking in University Mathematics. FMSERA Journal, 2 (1), 46-55. Retrieved from https://journal.fi/fmsera/article/view/69887.",
  },
  {
    id: "ref-6",
    text: "Paappa, R., Ahomäki, R., Löyttyniemi, E. & Aromaa, M. (2020). Significant improvement in treatment outcomes in children and adolescents with type 1 diabetes through the development of diabetes management. Medical Journal Duodecim, 135 (16), 1839–47. Retrieved from https://www.duodecimlehti.fi/lehti/2020/16/duo15740.",
  },
  {
    id: "ref-7",
    text: "Räihä, P., Mankki, V. & Samppala, K. (2019). The significance of written feedback for a university student. University Pedagogy, 26 (2), 8–22. Retrieved from https://lehti.yliopistopedagogiikka.fi/2019/08/12/kirjallisen-palautteen-merkitys/.",
  },
  {
    id: "ref-8",
    text: "Tuononen, T., Kangas, T., Carver, E. & Parpala, A. (2019). University studies five years after graduation - Did the university studies support the development of working life skills from a career perspective? University Pedagogy, 26 (1), 8–19. Retrieved from https://lehti.yliopistopedagogiikka.fi/2019/02/08/yliopisto-opinnan-anti-tyoelamataitojen-kehittlemine/.",
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
    border-left: 4px solid #90abc3;
  }

  details[open] > div {
    animation-name: ${slideDown};
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
  }

  details summary {
    padding: 1.4rem 1rem 1.4rem 3.5rem;
    position: relative;
    cursor: pointer;
    font-size: 1.8rem;
    font-weight: 400;
    font-family: "Josefin Sans", sans-serif;
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
    color: #6b8faf;
    position: absolute;
    font-size: 3rem;
    line-height: 0.3;
    margin-top: 0.75rem;
    left: 20px;
    font-weight: 200;
    transform-origin: center;
    transition: all 200ms linear;
  }
  details[open] summary:after {
    transform: rotate(45deg);
    font-size: 3rem;
  }

  ul {
    padding: 0 4.5rem 3rem 4.5rem;
    counter-reset: ref;
  }

  details ul li {
    counter-increment: ref;
    font-size: 1.2rem;
    line-height: 1.6;
    margin: 1rem 0 1rem 0.2rem;
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

export type ReferenceProps = React.HTMLAttributes<HTMLDivElement>

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

  useEffect(() => {
    const eventHandler = (evt: MouseEvent) => {
      const target = evt.target as HTMLInputElement
      if (reference) {
        reference.forEach(({ text }) => {
          if (text === target.innerText) {
            evt.preventDefault()
            let elementId = target.innerText
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
      <br />
      <br />
      <br />
      <br />
      <TextWrapper>
        <details id="reference">
          <summary>{PLACEHOLDER_HEADING}</summary>
          <ul>
            {arr.map(({ id, text }) => (
              <li
                key={id}
                id={id}
                className={css`
                  ${active === id && `background: #DAE3EB;`}
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
