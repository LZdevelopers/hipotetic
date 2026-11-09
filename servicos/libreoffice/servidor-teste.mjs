// Servidor HTTP mínimo que chama o handler da função como a Vercel chamaria.
import { createServer } from 'node:http'
import handler from './api/documentos/converter.js'

createServer((req, res) => handler(req, res)).listen(8090, () => console.log('ensaio: ouvindo na porta 8090'))
