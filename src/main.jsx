import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fontes self-hosted variáveis: sem request externo, sem CLS, um arquivo por família
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/inter'

import './styles/index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
