import { Meta, Story } from "@storybook/react"
import React from "react"

import HeroSection from "../src/components/HeroSection"

export default {
  title: "Components/HeroSection",
  component: HeroSection,
} as Meta

const Component = HeroSection

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "HeroSection",
  title: "Introduction to Calculus",
  subTitle: "Everything you need to know",
}
