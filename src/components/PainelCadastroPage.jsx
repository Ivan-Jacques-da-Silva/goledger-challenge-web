import { cloneElement, isValidElement, useEffect, useId, useMemo, useState } from 'react'
import { createGoLedgerApi } from '../api/goledgerApi.js'
import { createPortal } from 'react-dom'
import arrowClockwiseIcon from 'bootstrap-icons/icons/arrow-clockwise.svg?raw'
import clockHistoryIcon from 'bootstrap-icons/icons/clock-history.svg?raw'
import eyeIcon from 'bootstrap-icons/icons/eye.svg?raw'
import pencilSquareIcon from 'bootstrap-icons/icons/pencil-square.svg?raw'
import plusLgIcon from 'bootstrap-icons/icons/plus-lg.svg?raw'
import searchIcon from 'bootstrap-icons/icons/search.svg?raw'
import trash3Icon from 'bootstrap-icons/icons/trash3.svg?raw'

const PANEL_USERNAME = 'goledger'
const PANEL_PASSWORD = '5NxVCAjC'
const PANEL_CHANNEL_NAME = 'mainchannel'
const PANEL_CHAINCODE_NAME = 'streaming-cc'
const PANEL_PAGE_SIZE = 10

/*
  Projeto de avaliação: as credenciais padrão da API ficam no código para evitar dependência de .env.local.
  Em um projeto profissional, isso seria configurado de forma mais segura.
*/
const DEFAULT_TMDB_MODE = 'bearer'
const DEFAULT_TMDB_READ_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1NTkwMjE5NzcyZjdlYzllMjFhY2YwMWRmOGMyODFhYiIsIm5iZiI6MTY5OTI5MzAyMi43NzQwMDAyLCJzdWIiOiI2NTQ5Mjc1ZTkyNGNlNjAxMDFmNTdjOTUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.CCWFHTD46mSdJMVTVn7e8uwlZ2k63rw-bHypNBaMucc'
const DEFAULT_TMDB_LANG = 'pt-BR'

const ASSET_TYPE_OPTIONS = [
  { value: 'tvShows', label: 'Séries' },
  { value: 'seasons', label: 'Temporadas' },
  { value: 'episodes', label: 'Episódios' },
  { value: 'watchlist', label: 'Minha lista' }
]

const CREATE_ASSET_TYPE_OPTIONS = ASSET_TYPE_OPTIONS

const SCHEMA_ASSET_TYPE_OPTIONS = [
  ...ASSET_TYPE_OPTIONS,
  { value: 'assetTypeListData', label: 'Tipos de ativo' }
]

function getEnv(name) {
  const value = import.meta.env?.[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function pickFirstString(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function readTmdbConfig() {
  function getStored(key) {
    if (typeof window === 'undefined') return undefined
    const value = window.localStorage.getItem(key)
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  const envToken = getEnv('VITE_TMDB_READ_TOKEN') ?? DEFAULT_TMDB_READ_TOKEN
  const envApiKey = getEnv('VITE_TMDB_API_KEY')
  const envLang = getEnv('VITE_TMDB_LANG') ?? DEFAULT_TMDB_LANG
  const envMode = getEnv('VITE_TMDB_AUTH_MODE') ?? DEFAULT_TMDB_MODE

  const storedMode = getStored('tmdb.auth.mode')
  const storedToken = getStored('tmdb.auth.token')
  const storedApiKey = getStored('tmdb.auth.key')
  const storedLang = getStored('tmdb.lang')

  return {
    mode: storedMode ?? envMode,
    token: storedToken ?? envToken,
    apiKey: storedApiKey ?? envApiKey,
    lang: storedLang ?? envLang
  }
}

function buildTmdbImageUrl(path, size = 'w1280') {
  if (!path) return ''
  return `https://image.tmdb.org/t/p/${size}${path}`
}

function formatDateTime(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function getAssetTypeLabel(assetType) {
  const option = SCHEMA_ASSET_TYPE_OPTIONS.find((item) => item.value === assetType)
  return option?.label ?? assetType ?? 'Cadastro'
}

function getFriendlyActionName(value) {
  if (value === 'createAsset') return 'Cadastro criado'
  if (value === 'updateAsset') return 'Cadastro atualizado'
  if (value === 'deleteAsset') return 'Cadastro removido'
  return ''
}

function formatCount(count, singular, plural) {
  const safeCount = Number.isFinite(Number(count)) ? Number(count) : 0
  const label = safeCount === 1 ? singular : plural ?? `${singular}s`
  return `${safeCount} ${label}`
}

function getCatalogMetricValue(status, count) {
  if (status === 'loading') return '...'
  if (status === 'error') return 'erro'
  if (status !== 'success') return '--'
  return String(count)
}

function getVisiblePageNumbers(totalPages, currentPage) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) return [1, 2, 3, 4, totalPages]
  if (currentPage >= totalPages - 2) return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, currentPage - 1, currentPage, currentPage + 1, totalPages]
}

function buildFriendlyFields(item) {
  if (!item || typeof item !== 'object') return []

  const assetType = pickFirstString(item, ['@assetType'])
  const fields = []
  const title = pickFirstString(item, ['title', 'name'])
  const description = pickFirstString(item, ['description'])
  const updatedAt = formatDateTime(pickFirstString(item, ['@lastUpdated', 'timestamp']))
  const action = getFriendlyActionName(pickFirstString(item, ['@lastTx']))

  if (assetType) fields.push({ label: 'Tipo', value: getAssetTypeLabel(assetType) })
  if (title) fields.push({ label: 'Nome', value: title })

  if (assetType === 'tvShows' && item?.recommendedAge !== undefined && item?.recommendedAge !== null) {
    fields.push({ label: 'Idade recomendada', value: `${String(item.recommendedAge)}+` })
  }

  if (assetType === 'seasons') {
    if (item?.number !== undefined && item?.number !== null) {
      fields.push({ label: 'Temporada', value: String(item.number) })
    }
    if (item?.year !== undefined && item?.year !== null) {
      fields.push({ label: 'Ano', value: String(item.year) })
    }
  }

  if (assetType === 'episodes') {
    if (item?.episodeNumber !== undefined && item?.episodeNumber !== null) {
      fields.push({ label: 'Episódio', value: String(item.episodeNumber) })
    }
    if (item?.rating !== undefined && item?.rating !== null) {
      fields.push({ label: 'Nota', value: String(item.rating) })
    }
    const releaseDate = formatDateTime(pickFirstString(item, ['releaseDate']))
    if (releaseDate) fields.push({ label: 'Lançamento', value: releaseDate })
  }

  if (assetType === 'watchlist') {
    const linkedCount = Array.isArray(item?.tvShows) ? item.tvShows.length : 0
    if (linkedCount > 0) fields.push({ label: 'Séries vinculadas', value: String(linkedCount) })
  }

  if (updatedAt) fields.push({ label: 'Atualizado em', value: updatedAt })
  if (action) fields.push({ label: 'Última ação', value: action })
  if (item?.isDelete === true) fields.push({ label: 'Situação', value: 'Removido' })

  if (description) fields.push({ label: 'Descrição', value: description, wide: true })
  return fields
}

function FriendlyResult({ value, variant = 'default', showHeader = true, showTechnicalData = false, suppressItemTitle = false }) {
  if (value === undefined) return null

  const items = Array.isArray(value) ? value : [value]
  const normalizedItems = items.filter((item) => item !== undefined && item !== null)
  const hasObjectItems = normalizedItems.some((item) => item && typeof item === 'object' && !Array.isArray(item))
  const isModalVariant = variant === 'modal'

  if (!hasObjectItems) {
    return (
      <div className={`resultView${isModalVariant ? ' resultView--modal' : ''}`}>
        {showHeader ? (
          <div className="resultView__header">
            <div className="fw-semibold">Resultado</div>
          </div>
        ) : null}
        <pre className="code">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>
      </div>
    )
  }

  return (
    <div className={`resultView${isModalVariant ? ' resultView--modal' : ''}`}>
      {showHeader ? (
        <div className="resultView__header">
          <div className="fw-semibold">
            {Array.isArray(value) ? `${normalizedItems.length} registro(s)` : 'Resultado encontrado'}
          </div>
        </div>
      ) : null}

      <div className="resultView__list">
        {normalizedItems.map((item, index) => {
          const fields = buildFriendlyFields(item)
          const title = pickFirstString(item, ['title', 'name']) || `Registro ${index + 1}`
          const action = getFriendlyActionName(pickFirstString(item, ['@lastTx']))
          const updatedAt = formatDateTime(pickFirstString(item, ['@lastUpdated', 'timestamp']))
          const assetType = pickFirstString(item, ['@assetType'])
          const showItemTitle = !(suppressItemTitle && normalizedItems.length === 1)
          const visibleFields = fields.filter((field) => field.label !== 'Nome' && field.label !== 'Tipo' && field.label !== 'Atualizado em' && field.label !== 'Última ação')
          const contentFields = visibleFields.filter((field) => !String(field.label ?? '').toLowerCase().includes('ltima'))

          return (
            <div key={`${getItemKey(item) || title}-${index}`} className={`resultCard${isModalVariant ? ' resultCard--modal' : ''}`}>
              <div className="resultCard__top">
                <div className="min-w-0">
                  {showItemTitle ? <div className="resultCard__title text-truncate">{title}</div> : null}
                  <div className="resultCard__subtitle">{getAssetTypeLabel(assetType)}</div>
                </div>
                {action ? <span className="pill">{action}</span> : null}
              </div>

              {updatedAt ? <div className="resultCard__meta">Atualizado em {updatedAt}</div> : null}

              <div className={`resultCard__fields${isModalVariant ? ' resultCard__fields--modal' : ''}`}>
                {contentFields.map((field) => (
                    <div key={`${field.label}-${field.value}`} className={`resultField${field.wide ? ' resultField--wide' : ''}${isModalVariant ? ' resultField--modal' : ''}`}>
                      <div className="resultField__label">{field.label}</div>
                      <div className="resultField__value">{field.value}</div>
                    </div>
                  ))}
              </div>
            </div>
          )
        })}
      </div>

      {showTechnicalData ? (
        <details className="details">
          <summary className="details__summary">Ver dados técnicos</summary>
          <pre className="code">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  )
}

function Row({ label, children, controlId }) {
  const generatedId = useId()
  const inputId = controlId ?? generatedId
  const shouldClone =
    isValidElement(children) &&
    (typeof children.type === 'string' ? ['input', 'select', 'textarea'].includes(children.type) : false)

  const resolvedChildren =
    shouldClone && !children.props.id
      ? cloneElement(children, { id: inputId })
      : children

  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={shouldClone ? (children.props.id ?? inputId) : undefined}>
        {label}
      </label>
      {resolvedChildren}
    </div>
  )
}

const BI_ICON_SVGS = {
  'arrow-clockwise': arrowClockwiseIcon,
  'clock-history': clockHistoryIcon,
  eye: eyeIcon,
  'pencil-square': pencilSquareIcon,
  'plus-lg': plusLgIcon,
  search: searchIcon,
  trash3: trash3Icon
}

function BiIcon({ name, className, ariaHidden = true }) {
  const svg = BI_ICON_SVGS[name]
  if (!svg) return null
  return <span className={className} aria-hidden={ariaHidden} dangerouslySetInnerHTML={{ __html: svg }} />
}

function IconActionButton({ iconName, label, tone = 'secondary', onClick, disabled = false }) {
  const toneClass =
    tone === 'danger'
      ? ' managerActionBtn--danger'
      : tone === 'primary'
        ? ' managerActionBtn--primary'
        : ''
  return (
    <button type="button" className={`managerActionBtn${toneClass}`} onClick={onClick} title={label} aria-label={label} disabled={disabled}>
      <BiIcon name={iconName} />
    </button>
  )
}

function useEndpointState() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState(undefined)

  function reset() {
    setStatus('idle')
    setError('')
    setResult(undefined)
  }

  function start() {
    setStatus('loading')
    setError('')
    setResult(undefined)
  }

  function fail(message) {
    setStatus('error')
    setError(message)
  }

  function succeed(payload) {
    setStatus('success')
    setResult(payload)
  }

  return { status, error, result, reset, start, fail, succeed }
}

function getItemRefKey(value) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object') {
    const key = value['@key'] ?? value.key ?? value.id ?? value._id
    return typeof key === 'string' && key.trim() ? key.trim() : undefined
  }
  return undefined
}

function getItemKey(item) {
  const key = item?.['@key'] ?? item?.key ?? item?.id ?? item?._id
  return typeof key === 'string' && key.trim() ? key.trim() : ''
}

function upsertItemsByKey(existingItems, incomingItems) {
  const safeExisting = Array.isArray(existingItems) ? existingItems : []
  const safeIncoming = Array.isArray(incomingItems) ? incomingItems : []
  const withoutKey = []
  const map = new Map()

  for (const item of safeExisting) {
    const key = getItemKey(item)
    if (!key) {
      withoutKey.push(item)
      continue
    }
    map.set(key, item)
  }

  for (const item of safeIncoming) {
    const key = getItemKey(item)
    if (!key) {
      withoutKey.push(item)
      continue
    }
    map.set(key, item)
  }

  return [...map.values(), ...withoutKey]
}

function removeItemsByKey(existingItems, keysToRemove) {
  const safeExisting = Array.isArray(existingItems) ? existingItems : []
  const safeKeys = Array.isArray(keysToRemove) ? keysToRemove.filter(Boolean) : []
  if (!safeKeys.length) return safeExisting
  const keySet = new Set(safeKeys)
  return safeExisting.filter((item) => {
    const key = getItemKey(item)
    return !key || !keySet.has(key)
  })
}

async function runTasksWithConcurrencyLimit(taskFns, limit = 6) {
  const safeTasks = Array.isArray(taskFns) ? taskFns.filter((fn) => typeof fn === 'function') : []
  if (!safeTasks.length) return
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 1))
  if (safeLimit <= 1 || safeTasks.length === 1) {
    for (const task of safeTasks) {
      await task()
    }
    return
  }

  let nextIndex = 0
  const workerCount = Math.min(safeLimit, safeTasks.length)
  const workers = Array.from({ length: workerCount }, () =>
    (async () => {
      while (nextIndex < safeTasks.length) {
        const index = nextIndex
        nextIndex += 1
        await safeTasks[index]()
      }
    })()
  )
  await Promise.all(workers)
}

function toNumberOrUndefined(value) {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function toIsoDate(dateText) {
  if (!dateText) return ''
  return `${dateText}T00:00:00Z`
}

function formatIsoDateForInput(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  return value.includes('T') ? value.slice(0, 10) : value
}

function normalizeSearchItems(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.result)) return payload.result
  if (payload && Array.isArray(payload.items)) return payload.items
  if (payload && payload.result && Array.isArray(payload.result.items)) return payload.result.items
  if (payload && payload.data && Array.isArray(payload.data)) return payload.data
  return []
}

function getEmptyEpisodeDraft() {
  return { episodeNumber: '1', title: '', releaseDate: '', description: '', rating: '' }
}

function getEmptySeasonDraft() {
  return {
    number: '1',
    year: String(new Date().getFullYear()),
    episodes: []
  }
}

