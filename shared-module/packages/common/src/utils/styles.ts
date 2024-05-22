// Allows you to easily pass multiple classnames to a component
export const withMultipleClassNames = (classNames: string[]): string => {
  return classNames.join(" ")
}
