import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import UniEmensPriv from './UniEmensPriv.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UniEmensPriv />
  </StrictMode>
)
