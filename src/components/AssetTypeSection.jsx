import { useEffect, useMemo, useRef, useState } from 'react'
import { createGoLedgerApi } from '../api/goledgerApi.js'
import Section from './Section.jsx'

const ASSET_TYPES = {
  assetTypeListData: 'assetTypeListData',
  episodes: 'episodes',
  movies: 'movies',
  seasons: 'seasons',
  tvChannels: 'tvChannels',
  tvShows: 'tvShows',
  watchlist: 'watchlist'
}

const DEFAULT_LIMIT = 60
const HOME_INITIAL_LIMIT = 200
const PRIMARY_LIMIT = 200
const SEASONS_LIMIT = 400
const EPISODES_LIMIT = 400
const TV_SHOWS_LIMIT = 200
const WATCHLIST_LIMIT = 250
const MAX_RENDERED_ITEMS = 60
const HOME_RENDER_BATCH_SIZE = 25
const HOME_RENDER_APPEND_DELAY = 260
const LOAD_RETRY_DELAY = 10_000
const MAX_POSTER_SEARCH_ITEMS = 30
const HOME_POSTER_SEARCH_ITEMS = 12
const SKELETON_COUNT = 12
const FAVORITES_EVENT = 'goledger:favoritesChanged'
const TMDB_CONFIG_EVENT = 'tmdb:configChanged'
const WATCHLIST_REF_PREFIX = 'ref:'
const assetTypeDataCache = new Map()
const tvShowStatsCache = new Map()
const tvShowStatsPromiseCache = new Map()
const tmdbPosterCache = new Map()
const tmdbPosterPromiseCache = new Map()
const favoritesCache = {
  ids: null,
  promise: null
}
const SECTION_LOAD_PROFILES = {
  default: {
    cacheKey: 'default',
    initialLimit: undefined,
    maxRenderedItems: MAX_RENDERED_ITEMS,
    progressiveBatchSize: 0,
    loadAll: false,
    posterSearchItems: MAX_POSTER_SEARCH_ITEMS,
    deferTvShowStats: false
  },
  home: {
    cacheKey: 'home',
    initialLimit: HOME_INITIAL_LIMIT,
    maxRenderedItems: undefined,
    progressiveBatchSize: HOME_RENDER_BATCH_SIZE,
    loadAll: true,
    posterSearchItems: HOME_POSTER_SEARCH_ITEMS,
    deferTvShowStats: true
  }
}

function getSectionLoadProfile(profileName) {
  return SECTION_LOAD_PROFILES[profileName] ?? SECTION_LOAD_PROFILES.default
}

function pickFirstString(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function buildReference(assetType, key) {
  return assetType && key ? { '@assetType': assetType, '@key': key } : undefined
}

function toText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function getItemKey(item, fallback) {
  return (
    pickFirstString(item, ['@key', '@lastTxID', 'id', '_id', 'key']) ??
    fallback
  )
}

function getItemRefKey(item, fallback) {
  return (
    pickFirstString(item, ['@key', 'key', 'id', '_id']) ??
    pickFirstString(item, ['title', 'name']) ??
    fallback
  )
}

function parseNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) return Number(value)
  return undefined
}

function formatCount(count, singular, plural) {
  if (typeof count !== 'number' || count <= 0) return ''
  if (count === 1) return `1 ${singular}`
  return `${count} ${plural ?? `${singular}s`}`
}

function formatRating(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return ''
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

function formatShortDate(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date)
}

