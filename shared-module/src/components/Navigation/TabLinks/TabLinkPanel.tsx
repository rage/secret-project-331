const TabLinkPanel: React.FC = ({ children }) => {
  return (
    <div role={"tabpanel"} tabIndex={0}>
      {children}
    </div>
  )
}

export default TabLinkPanel
