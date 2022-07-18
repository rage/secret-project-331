/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import NextSectionLink from "../src/components/NextSectionLink"

export default {
  title: "Components/NextSectionLink",
  component: NextSectionLink,
} as Meta

const Component = NextSectionLink

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Table: Story<ComponentProps> = Template.bind({})
Table.args = {
  children: "NextSectionLink",
  title: "Congratulation, you've reached the end of this section",
  subtitle: "Proceed to the next section",
  nextTitle: "Introduction to Calculus",
  url: "/",
  previous: "/",
}