function normalizeYear(value) {
  const year = parseNumber(value)
  const maxYear = new Date().getFullYear() + 5
  if (!Number.isFinite(year)) return undefined
  if (year < 1900 || year > maxYear) return undefined
  return year
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getEnv(name) {
  const value = import.meta.env?.[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readTmdbConfig() {
  function getStored(key) {
    if (typeof window === 'undefined') return undefined
    const value = window.localStorage.getItem(key)
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  const envToken = getEnv('VITE_TMDB_READ_TOKEN')
  const envApiKey = getEnv('VITE_TMDB_API_KEY')
  const envLang = getEnv('VITE_TMDB_LANG')
  const envMode = getEnv('VITE_TMDB_AUTH_MODE')

  const storedMode = getStored('tmdb.auth.mode')
  const storedToken = getStored('tmdb.auth.token')
  const storedApiKey = getStored('tmdb.auth.key')
  const storedLang = getStored('tmdb.lang')

  const token = storedToken ?? envToken
  const apiKey = storedApiKey ?? envApiKey
  const lang = storedLang ?? envLang ?? 'pt-BR'
  const mode = storedMode ?? envMode ?? (token ? 'bearer' : apiKey ? 'apiKey' : '')

  return { token, apiKey, lang, mode }
}

function buildPosterUrl(path, size = 'w500') {
  if (!path) return ''
  return `https://image.tmdb.org/t/p/${size}${path}`
}

function scoreCandidate(queryTitle, queryYear, result) {
  const q = normalizeText(queryTitle)
  const title = normalizeText(result?.title)
  const name = normalizeText(result?.name)
  const originalTitle = normalizeText(result?.original_title)
  const originalName = normalizeText(result?.original_name)
  const candidates = [title, name, originalTitle, originalName].filter(Boolean)

  let score = 0
  if (candidates.some((t) => t === q)) score += 60
  else if (candidates.some((t) => t.startsWith(q))) score += 45
  else if (candidates.some((t) => t.includes(q))) score += 30
  else score += 10

  const yearCandidate = normalizeYear(result?.release_date?.slice?.(0, 4) ?? result?.first_air_date?.slice?.(0, 4))
  if (queryYear && yearCandidate && queryYear === yearCandidate) score += 25
  if (queryYear && yearCandidate && Math.abs(queryYear - yearCandidate) === 1) score += 12

  const voteCount = typeof result?.vote_count === 'number' ? result.vote_count : 0
  const popularity = typeof result?.popularity === 'number' ? result.popularity : 0
  score += Math.min(15, Math.log10(Math.max(1, voteCount)) * 6)
  score += Math.min(10, popularity / 50)

  return score
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const queue = Array.from(items)
  const results = []
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }).map(async () => {
    while (queue.length) {
      const next = queue.shift()
      if (!next) break
      results.push(await mapper(next))
    }
  })
  await Promise.all(workers)
  return results
}

function buildTvShowLabelMap(items) {
  const entries = Array.isArray(items) ? items : []
  return entries.reduce((acc, item) => {
    const key = getItemRefKey(item)
    const label =
      pickFirstString(item, ['title', 'name', 'tvShow', 'tvShowName', 'showName']) ??
      undefined
    if (key && label) acc[key] = label
    return acc
  }, {})
}

function getAgeBadge(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return null
  if (value >= 18) return { label: '18+', tone: '18' }
  if (value >= 16) return { label: '16+', tone: '16' }
  if (value >= 14) return { label: '14+', tone: '14' }
  if (value >= 12) return { label: '12+', tone: '12' }
  if (value >= 10) return { label: '10+', tone: '10' }
  return { label: `${value}+`, tone: 'free' }
}

function buildEpisodeCountBySeasonKey(episodes) {
  const entries = Array.isArray(episodes) ? episodes : []
  return entries.reduce((acc, item) => {
    const seasonKey = getItemRefKey(item?.season)
    if (!seasonKey) return acc
    acc[seasonKey] = (acc[seasonKey] ?? 0) + 1
    return acc
  }, {})
}

function buildSeasonInfoByKey(seasons, tvShowLabelsByKey, episodeCountBySeasonKey) {
  const entries = Array.isArray(seasons) ? seasons : []
  return entries.reduce((acc, item) => {
    const seasonKey = getItemRefKey(item)
    if (!seasonKey) return acc

    const showKey = getItemRefKey(item?.tvShow)
    const showLabel =
      (showKey ? tvShowLabelsByKey[showKey] : undefined) ??
      pickFirstString(item?.tvShow, ['title', 'name', 'tvShow', 'tvShowName', 'showName']) ??
      'Série'
    const number = parseNumber(item?.number)
    const year = normalizeYear(item?.year)

    acc[seasonKey] = {
      seasonKey,
      showKey,
      showLabel,
      number: Number.isFinite(number) ? number : undefined,
      year,
      episodeCount: episodeCountBySeasonKey[seasonKey] ?? 0
    }
    return acc
  }, {})
}

function buildTvShowStatsByKey(seasons, episodeCountBySeasonKey) {
  const entries = Array.isArray(seasons) ? seasons : []
  const stats = {}

  for (const item of entries) {
    const showKey = getItemRefKey(item?.tvShow)
    if (!showKey) continue

    if (!stats[showKey]) {
      stats[showKey] = {
        seasonCount: 0,
        episodeCount: 0,
        minYear: undefined,
        maxYear: undefined
      }
    }

    const current = stats[showKey]
    current.seasonCount += 1

    const seasonKey = getItemRefKey(item)
    if (seasonKey) current.episodeCount += episodeCountBySeasonKey[seasonKey] ?? 0

    const year = normalizeYear(item?.year)

    if (year !== undefined) {
      current.minYear = current.minYear === undefined ? year : Math.min(current.minYear, year)
      current.maxYear = current.maxYear === undefined ? year : Math.max(current.maxYear, year)
    }
  }

  return Object.entries(stats).reduce((acc, [showKey, value]) => {
    const yearLabel =
      value.minYear !== undefined
        ? value.maxYear !== undefined && value.maxYear !== value.minYear
          ? `${value.minYear}-${value.maxYear}`
          : String(value.minYear)
        : ''

    acc[showKey] = {
      seasonCount: value.seasonCount,
      episodeCount: value.episodeCount,
      yearLabel
    }
    return acc
  }, {})
}

function createEmptyDisplayContext() {
  return {
    tvShowLabelsByKey: {},
    seasonInfoByKey: {},
    tvShowStatsByKey: {}
  }
}

function normalizeSearchItems(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.result)) return payload.result
  if (payload && Array.isArray(payload.items)) return payload.items
  if (payload && payload.result && Array.isArray(payload.result.items)) return payload.result.items
  if (payload && payload.data && Array.isArray(payload.data)) return payload.data
  return []
}