function getEmptyForm(assetType) {
  if (assetType === 'tvShows') return { title: '', recommendedAge: '', description: '', seasons: [] }
  if (assetType === 'seasons') return { tvShowKey: '', number: '1', year: String(new Date().getFullYear()) }
  if (assetType === 'episodes') return { seasonKey: '', episodeNumber: '1', title: '', releaseDate: '', description: '', rating: '' }
  if (assetType === 'watchlist') return { title: '', description: '', tvShowKeys: [] }
  return { title: '', description: '' }
}

function getSearchFilters(assetType) {
  if (assetType === 'tvShows') return { title: '' }
  if (assetType === 'seasons') return { tvShowKey: '', number: '' }
  if (assetType === 'episodes') return { seasonKey: '', episodeNumber: '', title: '' }
  if (assetType === 'watchlist') return { title: '' }
  return { title: '' }
}

function buildFormFromItem(assetType, item) {
  if (!item || typeof item !== 'object') return getEmptyForm(assetType)
  if (assetType === 'tvShows') {
    return {
      title: typeof item.title === 'string' ? item.title : '',
      recommendedAge: item.recommendedAge === undefined || item.recommendedAge === null ? '' : String(item.recommendedAge),
      description: typeof item.description === 'string' ? item.description : '',
      seasons: []
    }
  }
  if (assetType === 'seasons') {
    return {
      tvShowKey: getItemRefKey(item.tvShow) ?? '',
      number: item.number === undefined || item.number === null ? '' : String(item.number),
      year: item.year === undefined || item.year === null ? '' : String(item.year),
      episodes: []
    }
  }
  if (assetType === 'episodes') {
    return {
      seasonKey: getItemRefKey(item.season) ?? '',
      episodeNumber: item.episodeNumber === undefined || item.episodeNumber === null ? '' : String(item.episodeNumber),
      title: typeof item.title === 'string' ? item.title : '',
      releaseDate: formatIsoDateForInput(item.releaseDate),
      description: typeof item.description === 'string' ? item.description : '',
      rating: item.rating === undefined || item.rating === null ? '' : String(item.rating)
    }
  }
  if (assetType === 'watchlist') {
    return {
      title: typeof item.title === 'string' ? item.title : '',
      description: typeof item.description === 'string' ? item.description : '',
      tvShowKeys: Array.isArray(item.tvShows)
        ? item.tvShows.map((entry) => getItemRefKey(entry)).filter(Boolean)
        : []
    }
  }
  return {
    title: typeof item.title === 'string' ? item.title : '',
    description: typeof item.description === 'string' ? item.description : ''
  }
}

function getTvShowLabel(item) {
  return typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : getItemKey(item)
}

function getSeasonLabel(item, tvShowLabelsByKey) {
  const tvShowKey = getItemRefKey(item?.tvShow)
  const tvShowLabel = tvShowKey ? tvShowLabelsByKey[tvShowKey] ?? 'Série' : 'Série'
  const number = item?.number === undefined || item?.number === null ? '?' : item.number
  return `${tvShowLabel} • Temporada ${number}`
}

function getItemLabel(assetType, item, tvShowLabelsByKey, seasonLabelsByKey) {
  if (assetType === 'tvShows') return getTvShowLabel(item)
  if (assetType === 'seasons') return getSeasonLabel(item, tvShowLabelsByKey)
  if (assetType === 'episodes') {
    const seasonKey = getItemRefKey(item?.season)
    const seasonLabel = seasonKey ? seasonLabelsByKey[seasonKey] ?? 'Temporada' : 'Temporada'
    const episodeNumber = item?.episodeNumber === undefined || item?.episodeNumber === null ? '?' : item.episodeNumber
    const title = typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : `Episódio ${episodeNumber}`
    return `${seasonLabel} • Ep ${episodeNumber} • ${title}`
  }
  if (assetType === 'watchlist') {
    const title = typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : 'Minha lista'
    const linkedCount = Array.isArray(item?.tvShows) ? item.tvShows.length : 0
    return linkedCount > 0 ? `${title} • ${formatCount(linkedCount, 'série')}` : title
  }
  return typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : getItemKey(item)
}

function getItemMeta(assetType, item, tvShowLabelsByKey, seasonLabelsByKey, statsByKey = {}) {
  if (!item || typeof item !== 'object') return ''
  if (assetType === 'tvShows') {
    const tvShowKey = getItemKey(item)
    const parts = []
    const seasonCount = Number(statsByKey.seasonCountByTvShowKey?.[tvShowKey] ?? 0)
    const episodeCount = Number(statsByKey.episodeCountByTvShowKey?.[tvShowKey] ?? 0)
    parts.push(formatCount(seasonCount, 'temporada'))
    if (episodeCount > 0) parts.push(formatCount(episodeCount, 'episódio'))
    parts.push(item?.recommendedAge === undefined || item?.recommendedAge === null ? 'Serie' : `Idade ${String(item.recommendedAge)}+`)
    return parts.join(' • ')
  }
  if (assetType === 'seasons') {
    const tvShowKey = getItemRefKey(item?.tvShow)
    const tvShowLabel = tvShowKey ? tvShowLabelsByKey[tvShowKey] ?? 'Serie' : 'Serie'
    const parts = [tvShowLabel]
    const seasonKey = getItemKey(item)
    const episodeCount = Number(statsByKey.episodeCountBySeasonKey?.[seasonKey] ?? 0)
    if (episodeCount > 0) parts.push(formatCount(episodeCount, 'episódio'))
    if (item?.year !== undefined && item?.year !== null) parts.push(String(item.year))
    return parts.join(' • ')
    return item?.year === undefined || item?.year === null ? tvShowLabel : `${tvShowLabel} • ${String(item.year)}`
  }
  if (assetType === 'episodes') {
    const seasonKey = getItemRefKey(item?.season)
    const seasonLabel = seasonKey ? seasonLabelsByKey[seasonKey] ?? 'Temporada' : 'Temporada'
    const releaseDate = formatDateTime(pickFirstString(item, ['releaseDate']))
    return releaseDate ? `${seasonLabel} • ${releaseDate}` : seasonLabel
  }
  if (assetType === 'watchlist') {
    const linkedCount = Array.isArray(item?.tvShows) ? item.tvShows.length : 0
    return linkedCount > 0 ? `${formatCount(linkedCount, 'série')} vinculadas` : 'Lista vazia'
  }
  return ''
}

