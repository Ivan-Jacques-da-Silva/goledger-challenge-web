const DEFAULT_BASE_URL = 'http://ec2-50-19-36-138.compute-1.amazonaws.com/api'
const DEFAULT_USERNAME = 'goledger'
const DEFAULT_PASSWORD = '5NxVCAjC'
const USERNAME_STORAGE_KEY = 'goledger.api.username'
const PASSWORD_STORAGE_KEY = 'goledger.api.password'

/*
  Projeto de avaliação: os defaults de URL/credenciais da API estão definidos no código para facilitar a execução local sem .env.local.
  Em um projeto profissional, essas informações seriam configuradas de forma mais segura (ex.: variáveis de ambiente/secret manager).
*/

function getEnv(name) {
  const value = import.meta.env?.[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeString(value) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function getStored(key) {
  if (typeof window === 'undefined') return undefined
  return normalizeString(window.localStorage.getItem(key))
}

function joinUrl(baseUrl, path) {
  if (!baseUrl) return path
  if (!path) return baseUrl
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

function encodeBasicAuth(username, password) {
  if (!username || !password) return undefined
  return `Basic ${btoa(`${username}:${password}`)}`
}

async function readJsonOrText(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return response.json()
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function createGoLedgerApi({
  baseUrl,
  username,
  password
} = {}) {
  const resolvedBaseUrl = normalizeString(baseUrl) ?? getEnv('VITE_API_BASE_URL') ?? DEFAULT_BASE_URL
  const resolvedUsername = normalizeString(username) ?? getStored(USERNAME_STORAGE_KEY) ?? getEnv('VITE_API_USERNAME') ?? DEFAULT_USERNAME
  const resolvedPassword = normalizeString(password) ?? getStored(PASSWORD_STORAGE_KEY) ?? getEnv('VITE_API_PASSWORD') ?? DEFAULT_PASSWORD
  const authorization = encodeBasicAuth(resolvedUsername, resolvedPassword)

  async function request(path, { method = 'POST', body } = {}) {
    if (!authorization) {
      throw new Error('Credenciais ausentes.')
    }

    const response = await fetch(joinUrl(resolvedBaseUrl, path), {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })

    if (!response.ok) {
      const payload = await readJsonOrText(response)
      const details = typeof payload === 'string' ? payload : JSON.stringify(payload)
      throw new Error(`Erro HTTP ${response.status}: ${details}`)
    }

    return readJsonOrText(response)
  }

  function normalizeSearchItems(payload) {
    if (Array.isArray(payload)) return payload
    if (payload && Array.isArray(payload.result)) return payload.result
    if (payload && Array.isArray(payload.items)) return payload.items
    if (payload && payload.result && Array.isArray(payload.result.items)) return payload.result.items
    if (payload && payload.data && Array.isArray(payload.data)) return payload.data
    return []
  }

  return {
    baseUrl: resolvedBaseUrl,
    getHeader() {
      return request('/query/getHeader', { method: 'GET' })
    },
    getSchema(assetType) {
      if (assetType) return request('/query/getSchema', { method: 'POST', body: { assetType } })
      return request('/query/getSchema', { method: 'POST', body: {} })
    },
    async searchByAssetType(assetType, { limit, bookmark } = {}) {
      const query = {
        selector: { '@assetType': assetType }
      }
      if (typeof limit === 'number') query.limit = limit
      if (typeof bookmark === 'string') query.bookmark = bookmark
      const payload = await request('/query/search', { method: 'POST', body: { query } })
      return normalizeSearchItems(payload)
    },
    request
  }
}
