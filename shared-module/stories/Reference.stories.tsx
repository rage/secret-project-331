/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import { Meta, Story } from "@storybook/react"
import React from "react"

import Reference from "../src/components/Reference"

const data = [
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
    text: "Paappa, R., Ahomäki, R., Löyttyniemi, E. & Aromaa, M. (2020). Significant improvement in treatment outcomes in children and adolescents with type 1 diabetes through the development of diabetes management. Medical Journal Duodecim, 135 (16), 1839–47. Retrieved from https://www.duodecimlehti.fi/lehti/2020/16/duo15740.",
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

const StyledLink = styled.sup`
  text-decoration: underline;

  &:hover {
    cursor: pointer;
  }
`

export default {
  title: "Components/Reference",
  component: Reference,
} as Meta

const Component = Reference

type ComponentProps = React.ComponentProps<typeof Component>

const children = (
  <>
    <h1>What is the meaning of Life</h1>
    <p>
      Contrary to popular belief, Lorem Ipsum is not simply random text.
      <StyledLink id="ref">[1]</StyledLink>
      It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years
      old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up
      one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going
      through the cites of the word in classical literature, discovered the undoubtable source.
      Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus Bonorum et Malorum (The
      Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory
      of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem ipsum
      dolor sit amet., comes from a line in section 1.10.32. The standard chunk of Lorem Ipsum used
      since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33 from de
      Finibus Bonorum et Malorum by Cicero are also reproduced in their exact original form,
      accompanied by English versions from the 1914 translation by H. Rackham. Contrary to popular
      belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin
      literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at
      Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words,
      consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical
      literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32{" "}
      <StyledLink id="ref">[2]</StyledLink>
      and 1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero,
      written in 45 BC. This book is a treatise on the theory of ethics, very popular during the
      Renaissance. The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in
      section 1.10.32. The standard chunk of Lorem Ipsum used since the 1500s is reproduced below
      for those interested. Sections 1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum by
      Cicero are also reproduced in their exact original form, accompanied by English versions from
      the 1914 translation by H. Rackham. Contrary to popular belief, Lorem Ipsum is not simply
      random text. It has roots in a piece of classical Latin literature from 45 BC, making it over
      2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia,
      looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and
      going through the cites of the word in classical literature, discovered the undoubtable
      source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus Bonorum et Malorum
      (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the
      theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem
      ipsum dolor sit amet., comes from a line in section 1.10.32. The standard chunk of Lorem Ipsum
      used since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33
      from de Finibus Bonorum et Malorum by Cicero are also reproduced in their exact original form,
      accompanied by English versions from the 1914 translation by H. Rackham. Contrary to popular
      belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin
      literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at
      Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words,
      consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical
      literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32{" "}
      <StyledLink id="ref">[3]</StyledLink>
      and 1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero,
      written in 45 BC. This book is a treatise on the theory of ethics, very popular during the
      Renaissance. The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in
      section 1.10.32. The standard chunk of Lorem Ipsum used since the 1500s is reproduced below
      for those interested. Sections 1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum by
      Cicero are also reproduced in their exact original form, accompanied by English versions from
      the 1914 translation by H. Rackham. Contrary to popular belief, Lorem Ipsum is not simply
      random text. It has roots in a piece of classical Latin literature from 45 BC, making it over
      2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia,
      looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and
      going through the cites of the word in classical literature, discovered the undoubtable
      source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus Bonorum et Malorum
      (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the
      theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem
      ipsum dolor sit amet., comes from a line in section 1.10.32. The standard
    </p>
    <h1>Why does spongebob have a square pant?</h1>
    <p>
      Contrary to popular belief, Lorem Ipsum is not simply random text.
      <StyledLink id="ref">[3]</StyledLink>
      It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years
      old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up
      one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going
      through the cites of the word in classical literature, discovered the undoubtable source.
      Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus Bonorum et Malorum (The
      Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory
      of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem ipsum
      dolor sit amet., comes from a line in section 1.10.32. The standard chunk of Lorem Ipsum used
      since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33 from de
      Finibus Bonorum et Malorum by Cicero are also reproduced in their exact original form,
      accompanied by English versions from the 1914 translation by H. Rackham. Contrary to popular
      belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin
      literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at
      Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words,
      consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical
      literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32{" "}
      <StyledLink id="ref">[4]</StyledLink>
      and 1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero,
      written in 45 BC. This book is a treatise on the theory of ethics, very popular during the
      Renaissance. The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in
      section 1.10.32. The standard chunk of Lorem Ipsum used since the 1500s is reproduced below
      for those interested. Sections 1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum by
      Cicero are also reproduced in their exact original form, accompanied by English versions from
      the 1914 translation by H. Rackham. Contrary to popular belief, Lorem Ipsum is not simply
      random text. It has roots in a piece of classical Latin literature from 45 BC, making it over
      2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia,
      looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and
      going through the cites of the word in classical literature, discovered the undoubtable
      source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus Bonorum et Malorum
      (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the
      theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem
      ipsum dolor sit amet., comes from a line in section 1.10.32. The standard chunk of Lorem Ipsum
      used since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33
      from de Finibus Bonorum et Malorum by Cicero are also reproduced in their exact original form,
      accompanied by English versions from the 1914 translation by H. Rackham. Contrary to popular
      belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin
      literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at
      Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words,
      consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical
      literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32{" "}
      <StyledLink id="ref">[5]</StyledLink> and 1.10.33 of de Finibus Bonorum et Malorum (The
      Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory
      of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem ipsum
      dolor sit amet., comes from a line in section 1.10.32. The standard chunk of Lorem Ipsum used
      since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33 from de
      Finibus Bonorum et Malorum by Cicero are also reproduced in their exact original form,
      accompanied by English versions from the 1914 translation by H. Rackham. Contrary to popular
      belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin
      literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at
      Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words,
      consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical
      literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and
      1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero, written in
      45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance.
      The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in section
      1.10.32. The standard
    </p>
    <h1>Who is a project manager?</h1>
    <p>
      Contrary to popular belief, Lorem Ipsum is not simply random text.
      <StyledLink id="ref">[6]</StyledLink>
      It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years
      old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up
      one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going
      through the cites of the word in classical literature, discovered the undoubtable source.
      Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus Bonorum et Malorum (The
      Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory
      of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem ipsum
      dolor sit amet., comes from a line in section 1.10.32. The standard chunk of Lorem Ipsum used
      since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33 from de
      Finibus Bonorum et Malorum by Cicero are also reproduced in their exact original form,
      accompanied by English versions from the 1914 translation by H. Rackham. Contrary to popular
      belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin
      literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at
      Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words,
      consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical
      literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32{" "}
      <StyledLink id="ref">[7]</StyledLink>
      and 1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero,
      written in 45 BC. This book is a treatise on the theory of ethics, very popular during the
      Renaissance. The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in
      section 1.10.32. The standard chunk of Lorem Ipsum used since the 1500s is reproduced below
      for those interested. Sections 1.10.32 and 1.10.33 from de Finibus Bonorum et Malorum by
      Cicero are also reproduced in their exact original form, accompanied by English versions from
      the 1914 translation by H. Rackham. Contrary to popular belief, Lorem Ipsum is not simply
      random text. It has roots in a piece of classical Latin literature from 45 BC, making it over
      2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia,
      looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and
      going through the cites of the word in classical literature, discovered the undoubtable
      source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of de Finibus Bonorum et Malorum
      (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the
      theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem
      ipsum dolor sit amet., comes from a line in section 1.10.32. The standard chunk of Lorem Ipsum
      used since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33
      from de Finibus Bonorum et Malorum by Cicero are also reproduced in their exact original form,
      accompanied by English versions from the 1914 translation by H. Rackham. Contrary to popular
      belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin
      literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at
      Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words,
      consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical
      literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32{" "}
      <StyledLink id="ref">[8]</StyledLink> and 1.10.33 of de Finibus Bonorum et Malorum (The
      Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory
      of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, Lorem ipsum
      dolor sit amet., comes from a line in section 1.10.32. The standard chunk of Lorem Ipsum used
      since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33 from de
      Finibus Bonorum et Malorum by Cicero are also reproduced in their exact original form,
      accompanied by English versions from the 1914 translation by H. Rackham. Contrary to popular
      belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin
      literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at
      Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words,
      consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical
      literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and
      1.10.33 of de Finibus Bonorum et Malorum (The Extremes of Good and Evil) by Cicero, written in
      45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance.
      The first line of Lorem Ipsum, Lorem ipsum dolor sit amet., comes from a line in section
      1.10.32. The standard
    </p>
  </>
)

const Template: Story<ComponentProps> = (args: ComponentProps) => (
  <div>
    {children}
    <Component {...args} data={data} />
  </div>
)

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "Reference",
}