async function searchAllByAssetType(api, assetType, { pageLimit = PRIMARY_LIMIT } = {}) {
  const allItems = []
  let bookmark = ''

  for (;;) {
    const query = {
      selector: { '@assetType': assetType },
      limit: pageLimit
    }

    if (bookmark) query.bookmark = bookmark

    const payload = await api.request('/query/search', { method: 'POST', body: { query } })
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

function getPrimaryLimit(assetType, overrideLimit) {
  if (typeof overrideLimit === 'number') return overrideLimit
  return assetType === ASSET_TYPES.episodes ||
    assetType === ASSET_TYPES.seasons ||
    assetType === ASSET_TYPES.tvShows
    ? PRIMARY_LIMIT
    : DEFAULT_LIMIT
}

async function loadTvShowDisplayContext(api, { loadAll = false, pageLimit = PRIMARY_LIMIT } = {}) {
  const searchFn = loadAll
    ? (assetType, limit) => searchAllByAssetType(api, assetType, { pageLimit: limit })
    : (assetType, limit) => api.searchByAssetType(assetType, { limit })

  const [seasons, episodes] = await Promise.all([
    searchFn(ASSET_TYPES.seasons, SEASONS_LIMIT),
    searchFn(ASSET_TYPES.episodes, EPISODES_LIMIT)
  ])

  const episodeCountBySeasonKey = buildEpisodeCountBySeasonKey(episodes)

  return {
    ...createEmptyDisplayContext(),
    tvShowStatsByKey: buildTvShowStatsByKey(seasons, episodeCountBySeasonKey)
  }
}

async function loadAssetTypeData(api, assetType, { primaryLimitOverride, deferTvShowStats = false, loadAll = false } = {}) {
  const primaryLimit = getPrimaryLimit(assetType, primaryLimitOverride)
  const searchFn = loadAll
    ? (targetAssetType, limit) => searchAllByAssetType(api, targetAssetType, { pageLimit: limit })
    : (targetAssetType, limit) => api.searchByAssetType(targetAssetType, { limit })

  if (assetType === ASSET_TYPES.tvShows) {
    const rows = await searchFn(ASSET_TYPES.tvShows, primaryLimit)

    if (deferTvShowStats) {
      return {
        items: Array.isArray(rows) ? rows : [],
        displayContext: createEmptyDisplayContext()
      }
    }

    return {
      items: Array.isArray(rows) ? rows : [],
      displayContext: await loadTvShowDisplayContext(api, { loadAll, pageLimit: primaryLimit })
    }
  }

  if (assetType === ASSET_TYPES.seasons) {
    const [rows, tvShows, episodes] = await Promise.all([
      searchFn(ASSET_TYPES.seasons, primaryLimit),
      searchFn(ASSET_TYPES.tvShows, TV_SHOWS_LIMIT),
      searchFn(ASSET_TYPES.episodes, EPISODES_LIMIT)
    ])

    const tvShowLabelsByKey = buildTvShowLabelMap(tvShows)
    const episodeCountBySeasonKey = buildEpisodeCountBySeasonKey(episodes)

    return {
      items: Array.isArray(rows) ? rows : [],
      displayContext: {
        ...createEmptyDisplayContext(),
        tvShowLabelsByKey,
        seasonInfoByKey: buildSeasonInfoByKey(rows, tvShowLabelsByKey, episodeCountBySeasonKey)
      }
    }
  }

  if (assetType === ASSET_TYPES.episodes) {
    const [rows, seasons, tvShows] = await Promise.all([
      searchFn(ASSET_TYPES.episodes, primaryLimit),
      searchFn(ASSET_TYPES.seasons, SEASONS_LIMIT),
      searchFn(ASSET_TYPES.tvShows, TV_SHOWS_LIMIT)
    ])

    const tvShowLabelsByKey = buildTvShowLabelMap(tvShows)

    return {
      items: Array.isArray(rows) ? rows : [],
      displayContext: {
        ...createEmptyDisplayContext(),
        tvShowLabelsByKey,
        seasonInfoByKey: buildSeasonInfoByKey(seasons, tvShowLabelsByKey, {})
      }
    }
  }

  const rows = await searchFn(assetType, primaryLimit)

  return {
    items: Array.isArray(rows) ? rows : [],
    displayContext: createEmptyDisplayContext()
  }
}

function getCardContent(assetType, item, context) {
  if (assetType === ASSET_TYPES.tvChannels) {
    const title =
      pickFirstString(item, ['title', 'name', 'channel', 'channelName', 'tvChannel', 'tvChannelName']) ??
      pickFirstString(item, ['@key']) ??
      'Canal'
    const subtitle =
      pickFirstString(item, ['description', 'category', 'genre']) ??
      pickFirstString(item, ['number', 'frequency'])
    const metaItems = []
    if (item?.number !== undefined && item?.number !== null) metaItems.push(`Canal ${item.number}`)
    return { title, subtitle, metaItems, ageBadge: null }
  }

  if (assetType === ASSET_TYPES.movies) {
    const title =
      pickFirstString(item, ['title', 'name', 'movie', 'movieTitle']) ??
      pickFirstString(item, ['@key']) ??
      'Filme'
    const subtitle = pickFirstString(item, ['description', 'genre'])
    const year = normalizeYear(item?.year ?? item?.releaseYear)
    const rating = formatRating(item?.rating)
    const metaItems = []
    if (typeof year === 'number') metaItems.push(String(year))
    if (rating) metaItems.push(`Nota ${rating}`)
    return { title, subtitle, metaItems: metaItems.filter(Boolean), ageBadge: null }
  }

  if (assetType === ASSET_TYPES.tvShows) {
    const title = pickFirstString(item, ['title']) ?? 'Série'
    const subtitle = pickFirstString(item, ['description'])
    const showKey = getItemRefKey(item)
    const stats = showKey ? context.tvShowStatsByKey[showKey] : undefined
    const metaItems = []
    if (stats?.yearLabel) metaItems.push(stats.yearLabel)
    if (stats?.seasonCount) metaItems.push(formatCount(stats.seasonCount, 'temporada'))
    if (stats?.episodeCount) metaItems.push(formatCount(stats.episodeCount, 'episódio'))
    return { title, subtitle, metaItems: metaItems.filter(Boolean), ageBadge: getAgeBadge(item?.recommendedAge) }
  }

  if (assetType === ASSET_TYPES.seasons) {
    const seasonKey = getItemRefKey(item)
    const info = seasonKey ? context.seasonInfoByKey[seasonKey] : undefined
    const seasonNumber = info?.number ?? parseNumber(item?.number)
    const title = info?.showLabel ?? pickFirstString(item?.tvShow, ['title', 'name']) ?? 'Série'
    const subtitle = seasonNumber !== undefined ? `Temporada ${seasonNumber}` : 'Temporada'
    const metaItems = []
    if (info?.year) metaItems.push(`Ano ${info.year}`)
    if (info?.episodeCount) metaItems.push(formatCount(info.episodeCount, 'episódio'))
    return { title, subtitle, metaItems: metaItems.filter(Boolean), ageBadge: null }
  }

  if (assetType === ASSET_TYPES.episodes) {
    const title = pickFirstString(item, ['title']) ?? 'Episódio'
    const seasonKey = getItemRefKey(item?.season)
    const info = seasonKey ? context.seasonInfoByKey[seasonKey] : undefined
    const episodeNumber = item?.episodeNumber
    const subtitleParts = []
    if (info?.showLabel) subtitleParts.push(info.showLabel)
    if (info?.number !== undefined) subtitleParts.push(`T${info.number}`)
    if (typeof episodeNumber === 'number') subtitleParts.push(`Ep ${episodeNumber}`)
    const metaItems = []
    const releaseDate = formatShortDate(item?.releaseDate)
    if (releaseDate) metaItems.push(releaseDate)
    const rating = formatRating(item?.rating)
    if (rating) metaItems.push(`Nota ${rating}`)
    return {
      title,
      subtitle: subtitleParts.join(' • ') || pickFirstString(item, ['description']),
      metaItems: metaItems.filter(Boolean),
      ageBadge: null
    }
  }

  if (assetType === ASSET_TYPES.watchlist) {
    const title = pickFirstString(item, ['title']) ?? 'Minha lista'
    const tvShows = item?.tvShows
    const subtitle = tvShows ? `Séries: ${toText(tvShows)}` : pickFirstString(item, ['description'])
    return { title, subtitle, metaItems: [], ageBadge: null }
  }

  const title =
    pickFirstString(item, ['label', 'tag', 'title', 'name']) ??
    pickFirstString(item, ['@key']) ??
    assetType
  const subtitle = pickFirstString(item, ['description'])
  return { title, subtitle, metaItems: [], ageBadge: null }
}

function HeartIcon({ filled }) {
  return (
    <svg className="cardFavBtn__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.5 4.9 13.9A4.9 4.9 0 0 1 12 7.4a4.9 4.9 0 0 1 7.1 6.5L12 20.5Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LoadingIcon() {
  return (
    <span className="cardFavBtn__spinner" aria-hidden="true" />
  )
}

function Card({
  title,
  subtitle,
  metaItems,
  ageBadge,
  posterUrl,
  clickable,
  isFavorite,
  isFavoriteLoading,
  canFavorite,
  favoriteDisabled,
  onOpen,
  onToggleFavorite
}) {
  const style = posterUrl
    ? {
      backgroundImage: `linear-gradient(180deg, rgba(4, 8, 14, 0.78) 0%, rgba(4, 8, 14, 0.34) 18%, rgba(4, 8, 14, 0.08) 34%, rgba(4, 8, 14, 0) 46%), linear-gradient(180deg, rgba(0, 0, 0, 0) 48%, rgba(0, 0, 0, 0.88) 100%), url(${posterUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
    : undefined

  function handleKeyDown(event) {
    if (!clickable) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpen?.()
  }

  return (
    <article
      className={`card ${clickable ? 'card--clickable' : ''}`}
      style={style}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={handleKeyDown}
    >
      {canFavorite ? (
        <button
          type="button"
          className={`cardFavBtn ${isFavorite ? 'cardFavBtn--active' : ''}`}
          aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite?.()
          }}
          disabled={favoriteDisabled}
        >
          {isFavoriteLoading ? <LoadingIcon /> : <HeartIcon filled={isFavorite} />}
        </button>
      ) : null}
      <div className="card__body">
        <div className="card__header">
          <div className="card__title" title={title}>{title}</div>
          {ageBadge ? (
            <span className={`card__ageBadge card__ageBadge--${ageBadge.tone}`} aria-label={`Classificação ${ageBadge.label}`}>
              {ageBadge.label}
            </span>
          ) : null}
        </div>
        <div className={`card__meta ${metaItems?.length ? '' : 'card__meta--empty'}`}>
          {metaItems?.map((item, index) => (
            <span key={`${item}-${index}`} className="card__metaTag">{item}</span>
          ))}
        </div>
        <div className={`card__subtitle ${subtitle ? '' : 'card__subtitle--empty'}`}>
          {subtitle || ' '}
        </div>
      </div>
    </article>
  )
}

function SkeletonCard() {
  return (
    <div className="card card--skeleton" aria-hidden="true">
      <div className="card__body card__body--skeleton">
        <div className="card__header card__header--skeleton">
          <span className="skeletonBlock skeletonBlock--title" />
          <span className="skeletonBlock skeletonBlock--badge" />
        </div>
        <div className="card__meta card__meta--skeleton">
          <span className="skeletonChip" />
          <span className="skeletonChip skeletonChip--short" />
        </div>
        <div className="card__subtitle card__subtitle--skeleton">
          <span className="skeletonLine" />
          <span className="skeletonLine skeletonLine--short" />
          <span className="skeletonLine skeletonLine--tiny" />
        </div>
      </div>
    </div>
  )
}

function buildFavoriteIds(rows) {
  const ids = new Set()

  for (const row of Array.isArray(rows) ? rows : []) {
    const tvShows = row?.tvShows

    if (Array.isArray(tvShows)) {
      for (const entry of tvShows) {
        const refKey = entry?.['@key']
        if (typeof refKey === 'string' && refKey.trim()) {
          ids.add(`${ASSET_TYPES.tvShows}:${refKey.trim()}`)
        }
      }
    }

    const description = pickFirstString(row, ['description'])
    if (description && description.startsWith(WATCHLIST_REF_PREFIX)) {
      const token = description.slice(WATCHLIST_REF_PREFIX.length).trim()
      if (token) ids.add(token)
    }

    const title = pickFirstString(row, ['title'])
    if (title) ids.add(`title:${title}`)
  }

  return ids
}

function findMatchingWatchlistItem(rows, itemId, fallbackTitle) {
  const entries = Array.isArray(rows) ? rows : []

  return (
    entries.find((row) => {
      const tvShows = row?.tvShows

      if (Array.isArray(tvShows)) {
        for (const entry of tvShows) {
          const refKey = entry?.['@key']
          if (typeof refKey === 'string' && `${ASSET_TYPES.tvShows}:${refKey.trim()}` === itemId) {
            return true
          }
        }
      }

      const description = pickFirstString(row, ['description'])
      if (description && description.startsWith(WATCHLIST_REF_PREFIX)) {
        const token = description.slice(WATCHLIST_REF_PREFIX.length).trim()
        if (token && token === itemId) return true
      }

      const title = pickFirstString(row, ['title'])
      return title ? `title:${title}` === itemId : false
    }) ??
    entries.find((row) => pickFirstString(row, ['title']) === fallbackTitle) ??
    null
  )
}

async function loadFavoritesSnapshot(api) {
  if (favoritesCache.ids instanceof Set) return new Set(favoritesCache.ids)
  if (!favoritesCache.promise) {
    favoritesCache.promise = api
      .searchByAssetType(ASSET_TYPES.watchlist, { limit: WATCHLIST_LIMIT })
      .then((rows) => {
        const ids = buildFavoriteIds(rows)
        favoritesCache.ids = ids
        return new Set(ids)
      })
      .finally(() => {
        favoritesCache.promise = null
      })
  }

  return favoritesCache.promise.then((ids) => new Set(ids))
}

function scheduleWhenBrowserIdle(callback) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 800 })
    return () => window.cancelIdleCallback(id)
  }

  const timeoutId = window.setTimeout(callback, 140)
  return () => window.clearTimeout(timeoutId)
}

export function AssetTypeSectionSkeleton({ label = 'Carregando' }) {
  const safeId = `loading-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <Section id={safeId} titulo={label} action={<span className="muted">Carregando...</span>}>
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </Section>
  )
}

function BatchCarousel({ label, children }) {
  const railRef = useRef(null)

  function scrollByPages(direction) {
    const el = railRef.current
    if (!el) return
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.9))
    el.scrollBy({ left: direction * amount, behavior: 'smooth' })
  }

  return (
    <div className="sectionRow" aria-label={label}>
      <button
        type="button"
        className="sectionRow__btn sectionRow__btn--left"
        onClick={() => scrollByPages(-1)}
        aria-label={`Voltar em ${label}`}
      />
      <button
        type="button"
        className="sectionRow__btn sectionRow__btn--right"
        onClick={() => scrollByPages(1)}
        aria-label={`Avancar em ${label}`}
      />
      <div ref={railRef} className="sectionRow__rail">
        {children}
      </div>
    </div>
  )
}

export default function AssetTypeSection({
  assetType,
  label,
  searchText,
  enableTmdbPosters = false,
  performanceProfile = 'default'
}) {
  const api = useMemo(() => createGoLedgerApi(), [])
  const sectionProfile = useMemo(() => getSectionLoadProfile(performanceProfile), [performanceProfile])
  const cacheKey = `${assetType}:${sectionProfile.cacheKey}`
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [displayContext, setDisplayContext] = useState(() => createEmptyDisplayContext())
  const [favoritesStatus, setFavoritesStatus] = useState('idle')
  const [favoriteIds, setFavoriteIds] = useState(() => new Set())
  const [favoriteBusyId, setFavoriteBusyId] = useState('')
  const [posterByKey, setPosterByKey] = useState(() => ({}))
  const [tmdbConfig, setTmdbConfig] = useState(() => readTmdbConfig())
  const [visibleBatchCount, setVisibleBatchCount] = useState(() => (sectionProfile.progressiveBatchSize ? 1 : 0))

  const canFavorite =
    assetType !== ASSET_TYPES.watchlist && assetType !== ASSET_TYPES.assetTypeListData

  function openDetail(item, title) {
    if (assetType !== ASSET_TYPES.tvShows) return
    if (typeof window === 'undefined') return
    const refKey = getItemRefKey(item, title)
    if (!refKey) return
    const detailOrigin = enableTmdbPosters ? 'inicio2' : 'inicio1'
    window.location.hash = `/serie/${encodeURIComponent(refKey)}?origem=${detailOrigin}`
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  async function load() {
    const cachedData = assetTypeDataCache.get(cacheKey)
    if (cachedData) {
      setItems(cachedData.items)
      setDisplayContext(cachedData.displayContext)
      setStatus('success')
      setError('')
      return
    }

    setStatus('loading')
    setError('')

    try {
      const data = await loadAssetTypeData(api, assetType, {
        primaryLimitOverride: sectionProfile.initialLimit,
        deferTvShowStats: sectionProfile.deferTvShowStats,
        loadAll: sectionProfile.loadAll
      })
      assetTypeDataCache.set(cacheKey, data)
      setItems(data.items)
      setDisplayContext(data.displayContext)
      setStatus('success')
    } catch (loadError) {
      setItems([])
      setDisplayContext(createEmptyDisplayContext())
      setStatus('error')
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar dados')
    }
  }

  async function loadFavorites() {
    setFavoritesStatus('loading')

    try {
      const ids = await loadFavoritesSnapshot(api)
      setFavoriteIds(ids)
      setFavoritesStatus('success')
    } catch {
      setFavoriteIds(new Set())
      setFavoritesStatus('error')
    }
  }

  useEffect(() => {
    load()
  }, [assetType, cacheKey])

  useEffect(() => {
    setPosterByKey({})
  }, [assetType])

  useEffect(() => {
    if (!sectionProfile.deferTvShowStats || assetType !== ASSET_TYPES.tvShows) return
    if (status !== 'success' || items.length === 0) return
    if (Object.keys(displayContext.tvShowStatsByKey).length > 0) return

    let cancelled = false

    async function enrichTvShowStats() {
      try {
        const cachedStats = tvShowStatsCache.get(cacheKey)
        if (cachedStats) {
          if (!cancelled) setDisplayContext(cachedStats)
          assetTypeDataCache.set(cacheKey, { items, displayContext: cachedStats })
          return
        }

        let pending = tvShowStatsPromiseCache.get(cacheKey)
        if (!pending) {
            pending = loadTvShowDisplayContext(api, {
              loadAll: sectionProfile.loadAll,
              pageLimit: sectionProfile.initialLimit ?? PRIMARY_LIMIT
            })
            .then((context) => {
              tvShowStatsCache.set(cacheKey, context)
              return context
            })
            .finally(() => {
              tvShowStatsPromiseCache.delete(cacheKey)
            })
          tvShowStatsPromiseCache.set(cacheKey, pending)
        }

        const nextDisplayContext = await pending
        if (cancelled) return
        setDisplayContext(nextDisplayContext)
        assetTypeDataCache.set(cacheKey, { items, displayContext: nextDisplayContext })
      } catch {
        return
      }
    }

    enrichTvShowStats()

    return () => {
      cancelled = true
    }
  }, [api, assetType, cacheKey, displayContext, items, sectionProfile.deferTvShowStats, sectionProfile.initialLimit, sectionProfile.loadAll, status])

  useEffect(() => {
    if (!canFavorite) return
    loadFavorites()
  }, [canFavorite])

  const filteredItems = useMemo(() => {
    const q = (searchText ?? '').trim().toLowerCase()
    if (!q) return items

    return items.filter((item) => {
      const { title, subtitle, metaItems = [], ageBadge } = getCardContent(assetType, item, displayContext)
      const haystack = [title, subtitle, metaItems.join(' '), ageBadge?.label].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [assetType, displayContext, items, searchText])

  const renderedItems = useMemo(() => {
    if (!sectionProfile.progressiveBatchSize) {
      const hardLimit = typeof sectionProfile.maxRenderedItems === 'number' ? sectionProfile.maxRenderedItems : filteredItems.length
      return filteredItems.slice(0, hardLimit)
    }
    return filteredItems
  }, [filteredItems, sectionProfile.maxRenderedItems, sectionProfile.progressiveBatchSize])

  const renderedBatches = useMemo(() => {
    if (!sectionProfile.progressiveBatchSize) return [renderedItems]

    const batches = []
    for (let index = 0; index < renderedItems.length; index += sectionProfile.progressiveBatchSize) {
      batches.push(renderedItems.slice(index, index + sectionProfile.progressiveBatchSize))
    }
    return batches
  }, [renderedItems, sectionProfile.progressiveBatchSize])

  const visibleBatches = useMemo(() => {
    if (!sectionProfile.progressiveBatchSize) return renderedBatches
    return renderedBatches.slice(0, visibleBatchCount)
  }, [renderedBatches, sectionProfile.progressiveBatchSize, visibleBatchCount])

  const hasPendingBatches =
    sectionProfile.progressiveBatchSize > 0 &&
    visibleBatches.length < renderedBatches.length

  const visibleItems = useMemo(() => {
    if (!sectionProfile.progressiveBatchSize) return renderedItems
    return visibleBatches.flat()
  }, [renderedItems, sectionProfile.progressiveBatchSize, visibleBatches])

  useEffect(() => {
    if (!sectionProfile.progressiveBatchSize) return
    setVisibleBatchCount(renderedBatches.length > 0 ? 1 : 0)
  }, [assetType, renderedBatches.length, searchText, sectionProfile.progressiveBatchSize])

  useEffect(() => {
    if (!sectionProfile.progressiveBatchSize) return undefined
    if (status !== 'success') return undefined
    if (!hasPendingBatches) return undefined

    const timeoutId = window.setTimeout(() => {
      setVisibleBatchCount((current) => Math.min(renderedBatches.length, current + 1))
    }, HOME_RENDER_APPEND_DELAY)

    return () => window.clearTimeout(timeoutId)
  }, [hasPendingBatches, renderedBatches.length, sectionProfile.progressiveBatchSize, status, visibleBatchCount])

  useEffect(() => {
    if (status !== 'error') return undefined

    const timeoutId = window.setTimeout(() => {
      load()
    }, LOAD_RETRY_DELAY)

    return () => window.clearTimeout(timeoutId)
  }, [assetType, cacheKey, status])

  useEffect(() => {
    if (!enableTmdbPosters) return
    if (typeof window === 'undefined') return

    function refresh() {
      setTmdbConfig(readTmdbConfig())
    }

    function handleStorage(event) {
      if (!event?.key) return
      if (!String(event.key).startsWith('tmdb.')) return
      refresh()
    }

    refresh()
    window.addEventListener('storage', handleStorage)
    window.addEventListener(TMDB_CONFIG_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(TMDB_CONFIG_EVENT, refresh)
    }
  }, [enableTmdbPosters])

  const tmdbEnabled =
    enableTmdbPosters &&
    (assetType === ASSET_TYPES.movies || assetType === ASSET_TYPES.tvShows) &&
    ((tmdbConfig.mode === 'bearer' && Boolean(tmdbConfig.token)) || (tmdbConfig.mode === 'apiKey' && Boolean(tmdbConfig.apiKey)))

  useEffect(() => {
    let cancelled = false

    async function tmdbRequest(path, params) {
      const url = new URL(`https://api.themoviedb.org/3${path}`)
      const p = new URLSearchParams()
      Object.entries(params ?? {}).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return
        p.set(k, String(v))
      })
      if (tmdbConfig.mode === 'apiKey') p.set('api_key', String(tmdbConfig.apiKey ?? '').trim())
      url.search = p.toString()

      const headers = { accept: 'application/json' }
      if (tmdbConfig.mode === 'bearer') headers.authorization = `Bearer ${String(tmdbConfig.token ?? '').trim()}`

      const res = await fetch(url.toString(), { method: 'GET', headers })
      if (!res.ok) return null
      return res.json()
    }

    function getFirstThreeWords(value) {
      const words = String(value ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
      if (words.length <= 3) return ''
      return words.slice(0, 3).join(' ')
    }

    async function findBestPoster(kind, title, year) {
      const lookupKey = `${kind}:${normalizeText(title)}:${year ?? ''}`
      if (tmdbPosterCache.has(lookupKey)) return tmdbPosterCache.get(lookupKey)
      if (tmdbPosterPromiseCache.has(lookupKey)) return tmdbPosterPromiseCache.get(lookupKey)

      async function search(query) {
        const q = String(query ?? '').trim()
        if (!q) return ''
        const isMovie = kind === 'movie'
        const payload = await tmdbRequest(isMovie ? '/search/movie' : '/search/tv', {
          query: q,
          include_adult: 'false',
          language: tmdbConfig.lang || 'pt-BR',
          page: 1,
          ...(isMovie ? { year } : { first_air_date_year: year })
        })
        const results = Array.isArray(payload?.results) ? payload.results : []
        if (!results.length) return ''

        let best = null
        let bestScore = -Infinity
        for (const r of results) {
          const score = scoreCandidate(q, year, r)
          if (score > bestScore) {
            best = r
            bestScore = score
          }
        }
        const posterPath = best?.poster_path ?? best?.backdrop_path ?? ''
        return posterPath ? buildPosterUrl(posterPath) : ''
      }

      const request = (async () => {
        const full = await search(title)
        if (full) return full
        const short = getFirstThreeWords(title)
        if (!short) return ''
        return search(short)
      })()

      tmdbPosterPromiseCache.set(lookupKey, request)

      try {
        const posterUrl = await request
        tmdbPosterCache.set(lookupKey, posterUrl)
        return posterUrl
      } finally {
        tmdbPosterPromiseCache.delete(lookupKey)
      }
    }

    async function run() {
      if (!tmdbEnabled) return
      if (status !== 'success' && status !== 'loading') return

      const visible =
        sectionProfile.progressiveBatchSize > 0
          ? visibleItems
          : visibleItems.slice(0, sectionProfile.posterSearchItems)
      const kind = assetType === ASSET_TYPES.movies ? 'movie' : 'tv'

      const tasks = visible
        .map((item, index) => {
          const { title } = getCardContent(assetType, item, displayContext)
          const year =
            assetType === ASSET_TYPES.movies
              ? normalizeYear(item?.year ?? item?.releaseYear)
              : undefined
          const key = getItemKey(item, `${assetType}-${index}`)
          return { title, year, key }
        })
        .filter((t) => t.key && !posterByKey[t.key])

      if (!tasks.length) return

      await mapWithConcurrency(tasks, 4, async (t) => {
        const posterUrl = await findBestPoster(kind, t.title, t.year)
        if (cancelled) return
        if (!posterUrl) return
        setPosterByKey((prev) => (prev[t.key] ? prev : { ...prev, [t.key]: posterUrl }))
      })
    }

    const cancelIdleRun = scheduleWhenBrowserIdle(() => {
      run()
    })

    return () => {
      cancelled = true
      cancelIdleRun()
    }
  }, [assetType, displayContext, posterByKey, sectionProfile.posterSearchItems, status, tmdbConfig, tmdbEnabled, visibleItems])

  function getFavoriteIdForItem(item, title) {
    const refKey = getItemRefKey(item, title)
    if (refKey) return `${assetType}:${refKey}`
    return `title:${title}`
  }

  function getWatchlistTitleForItem(title) {
    return title
  }

  function getRefTokenForItem(item, title) {
    const refKey = getItemRefKey(item, title)
    if (refKey) return `${assetType}:${refKey}`
    return `title:${title}`
  }

  async function removeFromFavoritesById(itemId, fallbackTitle) {
    const rows = await api.searchByAssetType(ASSET_TYPES.watchlist, { limit: WATCHLIST_LIMIT })
    const match = findMatchingWatchlistItem(rows, itemId, fallbackTitle)

    if (!match) return
    const rawKey = pickFirstString(match, ['@key', 'key', 'id', '_id'])
    const title = pickFirstString(match, ['title'])
    const keyCandidates = []

    if (rawKey) keyCandidates.push({ '@assetType': ASSET_TYPES.watchlist, '@key': rawKey })
    if (title) keyCandidates.push({ '@assetType': ASSET_TYPES.watchlist, title })

    let lastError = null

    for (const key of keyCandidates) {
      try {
        await api.request('/invoke/deleteAsset', { method: 'DELETE', body: { key } })
        return
      } catch (e) {
        lastError = e
      }
    }
    if (lastError) throw lastError
  }

  async function addToFavorites(item, title) {
    const refKey = getItemRefKey(item, title)
    const payload = {
      '@assetType': ASSET_TYPES.watchlist,
      title: getWatchlistTitleForItem(title),
      description: `${WATCHLIST_REF_PREFIX}${getRefTokenForItem(item, title)}`
    }

    if (assetType === ASSET_TYPES.tvShows && refKey) {
      payload.tvShows = [buildReference(ASSET_TYPES.tvShows, refKey)]
    }

    await api.request('/invoke/createAsset', { method: 'POST', body: { asset: [payload] } })
  }

  async function toggleFavoriteForItem(item, title) {
    const itemId = getFavoriteIdForItem(item, title)
    if (!itemId) return
    setFavoriteBusyId(itemId)
    try {
      if (favoriteIds.has(itemId)) {
        await removeFromFavoritesById(itemId, getWatchlistTitleForItem(title))
      } else {
        await addToFavorites(item, title)
      }
      favoritesCache.ids = null
      await loadFavorites()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(FAVORITES_EVENT))
      }
    } catch {
      setFavoritesStatus('error')
    } finally {
      setFavoriteBusyId('')
    }
  }

  const action = useMemo(() => {
    if (status === 'error') {
      return <span className="muted">Nova tentativa em 10s...</span>
    }
    if (sectionProfile.progressiveBatchSize) return null
    if (status === 'loading') return <span className="muted">Carregando...</span>
    return <span className="muted">{filteredItems.length} itens</span>
  }, [status, filteredItems.length, sectionProfile.progressiveBatchSize])

  if (status === 'success' && items.length === 0) return null

  return (
    <Section
      id={assetType}
      titulo={label ?? assetType}
      action={action}
      layout={sectionProfile.progressiveBatchSize ? 'stacked' : 'carousel'}
    >
      {status === 'loading' && sectionProfile.progressiveBatchSize ? (
        <BatchCarousel label={`${label ?? assetType} em carregamento`}>
          {Array.from({ length: sectionProfile.progressiveBatchSize }).map((_, index) => (
            <SkeletonCard key={`loading-${index}`} />
          ))}
        </BatchCarousel>
      ) : null}

      {status === 'loading' && !sectionProfile.progressiveBatchSize
        ? Array.from({ length: SKELETON_COUNT }).map((_, i) => <SkeletonCard key={i} />)
        : null}

      {status === 'error' ? (
        <div className="alert" role="alert">
          <div className="alert__title">Falha ao buscar dados</div>
          <div className="alert__text">{error}</div>
        </div>
      ) : null}

      {status === 'success' && filteredItems.length === 0 ? (
        <div className="empty">Sem registros</div>
      ) : null}

      {status === 'success' && sectionProfile.progressiveBatchSize
        ? (
          <>
            {visibleBatches.map((batch, batchIndex) => (
              <BatchCarousel key={`${assetType}-batch-${batchIndex}`} label={`${label ?? assetType} lote ${batchIndex + 1}`}>
                {batch.map((item, index) => {
                  const absoluteIndex = batchIndex * sectionProfile.progressiveBatchSize + index
                  const { title, subtitle, metaItems, ageBadge } = getCardContent(assetType, item, displayContext)
                  const favoriteId = canFavorite ? getFavoriteIdForItem(item, title) : ''
                  const isFavorite = canFavorite ? favoriteIds.has(favoriteId) : false
                  const isFavoriteLoading = canFavorite ? favoriteBusyId === favoriteId : false
                  const favoriteDisabled =
                    !canFavorite ||
                    favoritesStatus !== 'success' ||
                    status === 'loading' ||
                    favoriteId === '' ||
                    favoriteBusyId === favoriteId
                  const clickable = assetType === ASSET_TYPES.tvShows
                  const key = getItemKey(item, `${assetType}-${absoluteIndex}`)
                  const posterUrl = tmdbEnabled ? posterByKey[key] : ''

                  return (
                    <Card
                      key={key}
                      title={title}
                      subtitle={subtitle}
                      metaItems={metaItems}
                      ageBadge={ageBadge}
                      posterUrl={posterUrl}
                      clickable={clickable}
                      isFavorite={isFavorite}
                      isFavoriteLoading={isFavoriteLoading}
                      canFavorite={canFavorite}
                      favoriteDisabled={favoriteDisabled}
                      onOpen={() => openDetail(item, title)}
                      onToggleFavorite={() => toggleFavoriteForItem(item, title)}
                    />
                  )
                })}
              </BatchCarousel>
            ))}

            {hasPendingBatches ? (
              <BatchCarousel label={`${label ?? assetType} proximo lote`}>
                {Array.from({
                  length: Math.min(
                    sectionProfile.progressiveBatchSize,
                    filteredItems.length - visibleItems.length
                  )
                }).map((_, index) => (
                  <SkeletonCard key={`pending-${index}`} />
                ))}
              </BatchCarousel>
            ) : null}
          </>
        )
        : null}

      {status === 'success' && !sectionProfile.progressiveBatchSize
        ? renderedItems.map((item, index) => {
          const { title, subtitle, metaItems, ageBadge } = getCardContent(assetType, item, displayContext)
          const favoriteId = canFavorite ? getFavoriteIdForItem(item, title) : ''
          const isFavorite = canFavorite ? favoriteIds.has(favoriteId) : false
          const isFavoriteLoading = canFavorite ? favoriteBusyId === favoriteId : false
          const favoriteDisabled =
            !canFavorite ||
            favoritesStatus !== 'success' ||
            status === 'loading' ||
            favoriteId === '' ||
            favoriteBusyId === favoriteId
          const clickable = assetType === ASSET_TYPES.tvShows
          const key = getItemKey(item, `${assetType}-${index}`)
          const posterUrl = tmdbEnabled ? posterByKey[key] : ''

          return (
            <Card
              key={key}
              title={title}
              subtitle={subtitle}
              metaItems={metaItems}
              ageBadge={ageBadge}
              posterUrl={posterUrl}
              clickable={clickable}
              isFavorite={isFavorite}
              isFavoriteLoading={isFavoriteLoading}
              canFavorite={canFavorite}
              favoriteDisabled={favoriteDisabled}
              onOpen={() => openDetail(item, title)}
              onToggleFavorite={() => toggleFavoriteForItem(item, title)}
            />
          )
        })
        : null}
    </Section>
  )
}
