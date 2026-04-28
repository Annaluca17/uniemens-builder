import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import UniEmensBuilder from './UniEmensBuilder.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UniEmensBuilder />
  </StrictMode>
)