function getItemSearchText(assetType, item, tvShowLabelsByKey, seasonLabelsByKey, statsByKey = {}) {
  return [
    getItemLabel(assetType, item, tvShowLabelsByKey, seasonLabelsByKey),
    getItemKey(item),
    pickFirstString(item, ['description'])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function buildReference(assetType, key) {
  return key ? { '@assetType': assetType, '@key': key } : undefined
}

function buildAssetPayload(assetType, form) {
  if (assetType === 'tvShows') {
    return {
      '@assetType': 'tvShows',
      title: String(form.title ?? '').trim(),
      recommendedAge: toNumberOrUndefined(form.recommendedAge),
      description: String(form.description ?? '').trim()
    }
  }
  if (assetType === 'seasons') {
    return {
      '@assetType': 'seasons',
      number: toNumberOrUndefined(form.number),
      tvShow: buildReference('tvShows', form.tvShowKey),
      year: toNumberOrUndefined(form.year)
    }
  }
  if (assetType === 'episodes') {
    const payload = {
      '@assetType': 'episodes',
      season: buildReference('seasons', form.seasonKey),
      episodeNumber: toNumberOrUndefined(form.episodeNumber),
      title: String(form.title ?? '').trim(),
      releaseDate: toIsoDate(String(form.releaseDate ?? '').trim()),
      description: String(form.description ?? '').trim()
    }
    const rating = toNumberOrUndefined(form.rating)
    if (rating !== undefined) payload.rating = rating
    return payload
  }
  if (assetType === 'watchlist') {
    const payload = {
      '@assetType': 'watchlist',
      title: String(form.title ?? '').trim()
    }
    const description = String(form.description ?? '').trim()
    if (description) payload.description = description
    const tvShows = Array.isArray(form.tvShowKeys)
      ? form.tvShowKeys.map((key) => buildReference('tvShows', key)).filter(Boolean)
      : []
    if (tvShows.length) payload.tvShows = tvShows
    return payload
  }
  return { '@assetType': assetType }
}

function buildUpdatePayload(assetType, form, item) {
  const payload = buildAssetPayload(assetType, form)
  const ledgerKey = getItemKey(item)

  if (ledgerKey) {
    return {
      ...payload,
      '@key': ledgerKey
    }
  }

  const originalKey = buildKeyPayload(assetType, item)
  return {
    ...originalKey,
    ...payload
  }
}

function buildKeyPayload(assetType, formOrItem) {
  if (assetType === 'tvShows') {
    return {
      '@assetType': assetType,
      title: String(formOrItem.title ?? formOrItem.name ?? '').trim()
    }
  }
  if (assetType === 'seasons') {
    return {
      '@assetType': 'seasons',
      number: toNumberOrUndefined(formOrItem.number),
      tvShow: buildReference('tvShows', formOrItem.tvShowKey ?? getItemRefKey(formOrItem.tvShow))
    }
  }
  if (assetType === 'episodes') {
    return {
      '@assetType': 'episodes',
      season: buildReference('seasons', formOrItem.seasonKey ?? getItemRefKey(formOrItem.season)),
      episodeNumber: toNumberOrUndefined(formOrItem.episodeNumber)
    }
  }
  if (assetType === 'watchlist') {
    return {
      '@assetType': 'watchlist',
      title: String(formOrItem.title ?? formOrItem.name ?? '').trim()
    }
  }
  return { '@assetType': assetType }
}

function buildDeleteKeyCandidates(assetType, item) {
  const candidates = []
  const primaryKey = buildKeyPayload(assetType, item)
  const ledgerKey = getItemKey(item)

  if (primaryKey && typeof primaryKey === 'object') candidates.push(primaryKey)
  if (ledgerKey) candidates.push({ '@assetType': assetType, '@key': ledgerKey })

  const unique = new Map()
  for (const candidate of candidates) {
    const signature = JSON.stringify(candidate)
    if (!unique.has(signature)) unique.set(signature, candidate)
  }
  return Array.from(unique.values())
}

function validateAssetPayload(assetType, payload) {
  if (assetType === 'tvShows') {
    if (!payload.title) return 'Informe o nome da série.'
    if (payload.recommendedAge === undefined) return 'Informe a idade recomendada.'
    if (!payload.description) return 'Informe a descrição.'
    return ''
  }
  if (assetType === 'seasons') {
    if (!payload.tvShow?.['@key']) return 'Selecione a série.'
    if (payload.number === undefined) return 'Informe o número da temporada.'
    if (payload.year === undefined) return 'Informe o ano.'
    return ''
  }
  if (assetType === 'episodes') {
    if (!payload.season?.['@key']) return 'Selecione a temporada.'
    if (payload.episodeNumber === undefined) return 'Informe o número do episódio.'
    if (!payload.title) return 'Informe o título do episódio.'
    if (!payload.releaseDate) return 'Informe a data de lançamento.'
    if (!payload.description) return 'Informe a descrição.'
    return ''
  }
  if (assetType === 'watchlist') {
    if (!payload.title) return 'Informe o nome da lista.'
    return ''
  }
  return ''
}

function validateKeyPayload(assetType, key) {
  if (typeof key?.['@key'] === 'string' && key['@key'].trim()) return ''
  if (assetType === 'tvShows') {
    if (!key.title) return 'Selecione um item válido.'
    return ''
  }
  if (assetType === 'seasons') {
    if (!key.tvShow?.['@key'] || key.number === undefined) return 'Selecione uma temporada válida.'
    return ''
  }
  if (assetType === 'watchlist') {
    if (!key.title) return 'Selecione uma lista válida.'
    return ''
  }
  if (!key.season?.['@key'] || key.episodeNumber === undefined) return 'Selecione um episódio válido.'
  return ''
}

function toggleSelection(values, target) {
  if (!target) return values
  return values.includes(target) ? values.filter((value) => value !== target) : [...values, target]
}

function ChoiceChecklist({ options, selectedValues, onToggle, emptyText = 'Nenhuma opção disponível.' }) {
  if (!Array.isArray(options) || options.length === 0) {
    return <div className="emptyState">{emptyText}</div>
  }

  return (
    <div className="choiceGrid">
      {options.map((option) => (
        <label key={option.value} className="choiceItem">
          <input
            type="checkbox"
            checked={selectedValues.includes(option.value)}
            onChange={() => onToggle(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}

function FieldHint({ children }) {
  return <div className="form-text">{children}</div>
}

function ToastHost({ toasts, onClose }) {
  if (!Array.isArray(toasts) || toasts.length === 0) return null
  return (
    <div className="toast-container position-fixed end-0 p-3 appToastHost" role="region" aria-label="Notificações">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast show align-items-center text-bg-${toast.type === 'error' ? 'danger' : 'success'} border-0`}
          role="status"
        >
          <div className="d-flex">
            <div className="toast-body">
              <div className="fw-semibold">{toast.title}</div>
              <div className="small opacity-75">{toast.message}</div>
            </div>
            <button
              type="button"
              className="appToast__close me-2 m-auto"
              onClick={() => onClose(toast.id)}
              aria-label="Fechar"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ModalShell({ title, size = 'lg', children, footer, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="appModal" tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
      <div className={`appModal__dialog appModal__dialog--${size}`} role="document" onMouseDown={(e) => e.stopPropagation()}>
        <div className="appModal__panel">
          <div className="appModal__header">
            <h5 className="appModal__title">{title}</h5>
            <button type="button" className="btn-close btn-close-white" aria-label="Fechar" onClick={onClose} />
          </div>
          <div className="appModal__body">{children}</div>
          {footer ? <div className="appModal__footer">{footer}</div> : null}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function PainelCadastroPage() {
  const username = getEnv('VITE_API_USERNAME') ?? PANEL_USERNAME
  const password = getEnv('VITE_API_PASSWORD') ?? PANEL_PASSWORD

  const [useScopedRoutes, setUseScopedRoutes] = useState(true)
  const [channelName, setChannelName] = useState(PANEL_CHANNEL_NAME)
  const [chaincodeName, setChaincodeName] = useState(PANEL_CHAINCODE_NAME)

  const api = useMemo(() => createGoLedgerApi({ username, password }), [username, password])

  const [catalogStatus, setCatalogStatus] = useState('idle')
  const [catalogError, setCatalogError] = useState('')
  const [catalog, setCatalog] = useState({
    tvShows: [],
    seasons: [],
    episodes: [],
    watchlist: []
  })

  const createTvShowState = useEndpointState()
  const createSeasonState = useEndpointState()
  const createEpisodeState = useEndpointState()
  const createWatchlistState = useEndpointState()
  const searchState = useEndpointState()
  const readAssetState = useEndpointState()
  const readHistoryState = useEndpointState()
  const updateAssetState = useEndpointState()
  const deleteAssetState = useEndpointState()
  const schemaState = useEndpointState()

  const [schemaMode, setSchemaMode] = useState('list')
  const [schemaAssetType, setSchemaAssetType] = useState('tvShows')

  const [createTvShowForm, setCreateTvShowForm] = useState(() => getEmptyForm('tvShows'))
  const [createSeasonForm, setCreateSeasonForm] = useState(() => getEmptyForm('seasons'))
  const [createEpisodeForm, setCreateEpisodeForm] = useState(() => ({ ...getEmptyForm('episodes'), tvShowKey: '' }))
  const [createWatchlistForm, setCreateWatchlistForm] = useState(() => getEmptyForm('watchlist'))

  const [searchAssetType, setSearchAssetType] = useState('tvShows')
  const [searchFilters, setSearchFilters] = useState(() => getSearchFilters('tvShows'))

  const [updateAssetType, setUpdateAssetType] = useState('tvShows')
  const [updateSelectedKey, setUpdateSelectedKey] = useState('')
  const [updateForm, setUpdateForm] = useState(() => getEmptyForm('tvShows'))
  const [updateListFilter, setUpdateListFilter] = useState('')
  const [updateListPage, setUpdateListPage] = useState(1)
  const [editStack, setEditStack] = useState([])

  const [deleteAssetType, setDeleteAssetType] = useState('tvShows')
  const [deleteSelectedKey, setDeleteSelectedKey] = useState('')

  const [toasts, setToasts] = useState([])

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [createAssetType, setCreateAssetType] = useState('tvShows')
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [detailsTitle, setDetailsTitle] = useState('')
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [historyTitle, setHistoryTitle] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [panelBackdropUrl, setPanelBackdropUrl] = useState('')

  async function loadCatalog() {
    if (!username || !password) return
    setCatalogStatus('loading')
    setCatalogError('')
    try {
      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      loadCatalog.lastRequestId = requestId
      const pageLimit = 1000

      async function fetchSearchPage(selector, { limit, bookmark } = {}) {
        const query = { selector, limit }
        if (bookmark) query.bookmark = bookmark
        const payload = await api.request(scopedPath('/query/search'), { method: 'POST', body: { query } })
        const items = normalizeSearchItems(payload)
        const nextBookmark = typeof payload?.metadata?.bookmark === 'string' ? payload.metadata.bookmark.trim() : ''
        return { items, nextBookmark }
      }

      async function loadAssetTypeIncremental(assetType, { onFirstPage, onNextPage } = {}) {
        const { items: firstItems, nextBookmark } = await fetchSearchPage({ '@assetType': assetType }, { limit: pageLimit })
        if (loadCatalog.lastRequestId !== requestId) return
        if (typeof onFirstPage === 'function') onFirstPage(firstItems)

        let bookmark = nextBookmark
        for (;;) {
          if (loadCatalog.lastRequestId !== requestId) return
          if (!bookmark || bookmark === 'nil') return
          const { items, nextBookmark: next } = await fetchSearchPage({ '@assetType': assetType }, { limit: pageLimit, bookmark })
          if (loadCatalog.lastRequestId !== requestId) return
          if (typeof onNextPage === 'function') onNextPage(items)
          if (!next || next === 'nil' || next === bookmark || items.length === 0) return
          bookmark = next
        }
      }

      const initial = {
        tvShows: [],
        seasons: [],
        episodes: [],
        watchlist: []
      }

      await Promise.all([
        loadAssetTypeIncremental('tvShows', {
          onFirstPage: (items) => {
            initial.tvShows = upsertItemsByKey([], items)
          }
        }),
        loadAssetTypeIncremental('seasons', {
          onFirstPage: (items) => {
            initial.seasons = upsertItemsByKey([], items)
          }
        }),
        loadAssetTypeIncremental('episodes', {
          onFirstPage: (items) => {
            initial.episodes = upsertItemsByKey([], items)
          }
        }),
        loadAssetTypeIncremental('watchlist', {
          onFirstPage: (items) => {
            initial.watchlist = upsertItemsByKey([], items)
          }
        })
      ])

      if (loadCatalog.lastRequestId !== requestId) return

      setCatalog(initial)
      setCatalogStatus('success')

      void loadAssetTypeIncremental('tvShows', {
        onFirstPage: () => {},
        onNextPage: (items) => {
          setCatalog((prev) => ({ ...prev, tvShows: upsertItemsByKey(prev.tvShows, items) }))
        }
      })
      void loadAssetTypeIncremental('seasons', {
        onFirstPage: () => {},
        onNextPage: (items) => {
          setCatalog((prev) => ({ ...prev, seasons: upsertItemsByKey(prev.seasons, items) }))
        }
      })
      void loadAssetTypeIncremental('episodes', {
        onFirstPage: () => {},
        onNextPage: (items) => {
          setCatalog((prev) => ({ ...prev, episodes: upsertItemsByKey(prev.episodes, items) }))
        }
      })
      void loadAssetTypeIncremental('watchlist', {
        onFirstPage: () => {},
        onNextPage: (items) => {
          setCatalog((prev) => ({ ...prev, watchlist: upsertItemsByKey(prev.watchlist, items) }))
        }
      })
    } catch (e) {
      setCatalogStatus('error')
      setCatalogError(e instanceof Error ? e.message : 'Erro ao carregar listas do painel')
    }
  }

  useEffect(() => {
    loadCatalog()
  }, [api, username, password])

  useEffect(() => {
    let cancelled = false

    async function loadPanelBackdrop() {
      if (catalogStatus !== 'success' || !Array.isArray(catalog.tvShows) || catalog.tvShows.length === 0) {
        setPanelBackdropUrl('')
        return
      }

      const tmdbConfig = readTmdbConfig()
      const tmdbEnabled =
        (tmdbConfig.mode === 'bearer' && Boolean(tmdbConfig.token)) ||
        (tmdbConfig.mode === 'apiKey' && Boolean(tmdbConfig.apiKey))

      if (!tmdbEnabled) {
        setPanelBackdropUrl('')
        return
      }

      async function tmdbRequest(path, params) {
        const url = new URL(`https://api.themoviedb.org/3${path}`)
        const search = new URLSearchParams()
        Object.entries(params ?? {}).forEach(([key, value]) => {
          if (value !== undefined && value !== null && String(value).trim() !== '') {
            search.set(key, String(value))
          }
        })
        if (tmdbConfig.mode === 'apiKey') search.set('api_key', String(tmdbConfig.apiKey ?? '').trim())
        url.search = search.toString()

        const headers = { accept: 'application/json' }
        if (tmdbConfig.mode === 'bearer') headers.authorization = `Bearer ${String(tmdbConfig.token ?? '').trim()}`

        const res = await fetch(url.toString(), { method: 'GET', headers })
        if (!res.ok) return []
        const payload = await res.json()
        return Array.isArray(payload?.results) ? payload.results : []
      }

      const candidates = catalog.tvShows
        .map((item) => ({
          title: pickFirstString(item, ['title', 'name']),
          year: pickFirstString(item, ['year'])
        }))
        .filter((item) => item.title)
        .slice(0, 8)

      for (const candidate of candidates) {
        const results = await tmdbRequest('/search/tv', {
          query: candidate.title,
          include_adult: 'false',
          language: tmdbConfig.lang || DEFAULT_TMDB_LANG,
          page: 1,
          first_air_date_year: candidate.year
        })
        if (cancelled) return

        const best = results.find((item) => item?.backdrop_path || item?.poster_path)
        const imagePath = best?.backdrop_path ?? best?.poster_path ?? ''
        if (imagePath) {
          setPanelBackdropUrl(buildTmdbImageUrl(imagePath))
          return
        }
      }

      setPanelBackdropUrl('')
    }

    loadPanelBackdrop()
    return () => {
      cancelled = true
    }
  }, [catalog.tvShows, catalogStatus])

  useEffect(() => {
    setSearchFilters(getSearchFilters(searchAssetType))
  }, [searchAssetType])

  useEffect(() => {
    setUpdateSelectedKey('')
    setUpdateForm(getEmptyForm(updateAssetType))
    setUpdateListFilter('')
    setUpdateListPage(1)
  }, [updateAssetType])

  useEffect(() => {
    if (!isDeleteModalOpen) setDeleteSelectedKey('')
  }, [deleteAssetType, isDeleteModalOpen])

  const tvShowLabelsByKey = useMemo(() => {
    return catalog.tvShows.reduce((acc, item) => {
      const key = getItemKey(item)
      if (key) acc[key] = getTvShowLabel(item)
      return acc
    }, {})
  }, [catalog.tvShows])

  const seasonLabelsByKey = useMemo(() => {
    return catalog.seasons.reduce((acc, item) => {
      const key = getItemKey(item)
      if (key) acc[key] = getSeasonLabel(item, tvShowLabelsByKey)
      return acc
    }, {})
  }, [catalog.seasons, tvShowLabelsByKey])

  const seasonCountByTvShowKey = useMemo(() => {
    return catalog.seasons.reduce((acc, item) => {
      const tvShowKey = getItemRefKey(item?.tvShow)
      if (tvShowKey) acc[tvShowKey] = Number(acc[tvShowKey] ?? 0) + 1
      return acc
    }, {})
  }, [catalog.seasons])

  const episodeCountBySeasonKey = useMemo(() => {
    return catalog.episodes.reduce((acc, item) => {
      const seasonKey = getItemRefKey(item?.season)
      if (seasonKey) acc[seasonKey] = Number(acc[seasonKey] ?? 0) + 1
      return acc
    }, {})
  }, [catalog.episodes])

  const episodeCountByTvShowKey = useMemo(() => {
    return catalog.seasons.reduce((acc, item) => {
      const tvShowKey = getItemRefKey(item?.tvShow)
      const seasonKey = getItemKey(item)
      if (tvShowKey && seasonKey) acc[tvShowKey] = Number(acc[tvShowKey] ?? 0) + Number(episodeCountBySeasonKey[seasonKey] ?? 0)
      return acc
    }, {})
  }, [catalog.seasons, episodeCountBySeasonKey])

  const itemStatsByKey = useMemo(
    () => ({
      seasonCountByTvShowKey,
      episodeCountBySeasonKey,
      episodeCountByTvShowKey
    }),
    [seasonCountByTvShowKey, episodeCountBySeasonKey, episodeCountByTvShowKey]
  )

  const itemOptionsByType = useMemo(() => {
    return {
      tvShows: catalog.tvShows.map((item) => ({ value: getItemKey(item), label: getItemLabel('tvShows', item, tvShowLabelsByKey, seasonLabelsByKey), item })),
      seasons: catalog.seasons.map((item) => ({ value: getItemKey(item), label: getItemLabel('seasons', item, tvShowLabelsByKey, seasonLabelsByKey), item })),
      episodes: catalog.episodes.map((item) => ({ value: getItemKey(item), label: getItemLabel('episodes', item, tvShowLabelsByKey, seasonLabelsByKey), item })),
      watchlist: catalog.watchlist.map((item) => ({ value: getItemKey(item), label: getItemLabel('watchlist', item, tvShowLabelsByKey, seasonLabelsByKey), item }))
    }
  }, [catalog, tvShowLabelsByKey, seasonLabelsByKey])

  const tvShowOptions = itemOptionsByType.tvShows
  const seasonOptions = itemOptionsByType.seasons

  function scopedPath(path) {
    if (!useScopedRoutes) return path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `/${channelName}/${chaincodeName}${normalizedPath}`
  }

  function pushToast(type, title, message) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, { id, type, title, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 4200)
  }

  function closeToast(id) {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }

  async function run(state, fn, logLabel, { onSuccess, onError, showSuccessToast = false } = {}) {
    state.start()
    try {
      const payload = await fn()
      state.succeed(payload)
      if (import.meta?.env?.DEV) console.log(logLabel, payload)
      if (showSuccessToast) pushToast('success', 'Concluído', 'Operação realizada com sucesso.')
      if (onSuccess) await onSuccess(payload)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido'
      state.fail(message)
      pushToast('error', 'Erro', message)
      if (onError) onError(e)
    }
  }

  function fail(state, message) {
    state.start()
    state.fail(message)
    pushToast('error', 'Erro', message)
  }

  async function searchByAssetType(assetType, { limit = 200 } = {}) {
    const payload = await api.request(scopedPath('/query/search'), {
      method: 'POST',
      body: { query: { selector: { '@assetType': assetType }, limit } }
    })
    return normalizeSearchItems(payload)
  }

  async function searchBySelector(selector, { limit = 200 } = {}) {
    const payload = await api.request(scopedPath('/query/search'), {
      method: 'POST',
      body: { query: { selector, limit } }
    })
    return normalizeSearchItems(payload)
  }

  async function searchAllBySelector(selector, { pageLimit = 500 } = {}) {
    const safeLimit = Math.max(1, Math.floor(Number(pageLimit) || 1))
    const allItems = []
    let bookmark = ''

    for (;;) {
      const query = { selector, limit: safeLimit }
      if (bookmark) query.bookmark = bookmark

      const payload = await api.request(scopedPath('/query/search'), {
        method: 'POST',
        body: { query }
      })

      const items = normalizeSearchItems(payload)
      const nextBookmark = typeof payload?.metadata?.bookmark === 'string' ? payload.metadata.bookmark.trim() : ''
      allItems.push(...items)

      if (!nextBookmark || nextBookmark === 'nil' || nextBookmark === bookmark || items.length === 0) {
        break
      }

      bookmark = nextBookmark
    }

    return allItems
  }

  function searchAllByAssetType(assetType, { pageLimit = 500 } = {}) {
    return searchAllBySelector({ '@assetType': assetType }, { pageLimit })
  }

  async function deleteAssetByItem(assetType, item) {
    let lastError = null

    for (const key of buildDeleteKeyCandidates(assetType, item)) {
      try {
        return await api.request(scopedPath('/invoke/deleteAsset'), { method: 'DELETE', body: { key } })
      } catch (error) {
        lastError = error
        if (!(error instanceof Error) || !error.message.includes('HTTP 404')) throw error
      }
    }

    throw lastError ?? new Error('Erro ao excluir item.')
  }

  async function updateWatchlistReferences(item, tvShowKeys) {
    const payload = {
      '@assetType': 'watchlist',
      title: String(item?.title ?? '').trim(),
      tvShows: tvShowKeys.map((key) => buildReference('tvShows', key)).filter(Boolean)
    }
    const description = String(item?.description ?? '').trim()
    if (description) payload.description = description
    return api.request(scopedPath('/invoke/updateAsset'), { method: 'PUT', body: { update: payload } })
  }

  function pickCreatedAsset(response) {
    if (Array.isArray(response?.value) && response.value.length > 0) return response.value[0]
    if (response?.value && typeof response.value === 'object') return response.value
    if (Array.isArray(response?.result) && response.result.length > 0) return response.result[0]
    if (response?.result && typeof response.result === 'object') return response.result
    return response
  }

  async function createAssetRecord(payload) {
    const response = await api.request(scopedPath('/invoke/createAsset'), {
      method: 'POST',
      body: { asset: [payload] }
    })
    const created = pickCreatedAsset(response)
    if (getItemKey(created)) return created

    const assetType = typeof payload?.['@assetType'] === 'string' ? payload['@assetType'] : ''
    if (!assetType) return created

    try {
      const keyPayload = buildKeyPayload(assetType, payload)
      const read = await api.request(scopedPath('/query/readAsset'), { method: 'POST', body: { key: keyPayload } })
      const resolved = pickCreatedAsset(read)
      return getItemKey(resolved) ? resolved : created
    } catch {
      return created
    }
  }

  function isUpdateKeyChanged(assetType, form, item) {
    if (!item) return false
    if (assetType === 'tvShows' || assetType === 'watchlist') {
      return String(form.title ?? '').trim() !== String(item?.title ?? item?.name ?? '').trim()
    }
    if (assetType === 'seasons') {
      return (
        String(form.tvShowKey ?? '').trim() !== String(getItemRefKey(item?.tvShow) ?? '').trim() ||
        toNumberOrUndefined(form.number) !== toNumberOrUndefined(item?.number)
      )
    }
    if (assetType === 'episodes') {
      return (
        String(form.seasonKey ?? '').trim() !== String(getItemRefKey(item?.season) ?? '').trim() ||
        toNumberOrUndefined(form.episodeNumber) !== toNumberOrUndefined(item?.episodeNumber)
      )
    }
    return false
  }

  function buildEpisodeCreatePayload(item, seasonKeyOverride) {
    const payload = {
      '@assetType': 'episodes',
      season: buildReference('seasons', seasonKeyOverride ?? getItemRefKey(item?.season)),
      episodeNumber: toNumberOrUndefined(item?.episodeNumber),
      title: String(item?.title ?? '').trim(),
      releaseDate: String(item?.releaseDate ?? '').trim(),
      description: String(item?.description ?? '').trim()
    }
    const rating = toNumberOrUndefined(item?.rating)
    if (rating !== undefined) payload.rating = rating
    return payload
  }

  async function migrateEpisodeKeyChange(oldItem, payload) {
    await createAssetRecord(payload)
    await deleteAssetByItem('episodes', oldItem)
  }

  async function migrateSeasonKeyChange(oldItem, payload) {
    const newSeason = await createAssetRecord(payload)
    const newSeasonKey = getItemKey(newSeason)
    if (!newSeasonKey) throw new Error('Não foi possível obter a chave da nova temporada.')

    const oldSeasonKey = getItemKey(oldItem)
    const linkedEpisodes = oldSeasonKey
      ? await searchAllBySelector({ '@assetType': 'episodes', 'season.@key': oldSeasonKey }, { pageLimit: 500 })
      : []

    for (const episode of linkedEpisodes) {
      await createAssetRecord(buildEpisodeCreatePayload(episode, newSeasonKey))
    }

    await deleteItemWithDependencies('seasons', oldItem)
  }

  async function migrateWatchlistKeyChange(oldItem, payload) {
    await createAssetRecord(payload)
    await deleteAssetByItem('watchlist', oldItem)
  }

  async function migrateTvShowKeyChange(oldItem, payload) {
    const newTvShow = await createAssetRecord(payload)
    const newTvShowKey = getItemKey(newTvShow)
    if (!newTvShowKey) throw new Error('Não foi possível obter a chave da nova série.')

    const oldTvShowKey = getItemKey(oldItem)
    const linkedSeasons = oldTvShowKey
      ? await searchAllBySelector({ '@assetType': 'seasons', 'tvShow.@key': oldTvShowKey }, { pageLimit: 500 })
      : []
    const newSeasonKeyByOldSeasonKey = new Map()

    for (const season of linkedSeasons) {
      const createdSeason = await createAssetRecord({
        '@assetType': 'seasons',
        number: toNumberOrUndefined(season?.number),
        tvShow: buildReference('tvShows', newTvShowKey),
        year: toNumberOrUndefined(season?.year)
      })
      const oldSeasonKey = getItemKey(season)
      const newSeasonKey = getItemKey(createdSeason)
      if (oldSeasonKey && newSeasonKey) newSeasonKeyByOldSeasonKey.set(oldSeasonKey, newSeasonKey)
    }

    for (const season of linkedSeasons) {
      const oldSeasonKey = getItemKey(season)
      const newSeasonKey = oldSeasonKey ? newSeasonKeyByOldSeasonKey.get(oldSeasonKey) : ''
      if (!newSeasonKey) continue

      const linkedEpisodes = oldSeasonKey
        ? await searchAllBySelector({ '@assetType': 'episodes', 'season.@key': oldSeasonKey }, { pageLimit: 500 })
        : []

      for (const episode of linkedEpisodes) {
        await createAssetRecord(buildEpisodeCreatePayload(episode, newSeasonKey))
      }
    }

    const allWatchlists = await searchAllByAssetType('watchlist', { pageLimit: 500 })
    const linkedWatchlists = allWatchlists.filter((watchlist) =>
      Array.isArray(watchlist?.tvShows) && watchlist.tvShows.some((entry) => getItemRefKey(entry) === oldTvShowKey)
    )

    for (const watchlist of linkedWatchlists) {
      const nextTvShowKeys = watchlist.tvShows
        .map((entry) => getItemRefKey(entry))
        .filter(Boolean)
        .map((key) => (key === oldTvShowKey ? newTvShowKey : key))
      await updateWatchlistReferences(watchlist, Array.from(new Set(nextTvShowKeys)))
    }

    await deleteItemWithDependencies('tvShows', oldItem)
    return { newTvShowKey, newSeasonKeyByOldSeasonKey }
  }

  async function deleteItemWithDependencies(assetType, item) {
    if (assetType === 'seasons') {
      const seasonKey = getItemKey(item)
      const linkedEpisodes = seasonKey
        ? await searchAllBySelector({ '@assetType': 'episodes', 'season.@key': seasonKey }, { pageLimit: 500 })
        : catalog.episodes.filter((episode) => getItemRefKey(episode?.season) === seasonKey)

      await runTasksWithConcurrencyLimit(
        linkedEpisodes.map((episode) => () => deleteAssetByItem('episodes', episode)),
        6
      )

      return deleteAssetByItem('seasons', item)
    }

    if (assetType === 'tvShows') {
      const tvShowKey = getItemKey(item)
      const linkedSeasons = tvShowKey
        ? await searchAllBySelector({ '@assetType': 'seasons', 'tvShow.@key': tvShowKey }, { pageLimit: 500 })
        : catalog.seasons.filter((season) => getItemRefKey(season?.tvShow) === tvShowKey)
      const linkedEpisodesMap = new Map()

      for (const season of linkedSeasons) {
        const seasonKey = getItemKey(season)
        const seasonEpisodes = seasonKey
          ? await searchAllBySelector({ '@assetType': 'episodes', 'season.@key': seasonKey }, { pageLimit: 500 })
          : []

        for (const episode of seasonEpisodes) {
          const episodeKey = getItemKey(episode)
          linkedEpisodesMap.set(episodeKey || JSON.stringify(episode), episode)
        }
      }

      const allWatchlists = await searchAllByAssetType('watchlist', { pageLimit: 500 })
      const linkedWatchlists = allWatchlists.filter((watchlist) =>
        Array.isArray(watchlist?.tvShows) && watchlist.tvShows.some((entry) => getItemRefKey(entry) === tvShowKey)
      )

      for (const watchlist of linkedWatchlists) {
        const remainingKeys = watchlist.tvShows
          .map((entry) => getItemRefKey(entry))
          .filter((key) => key && key !== tvShowKey)
        await updateWatchlistReferences(watchlist, remainingKeys)
      }

      await runTasksWithConcurrencyLimit(
        Array.from(linkedEpisodesMap.values()).map((episode) => () => deleteAssetByItem('episodes', episode)),
        6
      )

      await runTasksWithConcurrencyLimit(
        linkedSeasons.map((season) => () => deleteAssetByItem('seasons', season)),
        6
      )

      return deleteAssetByItem('tvShows', item)
    }

    return deleteAssetByItem(assetType, item)
  }

  function setCreateTvShowField(name, value) {
    setCreateTvShowForm((prev) => ({ ...prev, [name]: value }))
  }

  function setCreateTvShowSeasonField(seasonIndex, name, value) {
    setCreateTvShowForm((prev) => ({
      ...prev,
      seasons: Array.isArray(prev.seasons)
        ? prev.seasons.map((season, index) => (index === seasonIndex ? { ...season, [name]: value } : season))
        : []
    }))
  }

  function setCreateTvShowEpisodeField(seasonIndex, episodeIndex, name, value) {
    setCreateTvShowForm((prev) => ({
      ...prev,
      seasons: Array.isArray(prev.seasons)
        ? prev.seasons.map((season, index) =>
            index === seasonIndex
              ? {
                  ...season,
                  episodes: Array.isArray(season.episodes)
                    ? season.episodes.map((episode, epIndex) =>
                        epIndex === episodeIndex ? { ...episode, [name]: value } : episode
                      )
                    : []
                }
              : season
          )
        : []
    }))
  }

  function addCreateTvShowSeason() {
    setCreateTvShowForm((prev) => ({
      ...prev,
      seasons: [...(Array.isArray(prev.seasons) ? prev.seasons : []), getEmptySeasonDraft()]
    }))
  }

  function removeCreateTvShowSeason(seasonIndex) {
    setCreateTvShowForm((prev) => ({
      ...prev,
      seasons: (Array.isArray(prev.seasons) ? prev.seasons : []).filter((_, index) => index !== seasonIndex)
    }))
  }

  function addCreateTvShowEpisode(seasonIndex) {
    setCreateTvShowForm((prev) => ({
      ...prev,
      seasons: Array.isArray(prev.seasons)
        ? prev.seasons.map((season, index) =>
            index === seasonIndex
              ? { ...season, episodes: [...(Array.isArray(season.episodes) ? season.episodes : []), getEmptyEpisodeDraft()] }
              : season
          )
        : []
    }))
  }

  function removeCreateTvShowEpisode(seasonIndex, episodeIndex) {
    setCreateTvShowForm((prev) => ({
      ...prev,
      seasons: Array.isArray(prev.seasons)
        ? prev.seasons.map((season, index) =>
            index === seasonIndex
              ? {
                  ...season,
                  episodes: (Array.isArray(season.episodes) ? season.episodes : []).filter((_, epIndex) => epIndex !== episodeIndex)
                }
              : season
          )
        : []
    }))
  }

  function setCreateSeasonField(name, value) {
    setCreateSeasonForm((prev) => ({ ...prev, [name]: value }))
  }

  function setCreateEpisodeField(name, value) {
    setCreateEpisodeForm((prev) => ({ ...prev, [name]: value }))
  }

  function setCreateWatchlistField(name, value) {
    setCreateWatchlistForm((prev) => ({ ...prev, [name]: value }))
  }

  function setUpdateField(name, value) {
    setUpdateForm((prev) => ({ ...prev, [name]: value }))
  }

  function setUpdateTvShowSeasonField(seasonIndex, name, value) {
    setUpdateForm((prev) => ({
      ...prev,
      seasons: Array.isArray(prev.seasons)
        ? prev.seasons.map((season, index) => (index === seasonIndex ? { ...season, [name]: value } : season))
        : []
    }))
  }

  function setUpdateTvShowEpisodeField(seasonIndex, episodeIndex, name, value) {
    setUpdateForm((prev) => ({
      ...prev,
      seasons: Array.isArray(prev.seasons)
        ? prev.seasons.map((season, index) =>
            index === seasonIndex
              ? {
                  ...season,
                  episodes: Array.isArray(season.episodes)
                    ? season.episodes.map((episode, epIndex) =>
                        epIndex === episodeIndex ? { ...episode, [name]: value } : episode
                      )
                    : []
                }
              : season
          )
        : []
    }))
  }

  function setUpdateSeasonEpisodeField(episodeIndex, name, value) {
    setUpdateForm((prev) => ({
      ...prev,
      episodes: Array.isArray(prev.episodes)
        ? prev.episodes.map((episode, index) => (index === episodeIndex ? { ...episode, [name]: value } : episode))
        : []
    }))
  }

  function getSelectedItem(assetType, selectedKey) {
    return itemOptionsByType[assetType].find((entry) => entry.value === selectedKey)?.item ?? null
  }

  function selectUpdateItem(assetType, key) {
    setUpdateAssetType(assetType)
    setUpdateSelectedKey(key)
    const item = getSelectedItem(assetType, key)
    if (assetType === 'tvShows' && item) {
      const tvShowKey = getItemKey(item) ?? ''
      const linkedSeasons = tvShowKey
        ? catalog.seasons.filter((season) => getItemRefKey(season?.tvShow) === tvShowKey)
        : []
      const seasonDrafts = linkedSeasons
        .slice()
        .sort((a, b) => Number(a?.number ?? 0) - Number(b?.number ?? 0))
        .map((season) => {
          const seasonKey = getItemKey(season) ?? ''
          const linkedEpisodes = seasonKey
            ? catalog.episodes.filter((episode) => getItemRefKey(episode?.season) === seasonKey)
            : []
          const episodeDrafts = linkedEpisodes
            .slice()
            .sort((a, b) => Number(a?.episodeNumber ?? 0) - Number(b?.episodeNumber ?? 0))
            .map((episode) => ({
              episodeKey: getItemKey(episode) ?? '',
              episodeNumber:
                episode?.episodeNumber === undefined || episode?.episodeNumber === null ? '' : String(episode.episodeNumber),
              title: typeof episode?.title === 'string' ? episode.title : '',
              releaseDate: formatIsoDateForInput(episode?.releaseDate),
              description: typeof episode?.description === 'string' ? episode.description : '',
              rating: episode?.rating === undefined || episode?.rating === null ? '' : String(episode.rating)
            }))
          return {
            seasonKey,
            number: season?.number === undefined || season?.number === null ? '' : String(season.number),
            year: season?.year === undefined || season?.year === null ? '' : String(season.year),
            episodes: episodeDrafts
          }
        })
      setUpdateForm({ ...buildFormFromItem('tvShows', item), seasons: seasonDrafts })
      return
    }
    if (assetType === 'seasons' && item) {
      const seasonKey = getItemKey(item) ?? ''
      const linkedEpisodes = seasonKey ? catalog.episodes.filter((episode) => getItemRefKey(episode?.season) === seasonKey) : []
      const episodeDrafts = linkedEpisodes
        .slice()
        .sort((a, b) => Number(a?.episodeNumber ?? 0) - Number(b?.episodeNumber ?? 0))
        .map((episode) => ({
          episodeKey: getItemKey(episode) ?? '',
          episodeNumber:
            episode?.episodeNumber === undefined || episode?.episodeNumber === null ? '' : String(episode.episodeNumber),
          title: typeof episode?.title === 'string' ? episode.title : '',
          releaseDate: formatIsoDateForInput(episode?.releaseDate),
          description: typeof episode?.description === 'string' ? episode.description : '',
          rating: episode?.rating === undefined || episode?.rating === null ? '' : String(episode.rating)
        }))
      setUpdateForm({ ...buildFormFromItem('seasons', item), episodes: episodeDrafts })
      return
    }
    setUpdateForm(buildFormFromItem(assetType, item))
  }

  function openEditItem(assetType, key) {
    updateAssetState.reset()
    setEditStack([])
    selectUpdateItem(assetType, key)
    setIsEditModalOpen(true)
  }

  function openRelatedEditItem(assetType, key) {
    if (!updateSelectedKey) {
      openEditItem(assetType, key)
      return
    }

    updateAssetState.reset()
    setEditStack((prev) => [...prev, { assetType: updateAssetType, key: updateSelectedKey }])
    selectUpdateItem(assetType, key)
    setIsEditModalOpen(true)
  }

  function goBackEditItem() {
    if (!editStack.length) return
    const last = editStack[editStack.length - 1]
    setEditStack(editStack.slice(0, -1))
    if (last?.assetType && last?.key) {
      updateAssetState.reset()
      selectUpdateItem(last.assetType, last.key)
    }
  }

  function closeEditModal() {
    setIsEditModalOpen(false)
    updateAssetState.reset()
    setEditStack([])
  }

  function closeDeleteModal() {
    setIsDeleteModalOpen(false)
    setDeleteSelectedKey('')
    deleteAssetState.reset()
  }

  function openDeleteItem(assetType, key) {
    deleteAssetState.reset()
    setDeleteAssetType(assetType)
    setDeleteSelectedKey(key)
    setIsDeleteModalOpen(true)
  }

  function validateTvShowBundle(form) {
    const seasons = Array.isArray(form?.seasons) ? form.seasons : []

    for (let seasonIndex = 0; seasonIndex < seasons.length; seasonIndex += 1) {
      const season = seasons[seasonIndex]
      if (toNumberOrUndefined(season?.number) === undefined) {
        return `Informe o número da temporada ${seasonIndex + 1}.`
      }
      if (toNumberOrUndefined(season?.year) === undefined) {
        return `Informe o ano da temporada ${seasonIndex + 1}.`
      }

      const episodes = Array.isArray(season?.episodes) ? season.episodes : []
      for (let episodeIndex = 0; episodeIndex < episodes.length; episodeIndex += 1) {
        const episode = episodes[episodeIndex]
        if (toNumberOrUndefined(episode?.episodeNumber) === undefined) {
          return `Informe o número do episódio ${episodeIndex + 1} da temporada ${seasonIndex + 1}.`
        }
        if (!String(episode?.title ?? '').trim()) {
          return `Informe o título do episódio ${episodeIndex + 1} da temporada ${seasonIndex + 1}.`
        }
        if (!String(episode?.releaseDate ?? '').trim()) {
          return `Informe a data do episódio ${episodeIndex + 1} da temporada ${seasonIndex + 1}.`
        }
        if (!String(episode?.description ?? '').trim()) {
          return `Informe a descrição do episódio ${episodeIndex + 1} da temporada ${seasonIndex + 1}.`
        }
      }
    }

    return ''
  }

  async function runCreateTvShow({ onSuccess } = {}) {
    const payload = buildAssetPayload('tvShows', createTvShowForm)
    const validation = validateAssetPayload('tvShows', payload)
    if (validation) {
      fail(createTvShowState, validation)
      return
    }
    const bundleValidation = validateTvShowBundle(createTvShowForm)
    if (bundleValidation) {
      fail(createTvShowState, bundleValidation)
      return
    }
    return run(
      createTvShowState,
      async () => {
        const createdTvShow = await createAssetRecord(payload)
        const tvShowKey = getItemKey(createdTvShow)
        if (!tvShowKey) throw new Error('Não foi possível obter a chave da série criada.')

        const createdSeasons = []
        const createdEpisodes = []
        const seasons = Array.isArray(createTvShowForm.seasons) ? createTvShowForm.seasons : []
        for (const season of seasons) {
          const createdSeason = await createAssetRecord({
            '@assetType': 'seasons',
            number: toNumberOrUndefined(season.number),
            tvShow: buildReference('tvShows', tvShowKey),
            year: toNumberOrUndefined(season.year)
          })
          const seasonKey = getItemKey(createdSeason)
          if (!seasonKey) throw new Error('Não foi possível obter a chave da temporada criada.')
          createdSeasons.push(createdSeason)

          const episodes = Array.isArray(season.episodes) ? season.episodes : []
          const episodeTasks = episodes.map((episode) => () =>
            createAssetRecord({
              '@assetType': 'episodes',
              season: buildReference('seasons', seasonKey),
              episodeNumber: toNumberOrUndefined(episode.episodeNumber),
              title: String(episode.title ?? '').trim(),
              releaseDate: toIsoDate(String(episode.releaseDate ?? '').trim()),
              description: String(episode.description ?? '').trim(),
              ...(toNumberOrUndefined(episode.rating) !== undefined ? { rating: toNumberOrUndefined(episode.rating) } : {})
            }).then((createdEpisode) => {
              createdEpisodes.push(createdEpisode)
            })
          )
          await runTasksWithConcurrencyLimit(episodeTasks, 6)
        }

        return { tvShow: createdTvShow, seasons: createdSeasons, episodes: createdEpisodes }
      },
      'POST /invoke/createAsset',
      {
        showSuccessToast: true,
        onSuccess: async (payload) => {
          setCreateTvShowForm(getEmptyForm('tvShows'))
          const createdTvShow = payload?.tvShow ?? payload
          const createdSeasons = Array.isArray(payload?.seasons) ? payload.seasons : []
          const createdEpisodes = Array.isArray(payload?.episodes) ? payload.episodes : []
          setCatalog((prev) => ({
            tvShows: upsertItemsByKey(prev.tvShows, createdTvShow ? [createdTvShow] : []),
            seasons: upsertItemsByKey(prev.seasons, createdSeasons),
            episodes: upsertItemsByKey(prev.episodes, createdEpisodes),
            watchlist: prev.watchlist
          }))
          if (onSuccess) await onSuccess()
        }
      }
    )
  }

  async function runCreateSeason({ onSuccess } = {}) {
    const payload = buildAssetPayload('seasons', createSeasonForm)
    const validation = validateAssetPayload('seasons', payload)
    if (validation) {
      fail(createSeasonState, validation)
      return
    }
    return run(
      createSeasonState,
      () => createAssetRecord(payload),
      'POST /invoke/createAsset',
      {
        showSuccessToast: true,
        onSuccess: async (createdSeason) => {
          setCreateSeasonForm(getEmptyForm('seasons'))
          setCatalog((prev) => ({ ...prev, seasons: upsertItemsByKey(prev.seasons, createdSeason ? [createdSeason] : []) }))
          if (onSuccess) await onSuccess()
        }
      }
    )
  }

  async function runCreateEpisode({ onSuccess } = {}) {
    const payload = buildAssetPayload('episodes', createEpisodeForm)
    const validation = validateAssetPayload('episodes', payload)
    if (validation) {
      fail(createEpisodeState, validation)
      return
    }
    return run(
      createEpisodeState,
      () => createAssetRecord(payload),
      'POST /invoke/createAsset',
      {
        showSuccessToast: true,
        onSuccess: async (createdEpisode) => {
          setCreateEpisodeForm((prev) => ({ ...getEmptyForm('episodes'), tvShowKey: prev.tvShowKey }))
          setCatalog((prev) => ({ ...prev, episodes: upsertItemsByKey(prev.episodes, createdEpisode ? [createdEpisode] : []) }))
          if (onSuccess) await onSuccess()
        }
      }
    )
  }

  async function runCreateWatchlist({ onSuccess } = {}) {
    const payload = buildAssetPayload('watchlist', createWatchlistForm)
    const validation = validateAssetPayload('watchlist', payload)
    if (validation) {
      fail(createWatchlistState, validation)
      return
    }
    return run(
      createWatchlistState,
      () => createAssetRecord(payload),
      'POST /invoke/createAsset',
      {
        showSuccessToast: true,
        onSuccess: async (createdWatchlist) => {
          setCreateWatchlistForm(getEmptyForm('watchlist'))
          setCatalog((prev) => ({ ...prev, watchlist: upsertItemsByKey(prev.watchlist, createdWatchlist ? [createdWatchlist] : []) }))
          if (onSuccess) await onSuccess()
        }
      }
    )
  }

  function runSearch() {
    const selector = { '@assetType': searchAssetType }
    if (searchAssetType === 'tvShows') {
      if (searchFilters.title) selector.title = String(searchFilters.title).trim()
    }
    if (searchAssetType === 'seasons') {
      if (searchFilters.tvShowKey) selector.tvShow = buildReference('tvShows', searchFilters.tvShowKey)
      const number = toNumberOrUndefined(searchFilters.number)
      if (number !== undefined) selector.number = number
    }
    if (searchAssetType === 'episodes') {
      if (searchFilters.seasonKey) selector.season = buildReference('seasons', searchFilters.seasonKey)
      const episodeNumber = toNumberOrUndefined(searchFilters.episodeNumber)
      if (episodeNumber !== undefined) selector.episodeNumber = episodeNumber
      if (searchFilters.title) selector.title = String(searchFilters.title).trim()
    }
    if (searchAssetType === 'watchlist') {
      if (searchFilters.title) selector.title = String(searchFilters.title).trim()
    }
    run(
      searchState,
      () => api.request(scopedPath('/query/search'), { method: 'POST', body: { query: { selector, limit: 50 } } }),
      'POST /query/search'
    )
  }

  async function runReadAssetFor(assetType, key) {
    const item = getSelectedItem(assetType, key)
    if (!item) {
      fail(readAssetState, 'Selecione um item para consultar.')
      return
    }
    const keyPayload = buildKeyPayload(assetType, item)
    const validation = validateKeyPayload(assetType, keyPayload)
    if (validation) {
      fail(readAssetState, validation)
      return
    }
    return run(
      readAssetState,
      () => api.request(scopedPath('/query/readAsset'), { method: 'POST', body: { key: keyPayload } }),
      'POST /query/readAsset'
    )
  }

  async function runReadHistoryFor(assetType, key) {
    const item = getSelectedItem(assetType, key)
    if (!item) {
      fail(readHistoryState, 'Selecione um item para ver o histórico.')
      return
    }
    const keyPayload = buildKeyPayload(assetType, item)
    const validation = validateKeyPayload(assetType, keyPayload)
    if (validation) {
      fail(readHistoryState, validation)
      return
    }
    return run(
      readHistoryState,
      () => api.request(scopedPath('/query/readAssetHistory'), { method: 'POST', body: { key: keyPayload } }),
      'POST /query/readAssetHistory'
    )
  }

  async function runUpdate() {
    if (!selectedUpdateItem) {
      fail(updateAssetState, 'Selecione um item válido para editar.')
      return
    }

    const payload = buildUpdatePayload(updateAssetType, updateForm, selectedUpdateItem)
    const validation = validateAssetPayload(updateAssetType, payload)
    if (validation) {
      fail(updateAssetState, validation)
      return
    }
    const keyChanged = isUpdateKeyChanged(updateAssetType, updateForm, selectedUpdateItem)
    return run(
      updateAssetState,
      async () => {
        const seasonByKey = new Map(catalog.seasons.map((item) => [getItemKey(item), item]))
        const episodeByKey = new Map(catalog.episodes.map((item) => [getItemKey(item), item]))

        function normalizeText(value) {
          return String(value ?? '').trim()
        }

        if (updateAssetType === 'tvShows') {
          const seasons = Array.isArray(updateForm?.seasons) ? updateForm.seasons : []
          let currentTvShowKey = getItemKey(selectedUpdateItem) ?? ''
          const seasonKeyByOldSeasonKey = new Map()

          if (keyChanged) {
            const migration = await migrateTvShowKeyChange(selectedUpdateItem, buildAssetPayload('tvShows', updateForm))
            currentTvShowKey = migration?.newTvShowKey ?? currentTvShowKey
            const mapping = migration?.newSeasonKeyByOldSeasonKey
            if (mapping instanceof Map) {
              for (const [oldKey, newKey] of mapping.entries()) {
                seasonKeyByOldSeasonKey.set(oldKey, newKey)
              }
            }
            return { needsReload: true }
          } else {
            const tvShowPayload = buildAssetPayload('tvShows', updateForm)
            const tvShowChanged =
              normalizeText(tvShowPayload.title) !== normalizeText(selectedUpdateItem?.title ?? selectedUpdateItem?.name ?? '') ||
              toNumberOrUndefined(tvShowPayload.recommendedAge) !== toNumberOrUndefined(selectedUpdateItem?.recommendedAge) ||
              normalizeText(tvShowPayload.description) !== normalizeText(selectedUpdateItem?.description)

            if (tvShowChanged) {
              await api.request(scopedPath('/invoke/updateAsset'), { method: 'PUT', body: { update: payload } })
            }
          }

          const updatedSeasons = []
          const updatedEpisodes = []
          const updateTasks = []

          for (const seasonDraft of seasons) {
            const oldSeasonKey = String(seasonDraft?.seasonKey ?? '').trim()
            const seasonKey = keyChanged ? seasonKeyByOldSeasonKey.get(oldSeasonKey) ?? '' : oldSeasonKey
            if (!seasonKey) continue

            const previousSeason = seasonByKey.get(seasonKey)
            const nextSeasonYear = toNumberOrUndefined(seasonDraft?.year)
            const previousSeasonYear = toNumberOrUndefined(previousSeason?.year)
            const seasonChanged = nextSeasonYear !== previousSeasonYear

            const seasonPayload = {
              ...buildAssetPayload('seasons', {
                tvShowKey: currentTvShowKey,
                number: seasonDraft?.number,
                year: seasonDraft?.year
              }),
              '@key': seasonKey
            }
            const seasonValidation = validateAssetPayload('seasons', seasonPayload)
            if (seasonValidation) throw new Error(seasonValidation)
            if (seasonChanged) {
              updateTasks.push(() =>
                api.request(scopedPath('/invoke/updateAsset'), { method: 'PUT', body: { update: seasonPayload } }).then(() => {
                  updatedSeasons.push(previousSeason ? { ...previousSeason, ...seasonPayload } : seasonPayload)
                })
              )
            }

            const episodeDrafts = Array.isArray(seasonDraft?.episodes) ? seasonDraft.episodes : []
            let episodeKeyByEpisodeNumber = null
            if (keyChanged) {
              const existingEpisodes = await searchAllBySelector({ '@assetType': 'episodes', 'season.@key': seasonKey }, { pageLimit: 500 })
              episodeKeyByEpisodeNumber = new Map()
              for (const entry of existingEpisodes) {
                const number = entry?.episodeNumber === undefined || entry?.episodeNumber === null ? '' : String(entry.episodeNumber)
                const key = getItemKey(entry) ?? ''
                if (number && key) episodeKeyByEpisodeNumber.set(number, key)
              }
            }

            for (const episodeDraft of episodeDrafts) {
              const episodeNumber = String(episodeDraft?.episodeNumber ?? '').trim()
              if (!episodeNumber) continue
              const episodeKey = keyChanged
                ? episodeKeyByEpisodeNumber?.get(episodeNumber) ?? ''
                : String(episodeDraft?.episodeKey ?? '').trim()
              if (!episodeKey) continue

              const previousEpisode = episodeByKey.get(episodeKey)
              const nextEpisodeTitle = normalizeText(episodeDraft?.title)
              const nextEpisodeReleaseDate = normalizeText(episodeDraft?.releaseDate)
              const nextEpisodeDescription = normalizeText(episodeDraft?.description)
              const nextEpisodeRating = toNumberOrUndefined(episodeDraft?.rating)
              const previousEpisodeTitle = normalizeText(previousEpisode?.title)
              const previousEpisodeReleaseDate = normalizeText(formatIsoDateForInput(previousEpisode?.releaseDate))
              const previousEpisodeDescription = normalizeText(previousEpisode?.description)
              const previousEpisodeRating = toNumberOrUndefined(previousEpisode?.rating)
              const episodeChanged =
                nextEpisodeTitle !== previousEpisodeTitle ||
                nextEpisodeReleaseDate !== previousEpisodeReleaseDate ||
                nextEpisodeDescription !== previousEpisodeDescription ||
                nextEpisodeRating !== previousEpisodeRating
              if (!episodeChanged) continue

              const episodePayload = {
                ...buildAssetPayload('episodes', {
                  seasonKey,
                  episodeNumber,
                  title: episodeDraft?.title,
                  releaseDate: episodeDraft?.releaseDate,
                  description: episodeDraft?.description,
                  rating: episodeDraft?.rating
                }),
                '@key': episodeKey
              }
              const episodeValidation = validateAssetPayload('episodes', episodePayload)
              if (episodeValidation) throw new Error(episodeValidation)
              updateTasks.push(() =>
                api.request(scopedPath('/invoke/updateAsset'), { method: 'PUT', body: { update: episodePayload } }).then(() => {
                  updatedEpisodes.push(previousEpisode ? { ...previousEpisode, ...episodePayload } : episodePayload)
                })
              )
            }
          }

          await runTasksWithConcurrencyLimit(updateTasks, 6)

          const updatedTvShow = {
            ...selectedUpdateItem,
            ...buildAssetPayload('tvShows', updateForm),
            ...(getItemKey(selectedUpdateItem) ? { '@key': getItemKey(selectedUpdateItem) } : {})
          }

          return {
            patch: {
              tvShows: [updatedTvShow],
              seasons: updatedSeasons,
              episodes: updatedEpisodes
            },
            updatedContext: true
          }
        }

        if (updateAssetType === 'seasons' && !keyChanged) {
          const seasonKey = getItemKey(selectedUpdateItem) ?? ''
          if (!seasonKey) return { needsReload: true }

          const previousSeason = seasonByKey.get(seasonKey) ?? selectedUpdateItem
          const seasonPayload = buildAssetPayload('seasons', updateForm)
          const seasonChanged =
            toNumberOrUndefined(seasonPayload.year) !== toNumberOrUndefined(previousSeason?.year) ||
            toNumberOrUndefined(seasonPayload.number) !== toNumberOrUndefined(previousSeason?.number) ||
            normalizeText(getItemRefKey(seasonPayload.tvShow)) !== normalizeText(getItemRefKey(previousSeason?.tvShow))

          const episodeDrafts = Array.isArray(updateForm?.episodes) ? updateForm.episodes : []
          const updatedEpisodes = []
          const updateTasks = []

          if (seasonChanged) {
            await api.request(scopedPath('/invoke/updateAsset'), { method: 'PUT', body: { update: payload } })
          }

          for (const episodeDraft of episodeDrafts) {
            const episodeKey = String(episodeDraft?.episodeKey ?? '').trim()
            const episodeNumber = String(episodeDraft?.episodeNumber ?? '').trim()
            if (!episodeKey || !episodeNumber) continue

            const previousEpisode = episodeByKey.get(episodeKey)
            const nextEpisodeTitle = normalizeText(episodeDraft?.title)
            const nextEpisodeReleaseDate = normalizeText(episodeDraft?.releaseDate)
            const nextEpisodeDescription = normalizeText(episodeDraft?.description)
            const nextEpisodeRating = toNumberOrUndefined(episodeDraft?.rating)
            const previousEpisodeTitle = normalizeText(previousEpisode?.title)
            const previousEpisodeReleaseDate = normalizeText(formatIsoDateForInput(previousEpisode?.releaseDate))
            const previousEpisodeDescription = normalizeText(previousEpisode?.description)
            const previousEpisodeRating = toNumberOrUndefined(previousEpisode?.rating)
            const episodeChanged =
              nextEpisodeTitle !== previousEpisodeTitle ||
              nextEpisodeReleaseDate !== previousEpisodeReleaseDate ||
              nextEpisodeDescription !== previousEpisodeDescription ||
              nextEpisodeRating !== previousEpisodeRating
            if (!episodeChanged) continue

            const episodePayload = {
              ...buildAssetPayload('episodes', {
                seasonKey,
                episodeNumber,
                title: episodeDraft?.title,
                releaseDate: episodeDraft?.releaseDate,
                description: episodeDraft?.description,
                rating: episodeDraft?.rating
              }),
              '@key': episodeKey
            }
            const episodeValidation = validateAssetPayload('episodes', episodePayload)
            if (episodeValidation) throw new Error(episodeValidation)
            updateTasks.push(() =>
              api.request(scopedPath('/invoke/updateAsset'), { method: 'PUT', body: { update: episodePayload } }).then(() => {
                updatedEpisodes.push(previousEpisode ? { ...previousEpisode, ...episodePayload } : episodePayload)
              })
            )
          }

          await runTasksWithConcurrencyLimit(updateTasks, 6)

          const updatedSeason = {
            ...previousSeason,
            ...buildAssetPayload('seasons', updateForm),
            '@key': seasonKey
          }

          return {
            patch: {
              seasons: [updatedSeason],
              episodes: updatedEpisodes
            },
            updatedContext: true
          }
        }

        if (keyChanged) {
          if (updateAssetType === 'tvShows') {
            await migrateTvShowKeyChange(selectedUpdateItem, buildAssetPayload('tvShows', updateForm))
            return { needsReload: true }
          }
          if (updateAssetType === 'seasons') {
            await migrateSeasonKeyChange(selectedUpdateItem, buildAssetPayload('seasons', updateForm))
            return { needsReload: true }
          }
          if (updateAssetType === 'episodes') {
            await migrateEpisodeKeyChange(selectedUpdateItem, buildAssetPayload('episodes', updateForm))
            return { needsReload: true }
          }
          if (updateAssetType === 'watchlist') {
            await migrateWatchlistKeyChange(selectedUpdateItem, buildAssetPayload('watchlist', updateForm))
            return { needsReload: true }
          }
        }
        await api.request(scopedPath('/invoke/updateAsset'), { method: 'PUT', body: { update: payload } })

        const updatedItem = {
          ...selectedUpdateItem,
          ...buildAssetPayload(updateAssetType, updateForm),
          ...(getItemKey(selectedUpdateItem) ? { '@key': getItemKey(selectedUpdateItem) } : {})
        }

        return {
          patch: {
            [updateAssetType]: [updatedItem]
          }
        }
      },
      'PUT /invoke/updateAsset',
      {
        showSuccessToast: true,
        onSuccess: async (result) => {
          if (result?.needsReload) {
            await loadCatalog()
            closeEditModal()
            return
          }
          if (result?.patch) {
            setCatalog((prev) => ({
              tvShows: upsertItemsByKey(prev.tvShows, result.patch.tvShows),
              seasons: upsertItemsByKey(prev.seasons, result.patch.seasons),
              episodes: upsertItemsByKey(prev.episodes, result.patch.episodes),
              watchlist: upsertItemsByKey(prev.watchlist, result.patch.watchlist)
            }))
          }
          closeEditModal()
        }
      }
    )
  }

  async function runDelete() {
    const item = getSelectedItem(deleteAssetType, deleteSelectedKey)
    if (!item) {
      fail(deleteAssetState, 'Selecione um item para excluir.')
      closeDeleteModal()
      return
    }
    const keyCandidates = buildDeleteKeyCandidates(deleteAssetType, item)
    const validation =
      !keyCandidates.length
        ? 'Selecione um item válido.'
        : keyCandidates.map((key) => validateKeyPayload(deleteAssetType, key)).find(Boolean)
    if (validation) {
      fail(deleteAssetState, validation)
      closeDeleteModal()
      return
    }
    return run(
      deleteAssetState,
      () => deleteItemWithDependencies(deleteAssetType, item),
      'DELETE /invoke/deleteAsset',
      {
        showSuccessToast: true,
        onSuccess: async () => {
          const deletedKey = getItemKey(item) || String(deleteSelectedKey ?? '').trim()
          if (deletedKey) {
            setCatalog((prev) => {
              if (deleteAssetType === 'episodes') {
                return { ...prev, episodes: removeItemsByKey(prev.episodes, [deletedKey]) }
              }

              if (deleteAssetType === 'seasons') {
                const nextSeasons = removeItemsByKey(prev.seasons, [deletedKey])
                const nextEpisodes = prev.episodes.filter((episode) => getItemRefKey(episode?.season) !== deletedKey)
                return { ...prev, seasons: nextSeasons, episodes: nextEpisodes }
              }

              if (deleteAssetType === 'tvShows') {
                const tvShowKey = deletedKey
                const seasonsToRemove = prev.seasons.filter((season) => getItemRefKey(season?.tvShow) === tvShowKey)
                const seasonKeySetToRemove = new Set(seasonsToRemove.map((season) => getItemKey(season)).filter(Boolean))
                const nextTvShows = removeItemsByKey(prev.tvShows, [tvShowKey])
                const nextSeasons = prev.seasons.filter((season) => getItemRefKey(season?.tvShow) !== tvShowKey)
                const nextEpisodes = prev.episodes.filter((episode) => {
                  const seasonKey = getItemRefKey(episode?.season)
                  if (!seasonKey) return true
                  return !seasonKeySetToRemove.has(seasonKey)
                })
                const nextWatchlist = prev.watchlist.map((watchlist) => {
                  if (!Array.isArray(watchlist?.tvShows)) return watchlist
                  const tvShows = watchlist.tvShows.filter((entry) => getItemRefKey(entry) !== tvShowKey)
                  return { ...watchlist, tvShows }
                })
                return { ...prev, tvShows: nextTvShows, seasons: nextSeasons, episodes: nextEpisodes, watchlist: nextWatchlist }
              }

              if (deleteAssetType === 'watchlist') {
                return { ...prev, watchlist: removeItemsByKey(prev.watchlist, [deletedKey]) }
              }

              return prev
            })
          }
          closeDeleteModal()
        },
        onError: () => {
          closeDeleteModal()
        }
      }
    )
  }

  function runSchema() {
    const body = schemaMode === 'detail' ? { assetType: schemaAssetType } : {}
    run(
      schemaState,
      () => api.request(scopedPath('/query/getSchema'), { method: 'POST', body }),
      'POST /query/getSchema'
    )
  }

  function renderAssetForm(mode, assetType, form, setField) {
    if (assetType === 'tvShows') {
      const seasons = Array.isArray(form.seasons) ? form.seasons : []
      return (
        <>
          <Row label="Nome da série">
            <input className="form-control" value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="Ex.: The Office" />
          </Row>
          <Row label="Idade recomendada">
            <input className="form-control" value={form.recommendedAge} onChange={(e) => setField('recommendedAge', e.target.value)} type="number" min="0" step="1" placeholder="Ex.: 14" />
          </Row>
          <Row label="Descrição">
            <textarea className="form-control" value={form.description} onChange={(e) => setField('description', e.target.value)} rows={5} spellCheck={false} />
          </Row>
          {mode === 'create' ? (
            <div className="mb-3">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <div>
                  <div className="form-label mb-1">Temporadas e episodios</div>
                  <div className="text-white-50 small">
                    Cadastre a serie completa em um unico fluxo, incluindo temporadas e episodios.
                  </div>
                </div>
                <button type="button" className="btn btn--outline btn--sm" onClick={addCreateTvShowSeason}>
                  Adicionar temporada
                </button>
              </div>

              <div className="d-grid gap-3">
                {seasons.map((season, seasonIndex) => {
                  const episodes = Array.isArray(season.episodes) ? season.episodes : []
                  return (
                    <section key={`season-draft-${seasonIndex}`} className="panel panel--soft">
                      <div className="panel__body">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                          <div className="panel__headline mb-0">Temporada {seasonIndex + 1}</div>
                          <button
                            type="button"
                            className="btn btn-danger-soft btn-sm"
                            onClick={() => removeCreateTvShowSeason(seasonIndex)}
                            disabled={seasons.length <= 1}
                          >
                            <BiIcon name="trash3" className="me-2" />
                            Remover temporada
                          </button>
                        </div>

                        <div className="row g-3">
                          <div className="col-md-6">
                            <Row label="Numero da temporada">
                              <input
                                className="form-control"
                                value={season.number}
                                onChange={(e) => setCreateTvShowSeasonField(seasonIndex, 'number', e.target.value)}
                                type="number"
                                min="1"
                              />
                            </Row>
                          </div>
                          <div className="col-md-6">
                            <Row label="Ano">
                              <input
                                className="form-control"
                                value={season.year}
                                onChange={(e) => setCreateTvShowSeasonField(seasonIndex, 'year', e.target.value)}
                                type="number"
                                min="1900"
                              />
                            </Row>
                          </div>
                        </div>

                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                          <div className="form-label mb-0">Episodios</div>
                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
                            onClick={() => addCreateTvShowEpisode(seasonIndex)}
                          >
                            Adicionar episodio
                          </button>
                        </div>

                        <div className="d-grid gap-3">
                          {episodes.map((episode, episodeIndex) => (
                            <section key={`season-${seasonIndex}-episode-${episodeIndex}`} className="panel panel--soft">
                              <div className="panel__body">
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                                  <div className="panel__headline mb-0">Episodio {episodeIndex + 1}</div>
                                  <button
                                    type="button"
                                    className="btn btn-danger-soft btn-sm"
                                    onClick={() => removeCreateTvShowEpisode(seasonIndex, episodeIndex)}
                                    disabled={false}
                                  >
                                    <BiIcon name="trash3" className="me-2" />
                                    Remover episodio
                                  </button>
                                </div>

                                <div className="row g-3">
                                  <div className="col-md-4">
                                    <Row label="Numero">
                                      <input
                                        className="form-control"
                                        value={episode.episodeNumber}
                                        onChange={(e) =>
                                          setCreateTvShowEpisodeField(seasonIndex, episodeIndex, 'episodeNumber', e.target.value)
                                        }
                                        type="number"
                                        min="1"
                                      />
                                    </Row>
                                  </div>
                                  <div className="col-md-4">
                                    <Row label="Data">
                                      <input
                                        className="form-control"
                                        value={episode.releaseDate}
                                        onChange={(e) =>
                                          setCreateTvShowEpisodeField(seasonIndex, episodeIndex, 'releaseDate', e.target.value)
                                        }
                                        type="date"
                                      />
                                    </Row>
                                  </div>
                                  <div className="col-md-4">
                                    <Row label="Nota">
                                      <input
                                        className="form-control"
                                        value={episode.rating}
                                        onChange={(e) =>
                                          setCreateTvShowEpisodeField(seasonIndex, episodeIndex, 'rating', e.target.value)
                                        }
                                        type="number"
                                        min="0"
                                        max="10"
                                        step="0.1"
                                        placeholder="Opcional"
                                      />
                                    </Row>
                                  </div>
                                </div>

                                <Row label="Titulo do episodio">
                                  <input
                                    className="form-control"
                                    value={episode.title}
                                    onChange={(e) => setCreateTvShowEpisodeField(seasonIndex, episodeIndex, 'title', e.target.value)}
                                    placeholder="Ex.: Piloto"
                                  />
                                </Row>

                                <Row label="Descricao do episodio">
                                  <textarea
                                    className="form-control"
                                    value={episode.description}
                                    onChange={(e) =>
                                      setCreateTvShowEpisodeField(seasonIndex, episodeIndex, 'description', e.target.value)
                                    }
                                    rows={4}
                                    spellCheck={false}
                                  />
                                </Row>
                              </div>
                            </section>
                          ))}
                        </div>
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <div>
                  <div className="form-label mb-1">Temporadas e episodios</div>
                  <div className="text-white-50 small">Edite tudo dentro do contexto da serie.</div>
                </div>
              </div>

              {seasons.length ? (
                <div className="d-grid gap-3">
                  {seasons.map((season, seasonIndex) => {
                    const episodes = Array.isArray(season.episodes) ? season.episodes : []
                    const seasonNumber = String(season?.number ?? '').trim() || String(seasonIndex + 1)
                    return (
                      <section key={season.seasonKey || `season-${seasonIndex}`} className="panel panel--soft">
                        <div className="panel__body">
                          <div className="panel__headline mb-3">Temporada {seasonNumber}</div>

                          <div className="row g-3">
                            <div className="col-md-6">
                              <Row label="Numero da temporada">
                                <input className="form-control" value={season.number ?? ''} type="number" min="1" disabled />
                              </Row>
                            </div>
                            <div className="col-md-6">
                              <Row label="Ano">
                                <input
                                  className="form-control"
                                  value={season.year ?? ''}
                                  onChange={(e) => setUpdateTvShowSeasonField(seasonIndex, 'year', e.target.value)}
                                  type="number"
                                  min="1900"
                                />
                              </Row>
                            </div>
                          </div>

                          {episodes.length ? (
                            <div className="d-grid gap-3 mt-3">
                              {episodes.map((episode, episodeIndex) => {
                                const episodeNumber = String(episode?.episodeNumber ?? '').trim() || String(episodeIndex + 1)
                                return (
                                  <section key={episode.episodeKey || `season-${seasonIndex}-episode-${episodeIndex}`} className="panel panel--soft">
                                    <div className="panel__body">
                                      <div className="panel__headline mb-3">Episodio {episodeNumber}</div>

                                      <div className="row g-3">
                                        <div className="col-md-4">
                                          <Row label="Numero">
                                            <input className="form-control" value={episode.episodeNumber ?? ''} type="number" min="1" disabled />
                                          </Row>
                                        </div>
                                        <div className="col-md-4">
                                          <Row label="Data">
                                            <input
                                              className="form-control"
                                              value={episode.releaseDate ?? ''}
                                              onChange={(e) =>
                                                setUpdateTvShowEpisodeField(seasonIndex, episodeIndex, 'releaseDate', e.target.value)
                                              }
                                              type="date"
                                            />
                                          </Row>
                                        </div>
                                        <div className="col-md-4">
                                          <Row label="Nota">
                                            <input
                                              className="form-control"
                                              value={episode.rating ?? ''}
                                              onChange={(e) => setUpdateTvShowEpisodeField(seasonIndex, episodeIndex, 'rating', e.target.value)}
                                              type="number"
                                              min="0"
                                              max="10"
                                              step="0.1"
                                              placeholder="Opcional"
                                            />
                                          </Row>
                                        </div>
                                      </div>

                                      <Row label="Titulo do episodio">
                                        <input
                                          className="form-control"
                                          value={episode.title ?? ''}
                                          onChange={(e) => setUpdateTvShowEpisodeField(seasonIndex, episodeIndex, 'title', e.target.value)}
                                          placeholder="Ex.: Piloto"
                                        />
                                      </Row>

                                      <Row label="Descricao do episodio">
                                        <textarea
                                          className="form-control"
                                          value={episode.description ?? ''}
                                          onChange={(e) =>
                                            setUpdateTvShowEpisodeField(seasonIndex, episodeIndex, 'description', e.target.value)
                                          }
                                          rows={4}
                                          spellCheck={false}
                                        />
                                      </Row>
                                    </div>
                                  </section>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="text-white-50 small mt-2">Nenhum episódio cadastrado para esta temporada.</div>
                          )}
                        </div>
                      </section>
                    )
                  })}
                </div>
              ) : (
                <div className="text-white-50 small">Nenhuma temporada vinculada encontrada para esta serie.</div>
              )}
            </div>
          )}
        </>
      )
    }

    if (assetType === 'seasons') {
      const episodes = Array.isArray(form.episodes) ? form.episodes : []
      return (
        <>
          <Row label="Série">
            <select className="form-select" value={form.tvShowKey} onChange={(e) => setField('tvShowKey', e.target.value)} disabled={mode !== 'create'}>
              <option value="">Selecione uma série</option>
              {tvShowOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Row>
          <Row label="Número da temporada">
            <input className="form-control" value={form.number} onChange={(e) => setField('number', e.target.value)} type="number" min="1" disabled={mode !== 'create'} />
          </Row>
          <Row label="Ano de lançamento">
            <input className="form-control" value={form.year} onChange={(e) => setField('year', e.target.value)} type="number" min="1900" />
          </Row>
          {mode !== 'create' ? (
            <div className="mb-3">
              <div className="form-label mb-1">Episodios</div>
              {episodes.length ? (
                <div className="d-grid gap-3">
                  {episodes.map((episode, episodeIndex) => {
                    const episodeNumber = String(episode?.episodeNumber ?? '').trim() || String(episodeIndex + 1)
                    return (
                      <section key={episode.episodeKey || `episode-${episodeIndex}`} className="panel panel--soft">
                        <div className="panel__body">
                          <div className="panel__headline mb-3">Episodio {episodeNumber}</div>

                          <div className="row g-3">
                            <div className="col-md-4">
                              <Row label="Numero">
                                <input className="form-control" value={episode.episodeNumber ?? ''} type="number" min="1" disabled />
                              </Row>
                            </div>
                            <div className="col-md-4">
                              <Row label="Data">
                                <input
                                  className="form-control"
                                  value={episode.releaseDate ?? ''}
                                  onChange={(e) => setUpdateSeasonEpisodeField(episodeIndex, 'releaseDate', e.target.value)}
                                  type="date"
                                />
                              </Row>
                            </div>
                            <div className="col-md-4">
                              <Row label="Nota">
                                <input
                                  className="form-control"
                                  value={episode.rating ?? ''}
                                  onChange={(e) => setUpdateSeasonEpisodeField(episodeIndex, 'rating', e.target.value)}
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.1"
                                  placeholder="Opcional"
                                />
                              </Row>
                            </div>
                          </div>

                          <Row label="Titulo do episodio">
                            <input
                              className="form-control"
                              value={episode.title ?? ''}
                              onChange={(e) => setUpdateSeasonEpisodeField(episodeIndex, 'title', e.target.value)}
                              placeholder="Ex.: Piloto"
                            />
                          </Row>

                          <Row label="Descricao do episodio">
                            <textarea
                              className="form-control"
                              value={episode.description ?? ''}
                              onChange={(e) => setUpdateSeasonEpisodeField(episodeIndex, 'description', e.target.value)}
                              rows={4}
                              spellCheck={false}
                            />
                          </Row>
                        </div>
                      </section>
                    )
                  })}
                </div>
              ) : (
                <div className="text-white-50 small">Nenhum episódio cadastrado para esta temporada.</div>
              )}
            </div>
          ) : null}
        </>
      )
    }

    if (assetType === 'episodes') {
      const scopedSeasonOptions = seasonOptions.filter((option) => {
        if (mode !== 'create') return true
        if (!form.tvShowKey) return true
        const showKey = getItemRefKey(option.item?.tvShow)
        return showKey === form.tvShowKey
      })
      return (
        <>
          {mode === 'create' ? (
            <Row label="Série (para filtrar temporadas)">
              <select
                className="form-select"
                value={form.tvShowKey}
                onChange={(e) => {
                  const tvShowKey = e.target.value
                  setField('tvShowKey', tvShowKey)
                  setField('seasonKey', '')
                }}
              >
                <option value="">Todas</option>
                {tvShowOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Row>
          ) : null}
          <Row label="Temporada">
            <select className="form-select" value={form.seasonKey} onChange={(e) => setField('seasonKey', e.target.value)}>
              <option value="">Selecione uma temporada</option>
              {scopedSeasonOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Row>
          <Row label="Número do episódio">
            <input className="form-control" value={form.episodeNumber} onChange={(e) => setField('episodeNumber', e.target.value)} type="number" min="1" />
          </Row>
          <Row label="Título do episódio">
            <input className="form-control" value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="Ex.: Episódio piloto" />
          </Row>
          <Row label="Data de lançamento">
            <input className="form-control" value={form.releaseDate} onChange={(e) => setField('releaseDate', e.target.value)} type="date" />
          </Row>
          <Row label="Descrição">
            <textarea className="form-control" value={form.description} onChange={(e) => setField('description', e.target.value)} rows={5} spellCheck={false} />
          </Row>
          <Row label="Nota">
            <input className="form-control" value={form.rating} onChange={(e) => setField('rating', e.target.value)} type="number" min="0" max="10" step="0.1" placeholder="Opcional" />
          </Row>
        </>
      )
    }

    if (assetType === 'watchlist') {
      return (
        <>
          <Row label="Nome da lista">
            <input className="form-control" value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="Ex.: Assistir no fim de semana" />
          </Row>
          <Row label="Descrição">
            <textarea className="form-control" value={form.description} onChange={(e) => setField('description', e.target.value)} rows={5} spellCheck={false} />
          </Row>
          <div className="mb-3">
            <div className="form-label">Séries vinculadas</div>
            {tvShowOptions.length ? (
              <div className="list-group">
                {tvShowOptions.map((option) => {
                  const selected = Array.isArray(form.tvShowKeys) ? form.tvShowKeys.includes(option.value) : false
                  return (
                    <label key={option.value} className="list-group-item d-flex gap-2 align-items-start">
                      <input
                        className="form-check-input mt-1"
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          setField(
                            'tvShowKeys',
                            toggleSelection(Array.isArray(form.tvShowKeys) ? form.tvShowKeys : [], option.value)
                          )
                        }
                      />
                      <span className="small">{option.label}</span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <div className="text-white-50 small">Cadastre pelo menos uma série antes de montar a lista.</div>
            )}
          </div>
        </>
      )
    }

    return null
  }

  const selectedUpdateItem = getSelectedItem(updateAssetType, updateSelectedKey)
  const selectedDeleteItem = getSelectedItem(deleteAssetType, deleteSelectedKey)
  const filteredUpdateOptions = useMemo(() => {
    const query = String(updateListFilter ?? '').trim().toLowerCase()
    const options = itemOptionsByType[updateAssetType] ?? []
    if (!query) return options
    return options.filter((option) =>
      getItemSearchText(updateAssetType, option.item, tvShowLabelsByKey, seasonLabelsByKey, itemStatsByKey).includes(query)
    )
  }, [itemOptionsByType, itemStatsByKey, seasonLabelsByKey, tvShowLabelsByKey, updateAssetType, updateListFilter])

  const totalUpdatePages = Math.max(1, Math.ceil(filteredUpdateOptions.length / PANEL_PAGE_SIZE))
  const currentUpdatePage = Math.min(updateListPage, totalUpdatePages)
  const paginatedUpdateOptions = useMemo(() => {
    const startIndex = (currentUpdatePage - 1) * PANEL_PAGE_SIZE
    return filteredUpdateOptions.slice(startIndex, startIndex + PANEL_PAGE_SIZE)
  }, [currentUpdatePage, filteredUpdateOptions])
  const currentPageNumbers = getVisiblePageNumbers(totalUpdatePages, currentUpdatePage)

  useEffect(() => {
    if (updateListPage > totalUpdatePages) {
      setUpdateListPage(totalUpdatePages)
    }
  }, [totalUpdatePages, updateListPage])

  const canUsePanel = true
  const activeAssetTypeLabel = getAssetTypeLabel(updateAssetType)
  const filteredItemCount = filteredUpdateOptions.length
  const selectedUpdateItemLabel = selectedUpdateItem
    ? getItemLabel(updateAssetType, selectedUpdateItem, tvShowLabelsByKey, seasonLabelsByKey)
    : ''
  const selectedUpdateItemMeta = selectedUpdateItem
    ? getItemMeta(updateAssetType, selectedUpdateItem, tvShowLabelsByKey, seasonLabelsByKey, itemStatsByKey)
    : ''
  const relatedEditInfo = useMemo(() => {
    if (!selectedUpdateItem) return { type: '', tvShowKey: '', seasonKey: '', seasons: [], episodes: [], tvShowLabel: '', seasonLabel: '' }

    function sortByNumber(a, b) {
      const aNumber = Number(a?.number ?? a?.episodeNumber ?? 0)
      const bNumber = Number(b?.number ?? b?.episodeNumber ?? 0)
      if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) return aNumber - bNumber
      return 0
    }

    if (updateAssetType === 'tvShows') {
      const tvShowKey = getItemKey(selectedUpdateItem) || String(selectedUpdateItem?.title ?? '').trim()
      const seasons = catalog.seasons
        .filter((season) => getItemRefKey(season?.tvShow) === tvShowKey)
        .slice()
        .sort(sortByNumber)
        .map((season) => {
          const seasonKey = getItemKey(season)
          const episodes = seasonKey
            ? catalog.episodes
                .filter((episode) => getItemRefKey(episode?.season) === seasonKey)
                .slice()
                .sort(sortByNumber)
                .map((episode) => ({
                  key: getItemKey(episode),
                  label: getItemLabel('episodes', episode, tvShowLabelsByKey, seasonLabelsByKey)
                }))
            : []
          return {
            key: seasonKey,
            label: getItemLabel('seasons', season, tvShowLabelsByKey, seasonLabelsByKey),
            episodes
          }
        })
      return {
        type: 'tvShows',
        tvShowKey,
        seasons
      }
    }

    if (updateAssetType === 'seasons') {
      const seasonKey = getItemKey(selectedUpdateItem)
      const tvShowKey = getItemRefKey(selectedUpdateItem?.tvShow) ?? ''
      const episodes = seasonKey
        ? catalog.episodes
            .filter((episode) => getItemRefKey(episode?.season) === seasonKey)
            .slice()
            .sort(sortByNumber)
            .map((episode) => ({
              key: getItemKey(episode),
              label: getItemLabel('episodes', episode, tvShowLabelsByKey, seasonLabelsByKey)
            }))
        : []
      return {
        type: 'seasons',
        tvShowKey,
        seasonKey,
        tvShowLabel: tvShowKey ? tvShowLabelsByKey[tvShowKey] ?? '' : '',
        episodes
      }
    }

    if (updateAssetType === 'episodes') {
      const seasonKey = getItemRefKey(selectedUpdateItem?.season) ?? ''
      const seasonItem = seasonKey ? catalog.seasons.find((season) => getItemKey(season) === seasonKey) : undefined
      const tvShowKey = getItemRefKey(seasonItem?.tvShow) ?? ''
      return {
        type: 'episodes',
        tvShowKey,
        seasonKey,
        tvShowLabel: tvShowKey ? tvShowLabelsByKey[tvShowKey] ?? '' : '',
        seasonLabel: seasonKey ? seasonLabelsByKey[seasonKey] ?? '' : ''
      }
    }

    return { type: '', tvShowKey: '', seasonKey: '', seasons: [], episodes: [], tvShowLabel: '', seasonLabel: '' }
  }, [catalog.episodes, catalog.seasons, catalog.tvShows, seasonLabelsByKey, selectedUpdateItem, tvShowLabelsByKey, updateAssetType])
  const catalogMetrics = [
    { label: 'Séries', value: getCatalogMetricValue(catalogStatus, catalog.tvShows.length) },
    { label: 'Temporadas', value: getCatalogMetricValue(catalogStatus, catalog.seasons.length) },
    { label: 'Episódios', value: getCatalogMetricValue(catalogStatus, catalog.episodes.length) }
  ]

  return (
    <main className="container container-xxl page page--panel painelCadastroPage">
      <ToastHost toasts={toasts} onClose={closeToast} />

      <div
        className="page__header"
        style={panelBackdropUrl ? { '--panel-header-image': `url(${panelBackdropUrl})` } : undefined}
      >
        <h1 className="page__title">Painel do catálogo</h1>
        <div className="page__subtitle page__subtitle--panel">
          Cadastre, revise e atualize séries, temporadas, episódios e listas em uma única área de trabalho.
        </div>
      </div>

      <div className="painelCadastroPage__topbar">
        <div className="painelCadastroPage__topbarInfo">
          {catalogStatus === 'error' ? (
            <div className="alert mb-0" role="alert">
              <div className="alert__title">Falha ao carregar o catálogo</div>
              <div className="alert__text">{catalogError}</div>
            </div>
          ) : null}
        </div>

        <div className="painelCadastroPage__actions">
          <button type="button" className="btn btn-outline-light" onClick={loadCatalog} disabled={catalogStatus === 'loading' || !canUsePanel}>
            <BiIcon name="arrow-clockwise" className="me-2" />
            {catalogStatus === 'loading' ? 'Atualizando...' : 'Atualizar listas'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setCreateTvShowForm(getEmptyForm('tvShows'))
              setIsCreateModalOpen(true)
            }}
            disabled={!canUsePanel}
          >
            <BiIcon name="plus-lg" className="me-2" />
            Cadastrar
          </button>
        </div>
      </div>

      <div className="painelCadastroPage__summaryGrid painelCadastroPage__summaryGrid--top">
        {catalogMetrics.map((metric) => (
          <div key={metric.label} className="summaryCard">
            <div className="summaryCard__label">{metric.label}</div>
            <div className="summaryCard__value">{metric.value}</div>
          </div>
        ))}
      </div>

      <section className="panel panel--soft painelCadastroPage__mainPanel">
        <div className="panel__header">
          <div>
            <div className="panel__title">Gerenciar {activeAssetTypeLabel.toLowerCase()}</div>
            <div className="panel__desc">
              Use a lista para abrir edição em modal, consultar detalhes, revisar histórico e remover itens quando necessário.
            </div>
          </div>
        </div>

        <div className="panel__body">
          <div className="managerToolbar managerToolbar--bootstrap">
            <div className="managerToolbar__main">
              <div>
                <Row label="Tipo do cadastro">
                  <select className="form-select" value={updateAssetType} onChange={(e) => setUpdateAssetType(e.target.value)} disabled={catalogStatus === 'loading'}>
                    {ASSET_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Row>
              </div>

                  <div>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="updateListFilter">Buscar item</label>
                      <div className="input-group managerSearchGroup">
                    <span className="input-group-text managerSearchGroup__icon">
                      <BiIcon name="search" />
                    </span>
                    <input
                      id="updateListFilter"
                      className="form-control"
                      value={updateListFilter}
                      onChange={(e) => {
                        setUpdateListFilter(e.target.value)
                        setUpdateListPage(1)
                        }}
                        placeholder="Filtre por nome, chave ou descrição"
                      />
                    </div>
                  </div>
                </div>
              </div>
          </div>

          <div className="managerListWrap">
            <div className="managerListHeader">
              <div>
                <div className="managerListHeader__title">Lista de itens</div>
                <div className="managerListHeader__subtitle">
                  Clique em uma linha para editar em tela cheia ou use as ações rápidas para detalhes, histórico e exclusão.
                </div>
              </div>
            </div>

            <div className="managerList managerList--table">
              <div className="managerTableWrap">
                <table className="table managerTable align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Resumo</th>
                      <th scope="col" className="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUpdateOptions.length ? (
                      paginatedUpdateOptions.map((option) => {
                        const meta = getItemMeta(updateAssetType, option.item, tvShowLabelsByKey, seasonLabelsByKey, itemStatsByKey)
                        return (
                          <tr
                            key={option.value}
                            className="managerRow"
                            role="button"
                            tabIndex={0}
                            onClick={() => openEditItem(updateAssetType, option.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openEditItem(updateAssetType, option.value)
                              }
                            }}
                          >
                            <td className="managerRow__item">
                              <div className="managerRow__title text-truncate">{option.label}</div>
                            </td>
                            <td className="managerRow__metaCell">
                              <div className="managerRow__meta">{meta || getAssetTypeLabel(updateAssetType)}</div>
                            </td>
                            <td className="text-end">
                              <div className="managerRow__actions" role="group" aria-label="Ações">
                                <IconActionButton
                                  iconName="pencil-square"
                                  label="Editar"
                                  tone="primary"
                                  onClick={(e) => { e.stopPropagation(); openEditItem(updateAssetType, option.value) }}
                                />
                                <IconActionButton
                                  iconName="eye"
                                  label="Detalhes"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    setDetailsTitle(getItemLabel(updateAssetType, option.item, tvShowLabelsByKey, seasonLabelsByKey))
                                    setIsDetailsModalOpen(true)
                                    await runReadAssetFor(updateAssetType, option.value)
                                  }}
                                />
                                <IconActionButton
                                  iconName="clock-history"
                                  label="Histórico"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    setHistoryTitle(getItemLabel(updateAssetType, option.item, tvShowLabelsByKey, seasonLabelsByKey))
                                    setIsHistoryModalOpen(true)
                                    await runReadHistoryFor(updateAssetType, option.value)
                                  }}
                                />
                                <IconActionButton
                                  iconName="trash3"
                                  label="Excluir"
                                  tone="danger"
                                  onClick={(e) => { e.stopPropagation(); openDeleteItem(updateAssetType, option.value) }}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    ) : catalogStatus === 'loading' ? (
                      <tr>
                        <td colSpan={3} className="text-center text-white-50 py-4">Carregando itens...</td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center text-white-50 py-4">Nenhum item encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredUpdateOptions.length > PANEL_PAGE_SIZE ? (
                <div className="managerPagination">
                  <div className="managerPagination__summary">
                    Página {currentUpdatePage} de {totalUpdatePages}
                  </div>

                  <div className="managerPagination__controls" role="navigation" aria-label="Paginação da lista">
                    <button
                      type="button"
                      className="managerPagination__button"
                      onClick={() => setUpdateListPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentUpdatePage === 1}
                      aria-label="Anterior"
                      title="Anterior"
                    >
                      {'<'}
                    </button>

                    {currentPageNumbers.map((pageNumber, index) => {
                      const previous = currentPageNumbers[index - 1]
                      const shouldShowGap = previous && pageNumber - previous > 1
                      return (
                        <span key={pageNumber} className="managerPagination__group">
                          {shouldShowGap ? <span className="managerPagination__ellipsis">...</span> : null}
                          <button
                            type="button"
                            className={`managerPagination__button${pageNumber === currentUpdatePage ? ' managerPagination__button--active' : ''}`}
                            onClick={() => setUpdateListPage(pageNumber)}
                            aria-current={pageNumber === currentUpdatePage ? 'page' : undefined}
                          >
                            {pageNumber}
                          </button>
                        </span>
                      )
                    })}

                    <button
                      type="button"
                      className="managerPagination__button"
                      onClick={() => setUpdateListPage((prev) => Math.min(totalUpdatePages, prev + 1))}
                      disabled={currentUpdatePage === totalUpdatePages}
                      aria-label="Próxima"
                      title="Próxima"
                    >
                      {'>'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {isCreateModalOpen ? (
        <ModalShell
          title="Cadastrar"
          onClose={() => setIsCreateModalOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-outline-light" onClick={() => setIsCreateModalOpen(false)}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  if (createAssetType === 'tvShows') await runCreateTvShow({ onSuccess: () => setIsCreateModalOpen(false) })
                  if (createAssetType === 'seasons') await runCreateSeason({ onSuccess: () => setIsCreateModalOpen(false) })
                  if (createAssetType === 'episodes') await runCreateEpisode({ onSuccess: () => setIsCreateModalOpen(false) })
                  if (createAssetType === 'watchlist') await runCreateWatchlist({ onSuccess: () => setIsCreateModalOpen(false) })
                }}
                disabled={
                  !username ||
                  !password ||
                  createTvShowState.status === 'loading' ||
                  createSeasonState.status === 'loading' ||
                  createEpisodeState.status === 'loading' ||
                  createWatchlistState.status === 'loading'
                }
              >
                Cadastrar
              </button>
            </>
          }
        >
          <Row label="Tipo do cadastro">
            <select
              className="form-select"
              value={createAssetType}
              onChange={(e) => setCreateAssetType(e.target.value)}
            >
              {CREATE_ASSET_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Row>

          {createAssetType === 'tvShows'
            ? renderAssetForm('create', 'tvShows', createTvShowForm, setCreateTvShowField)
            : null}
          {createAssetType === 'seasons'
            ? (
              <>
                {renderAssetForm('create', 'seasons', createSeasonForm, setCreateSeasonField)}
                <FieldHint>Crie a série antes para ela aparecer na lista acima.</FieldHint>
              </>
            )
            : null}
          {createAssetType === 'episodes'
            ? (
              <>
                {renderAssetForm('create', 'episodes', createEpisodeForm, setCreateEpisodeField)}
                <FieldHint>Crie a temporada antes para ela aparecer na lista acima.</FieldHint>
              </>
            )
            : null}
          {createAssetType === 'watchlist'
            ? renderAssetForm('create', 'watchlist', createWatchlistForm, setCreateWatchlistField)
            : null}

          {createAssetType === 'tvShows' && createTvShowState.status === 'success' ? <div className="mt-3"><FriendlyResult value={createTvShowState.result} /></div> : null}
          {createAssetType === 'seasons' && createSeasonState.status === 'success' ? <div className="mt-3"><FriendlyResult value={createSeasonState.result} /></div> : null}
          {createAssetType === 'episodes' && createEpisodeState.status === 'success' ? <div className="mt-3"><FriendlyResult value={createEpisodeState.result} /></div> : null}
          {createAssetType === 'watchlist' && createWatchlistState.status === 'success' ? <div className="mt-3"><FriendlyResult value={createWatchlistState.result} /></div> : null}
        </ModalShell>
      ) : null}

      {isEditModalOpen ? (
        <ModalShell
          title={`Editar • ${selectedUpdateItemLabel || activeAssetTypeLabel}`}
          size="xl"
          onClose={closeEditModal}
          footer={
            <>
              <button type="button" className="btn btn-outline-light" onClick={closeEditModal} disabled={updateAssetState.status === 'loading'}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={runUpdate}
                disabled={!selectedUpdateItem || updateAssetState.status === 'loading' || !canUsePanel}
              >
                {updateAssetState.status === 'loading' ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </>
          }
        >
          {selectedUpdateItem ? (
            <div className="painelCadastroPage__editModal">
              <div className="managerListHeader managerEditor__summary">
                <div>
                  <div className="managerListHeader__subtitle">
                    Atualize os campos abaixo e salve quando terminar.
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  {editStack.length > 0 ? (
                    <button type="button" className="btn btn-outline-light btn-sm" onClick={goBackEditItem}>
                      Voltar
                    </button>
                  ) : null}
                  {selectedUpdateItemMeta ? <span className="pill">{selectedUpdateItemMeta}</span> : null}
                </div>
              </div>

              <div className="painelCadastroPage__formStack">
                {renderAssetForm('update', updateAssetType, updateForm, setUpdateField)}
              </div>

              {null}

              {relatedEditInfo.type === 'seasons' ? (
                <div className="panel panel--soft mt-3">
                  <div className="panel__body">
                    <div className="panel__headline">Itens vinculados</div>
                    <div className="d-flex flex-column gap-2">
                      {relatedEditInfo.tvShowKey ? (
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                          <div className="text-white-50 small">{relatedEditInfo.tvShowLabel || 'Série vinculada'}</div>
                          <button type="button" className="btn btn-outline-light btn-sm" onClick={() => openRelatedEditItem('tvShows', relatedEditInfo.tvShowKey)}>
                            Editar série
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {relatedEditInfo.type === 'episodes' ? (
                <div className="panel panel--soft mt-3">
                  <div className="panel__body">
                    <div className="panel__headline">Itens vinculados</div>
                    <div className="d-flex flex-column gap-2">
                      {relatedEditInfo.tvShowKey ? (
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                          <div className="text-white-50 small">{relatedEditInfo.tvShowLabel || 'Série vinculada'}</div>
                          <button type="button" className="btn btn-outline-light btn-sm" onClick={() => openRelatedEditItem('tvShows', relatedEditInfo.tvShowKey)}>
                            Editar série
                          </button>
                        </div>
                      ) : null}
                      {relatedEditInfo.seasonKey ? (
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                          <div className="text-white-50 small">{relatedEditInfo.seasonLabel || 'Temporada vinculada'}</div>
                          <button type="button" className="btn btn-outline-light btn-sm" onClick={() => openRelatedEditItem('seasons', relatedEditInfo.seasonKey)}>
                            Editar temporada
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {false ? (
                <div className="alert" role="alert">
                  <div className="alert__title">Não foi possível salvar</div>
                  <div className="alert__text">{updateAssetState.error}</div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="emptyState">Selecione um item válido para editar.</div>
          )}
        </ModalShell>
      ) : null}

      {isDetailsModalOpen ? (
        <ModalShell
          title={`Detalhes • ${detailsTitle || getAssetTypeLabel(updateAssetType)}`}
          size="xl"
          onClose={() => setIsDetailsModalOpen(false)}
          footer={<button type="button" className="btn btn-outline-light" onClick={() => setIsDetailsModalOpen(false)}>Fechar</button>}
        >
          {readAssetState.status === 'loading' ? <div className="text-white-50">Carregando...</div> : null}
          {readAssetState.status === 'success' ? <FriendlyResult value={readAssetState.result} variant="modal" showHeader={false} suppressItemTitle /> : null}
        </ModalShell>
      ) : null}

      {isHistoryModalOpen ? (
        <ModalShell
          title={`Histórico • ${historyTitle || getAssetTypeLabel(updateAssetType)}`}
          size="xl"
          onClose={() => setIsHistoryModalOpen(false)}
          footer={<button type="button" className="btn btn-outline-light" onClick={() => setIsHistoryModalOpen(false)}>Fechar</button>}
        >
          {readHistoryState.status === 'loading' ? <div className="text-white-50">Carregando...</div> : null}
          {readHistoryState.status === 'success' ? <FriendlyResult value={readHistoryState.result} variant="modal" showHeader={false} suppressItemTitle /> : null}
        </ModalShell>
      ) : null}

      {isDeleteModalOpen ? (
        <ModalShell
          title="Confirmar exclusão"
          size="md"
          onClose={closeDeleteModal}
          footer={
            <>
              <button type="button" className="btn btn-outline-light" onClick={closeDeleteModal} disabled={deleteAssetState.status === 'loading'}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger-soft" onClick={runDelete} disabled={deleteAssetState.status === 'loading'}>
                <BiIcon name="trash3" className="me-2" />
                {deleteAssetState.status === 'loading' ? 'Excluindo...' : 'Excluir'}
              </button>
            </>
          }
        >
          {selectedDeleteItem ? (
            <div className="text-white-50">
              Você está prestes a excluir: <span className="text-white">{getItemLabel(deleteAssetType, selectedDeleteItem, tvShowLabelsByKey, seasonLabelsByKey)}</span>
            </div>
          ) : (
            <div className="text-white-50">Selecione um item válido para excluir.</div>
          )}
          {deleteAssetState.status === 'success' ? <div className="mt-3"><FriendlyResult value={deleteAssetState.result} /></div> : null}
        </ModalShell>
      ) : null}
    </main>
  )
}
