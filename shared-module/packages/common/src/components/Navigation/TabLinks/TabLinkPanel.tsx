const TabLinkPanel: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div role={"tabpanel"} tabIndex={0}>
      {children}
    </div>
  )
}

export default TabLinkPanel
