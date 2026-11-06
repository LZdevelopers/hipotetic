import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'

// Fontes auto-hospedadas (variáveis): sem pedido externo, um arquivo por família.
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/inter'
import './estilos/app.css'

import App from './App'
import { precarregar } from './ferramentas/carregador'
import { normalizarCaminho } from './nucleo/roteador'
import { resolverRota } from './nucleo/rotas'

async function iniciar() {
  const caminho = normalizarCaminho(location.pathname)
  const rota = resolverRota(caminho)
  // A página veio pré-renderizada COM a ferramenta: o código dela precisa
  // estar pronto antes de hidratar, senão o React descartaria o HTML.
  if (rota.tipo === 'ferramenta') await precarregar(rota.ferramenta).catch(() => {})

  const raiz = document.getElementById('raiz')
  const app = (
    <StrictMode>
      <App caminho={caminho} />
    </StrictMode>
  )
  if (raiz.firstElementChild) hydrateRoot(raiz, app)
  else createRoot(raiz).render(app)
}

iniciar()
