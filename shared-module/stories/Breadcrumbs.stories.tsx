/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Breadcrumbs from "../src/components/BreadCrumbs"

export default {
  title: "Components/Breadcrumbs",
  component: Breadcrumbs,
} as Meta

const Component = Breadcrumbs

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Simple: Story<ComponentProps> = Template.bind({})
Simple.args = {
  children: "Breadcrumbs",
}
