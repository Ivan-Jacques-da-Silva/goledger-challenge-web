import { useEffect, useMemo, useState } from 'react'
import { createGoLedgerApi } from '../api/goledgerApi.js'

function getEnv(name) {
  const value = import.meta.env?.[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function pickFirstString(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function getItemRefKey(item, fallback) {
  return (
    pickFirstString(item, ['@key', 'key', 'id', '_id']) ??
    pickFirstString(item, ['title', 'name']) ??
    fallback
  )
}

function formatCount(count, singular, plural) {
  if (typeof count !== 'number' || count <= 0) return ''
  if (count === 1) return `1 ${singular}`
  return `${count} ${plural ?? `${singular}s`}`
}

function formatRating(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Sem nota'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

function formatDate(value) {
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
  const year =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : undefined
  const maxYear = new Date().getFullYear() + 5
  if (!Number.isFinite(year)) return undefined
  if (year < 1900 || year > maxYear) return undefined
  return year
}

function buildPosterPalette(seed) {
  const source = typeof seed === 'string' ? seed : 'serie'
  let hash = 0
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360
  return {
    accent: `hsl(${hue} 78% 56%)`,
    accentSoft: `hsl(${(hue + 24) % 360} 72% 36%)`,
    accentGlow: `hsla(${hue} 88% 62% / 0.28)`
  }
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

function buildPosterMonogram(title) {
  if (typeof title !== 'string' || !title.trim()) return 'TV'
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function buildPosterUrl(path, size = 'w780') {
  if (!path) return ''
  return `https://image.tmdb.org/t/p/${size}${path}`
}

function OutlineStarIcon() {
  return (
    <svg className="detailRating__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.75l2.55 5.17 5.7.83-4.13 4.03.97 5.68L12 16.78l-5.09 2.68.97-5.68-4.13-4.03 5.7-.83L12 3.75Z" />
    </svg>
  )
}

function scoreCandidate(queryTitle, queryYear, result) {
  const q = normalizeText(queryTitle)
  const title = normalizeText(result?.name)
  const originalTitle = normalizeText(result?.original_name)
  const candidates = [title, originalTitle].filter(Boolean)

  let score = 0
  if (candidates.some((t) => t === q)) score += 60
  else if (candidates.some((t) => t.startsWith(q))) score += 45
  else if (candidates.some((t) => t.includes(q))) score += 30
  else score += 10

  const yearCandidate = normalizeYear(result?.first_air_date?.slice?.(0, 4))
  if (queryYear && yearCandidate && queryYear === yearCandidate) score += 25
  if (queryYear && yearCandidate && Math.abs(queryYear - yearCandidate) === 1) score += 12

  const voteCount = typeof result?.vote_count === 'number' ? result.vote_count : 0
  const popularity = typeof result?.popularity === 'number' ? result.popularity : 0
  score += Math.min(15, Math.log10(Math.max(1, voteCount)) * 6)
  score += Math.min(10, popularity / 50)

  return score
}

export default function TvShowDetailPage({ tvShowKey, detailOrigin = '' }) {
  const api = useMemo(() => createGoLedgerApi(), [])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [posterUrl, setPosterUrl] = useState('')
  const [reloadSeq, setReloadSeq] = useState(0)

  const tmdbConfig = useMemo(() => {
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
  }, [])

  const shouldShowExternalPoster = detailOrigin === 'inicio2'
  const tmdbEnabled =
    shouldShowExternalPoster &&
    (
      (tmdbConfig.mode === 'bearer' && Boolean(tmdbConfig.token)) ||
      (tmdbConfig.mode === 'apiKey' && Boolean(tmdbConfig.apiKey))
    )

  useEffect(() => {
    let cancelled = false

    async function sleep(ms) {
      if (!ms) return
      await new Promise((resolve) => window.setTimeout(resolve, ms))
    }

    function normalizeSearchItems(payload) {
      if (Array.isArray(payload)) return payload
      if (payload && Array.isArray(payload.result)) return payload.result
      if (payload && Array.isArray(payload.items)) return payload.items
      if (payload && payload.result && Array.isArray(payload.result.items)) return payload.result.items
      if (payload && payload.data && Array.isArray(payload.data)) return payload.data
      return []
    }

    function pickCreatedAsset(response) {
      if (Array.isArray(response?.value) && response.value.length > 0) return response.value[0]
      if (response?.value && typeof response.value === 'object') return response.value
      if (Array.isArray(response?.result) && response.result.length > 0) return response.result[0]
      if (response?.result && typeof response.result === 'object') return response.result
      return response
    }

    async function readTvShowByKeyOrTitle(keyOrTitle) {
      const raw = String(keyOrTitle ?? '').trim()
      if (!raw) return null
      try {
        const payload = await api.request('/query/readAsset', {
          method: 'POST',
          body: { key: { '@assetType': 'tvShows', '@key': raw } }
        })
        const item = pickCreatedAsset(payload)
        return item && typeof item === 'object' ? item : null
      } catch {}

      try {
        const payload = await api.request('/query/readAsset', {
          method: 'POST',
          body: { key: { '@assetType': 'tvShows', title: raw } }
        })
        const item = pickCreatedAsset(payload)
        return item && typeof item === 'object' ? item : null
      } catch {}

      return null
    }

    async function searchAllPages(selector, { pageLimit = 500, onItems } = {}) {
      const safeLimit = Math.max(1, Math.floor(Number(pageLimit) || 1))
      let bookmark = ''

      for (;;) {
        const query = { selector, limit: safeLimit }
        if (bookmark) query.bookmark = bookmark

        const payload = await api.request('/query/search', { method: 'POST', body: { query } })
        const items = normalizeSearchItems(payload)
        if (typeof onItems === 'function') onItems(items)

        const nextBookmark = typeof payload?.metadata?.bookmark === 'string' ? payload.metadata.bookmark.trim() : ''
        if (!nextBookmark || nextBookmark === 'nil' || nextBookmark === bookmark || items.length === 0) {
          break
        }
        bookmark = nextBookmark
      }
    }

    async function runTasksWithConcurrencyLimit(taskFns, limit = 4) {
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

    async function load() {
      setStatus('loading')
      setError('')
      try {
        const attemptDelays = [0, 450, 1200]
        let lastError = null
        let show = null

        for (const delay of attemptDelays) {
          if (cancelled) return
          lastError = null
          if (delay) await sleep(delay)
          try {
            show = await readTvShowByKeyOrTitle(tvShowKey)
            if (!show) throw new Error('Serie nao encontrada.')
            break
          } catch (e) {
            lastError = e
          }
        }

        if (lastError) throw lastError

        if (cancelled) return

        if (!show) {
          setDetail(null)
          setStatus('error')
          setError('Serie nao encontrada.')
          return
        }

        const resolvedShowKey = getItemRefKey(show, tvShowKey)
        const linkedSeasons = []
        await searchAllPages(
          { '@assetType': 'seasons', 'tvShow.@key': resolvedShowKey },
          {
            pageLimit: 500,
            onItems: (items) => {
              linkedSeasons.push(...items)
            }
          }
        )
        linkedSeasons.sort((a, b) => {
          const aNumber = typeof a?.number === 'number' ? a.number : 0
          const bNumber = typeof b?.number === 'number' ? b.number : 0
          return aNumber - bNumber
        })

        const episodeCountBySeasonKey = {}
        let ratingSum = 0
        let ratingCount = 0
        let episodeCount = 0

        const seasonKeys = linkedSeasons.map((item) => getItemRefKey(item)).filter(Boolean)
        const episodeTasks = seasonKeys.map((seasonKey) => async () => {
          if (cancelled) return
          await searchAllPages(
            { '@assetType': 'episodes', 'season.@key': seasonKey },
            {
              pageLimit: 700,
              onItems: (items) => {
                episodeCountBySeasonKey[seasonKey] = (episodeCountBySeasonKey[seasonKey] ?? 0) + items.length
                episodeCount += items.length
                for (const item of items) {
                  if (typeof item?.rating === 'number' && item.rating > 0) {
                    ratingSum += item.rating
                    ratingCount += 1
                  }
                }
              }
            }
          )
        })
        await runTasksWithConcurrencyLimit(episodeTasks, 4)

        const averageRating = ratingCount ? ratingSum / ratingCount : null

        const seasonYears = linkedSeasons.map((item) => normalizeYear(item?.year)).filter((value) => value !== undefined)
        const firstYear = seasonYears.length ? Math.min(...seasonYears) : undefined
        const lastYear = seasonYears.length ? Math.max(...seasonYears) : undefined
        const yearLabel =
          firstYear !== undefined
            ? lastYear !== undefined && lastYear !== firstYear
              ? `${firstYear}-${lastYear}`
              : String(firstYear)
            : ''

        setPosterUrl('')
        setDetail({
          show,
          seasonCount: linkedSeasons.length,
          episodeCount,
          averageRating,
          yearLabel,
          firstYear,
          updatedAt: pickFirstString(show, ['@lastUpdated']),
          ageBadge: getAgeBadge(show?.recommendedAge),
          seasonsPreview: linkedSeasons.slice(0, 4).map((item) => ({
            key: getItemRefKey(item),
            label: `Temporada ${item?.number ?? '?'} • ${formatCount(episodeCountBySeasonKey[getItemRefKey(item)] ?? 0, 'EP', 'EPs') || '0 EP'}`
          }))
        })
        setStatus('success')
      } catch (e) {
        if (cancelled) return
        setDetail(null)
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Erro ao carregar detalhes da serie.')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [api, tvShowKey, reloadSeq])

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

    function getFirstTwoWords(value) {
      const words = String(value ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
      if (words.length <= 2) return ''
      return words.slice(0, 2).join(' ')
    }

    async function run() {
      if (!shouldShowExternalPoster) {
        setPosterUrl('')
        return
      }
      if (!tmdbEnabled) return
      if (status !== 'success') return
      const title = pickFirstString(detail?.show, ['title']) ?? ''
      async function search(query) {
        const q = String(query ?? '').trim()
        if (!q) return ''

        const payload = await tmdbRequest('/search/tv', {
          query: q,
          include_adult: 'false',
          language: tmdbConfig.lang || 'pt-BR',
          page: 1,
          first_air_date_year: detail?.firstYear
        })
        if (cancelled) return ''
        const results = Array.isArray(payload?.results) ? payload.results : []
        if (!results.length) return ''

        let best = null
        let bestScore = -Infinity
        for (const r of results) {
          const score = scoreCandidate(q, detail?.firstYear, r)
          if (score > bestScore) {
            best = r
            bestScore = score
          }
        }
        const posterPath = best?.poster_path ?? best?.backdrop_path ?? ''
        return posterPath ? buildPosterUrl(posterPath) : ''
      }

      const full = await search(title)
      if (full) {
        setPosterUrl(full)
        return
      }

      const short = getFirstTwoWords(title)
      if (!short) return
      const fallback = await search(short)
      if (!fallback) return
      setPosterUrl(fallback)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [detail, shouldShowExternalPoster, status, tmdbConfig, tmdbEnabled])
  
  useEffect(() => {
    if (shouldShowExternalPoster) return
    setPosterUrl('')
  }, [shouldShowExternalPoster, tvShowKey])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const baseTitle = 'Filmes e Series'
    if (status === 'success' && detail?.show) {
      const title = pickFirstString(detail.show, ['title']) ?? 'Serie'
      document.title = `${title} | ${baseTitle}`
      return
    }
    document.title = `Detalhe da serie | ${baseTitle}`
  }, [detail, status])

  function handleBack() {
    if (typeof window === 'undefined') return
    window.location.hash = detailOrigin === 'inicio2' ? '/inicio2' : ''
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  function handleRetry() {
    setReloadSeq((prev) => prev + 1)
  }

  const posterPalette = useMemo(() => buildPosterPalette(pickFirstString(detail?.show, ['title']) ?? tvShowKey), [detail, tvShowKey])

  if (status === 'loading') {
    return (
      <main className="detailPage">
        <div className="container container-xxl detailPage__inner">
          <div className="detailPage__toolbar">
            <button type="button" className="btn btn--outline btn--sm" onClick={handleBack}>
              Voltar
            </button>
          </div>
          <div className="muted">Carregando detalhe da serie...</div>
        </div>
      </main>
    )
  }

  if (status === 'error' || !detail?.show) {
    return (
      <main className="detailPage">
        <div className="container container-xxl detailPage__inner">
          <div className="detailPage__toolbar">
            <button type="button" className="btn btn--outline btn--sm" onClick={handleBack}>
              Voltar
            </button>
          </div>
          <div className="alert" role="alert">
            <div className="alert__title">Nao foi possivel abrir a serie</div>
            <div className="alert__text">{error || 'Serie nao encontrada.'}</div>
          </div>
          <div className="mt-3 d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-primary" onClick={handleRetry}>
              Tentar novamente
            </button>
          </div>
        </div>
      </main>
    )
  }

  const title = pickFirstString(detail.show, ['title']) ?? 'Serie'
  const description = pickFirstString(detail.show, ['description']) ?? 'Sem descricao cadastrada para esta serie.'
  const posterMonogram = buildPosterMonogram(title)
  const updatedLabel = formatDate(detail.updatedAt)
  return (
    <main className="detailPage">
      <div className="container container-xxl detailPage__inner">
        <div className="detailPage__toolbar">
          <button type="button" className="btn btn--outline btn--sm" onClick={handleBack}>
            Voltar
          </button>
        </div>

        <section className="detailHeroGrid">
          <article
            className="detailPosterCard"
            style={{
              '--detail-accent': posterPalette.accent,
              '--detail-accent-soft': posterPalette.accentSoft,
              '--detail-accent-glow': posterPalette.accentGlow
            }}
          >
            <div className="detailPosterCard__frame">
              {posterUrl ? (
                <img className="detailPosterCard__image" src={posterUrl} alt={title} />
              ) : (
                <div className="detailPosterCard__monogram">{posterMonogram}</div>
              )}
            </div>
          </article>

          <div className="detailSideColumn">
          <article className="detailInfoCard">
            <div className="detailInfoCard__eyebrow">Série do catálogo</div>

            <div className="detailInfoCard__hero">
              <div className="detailInfoCard__titleWrap">
                <h1 className="detailInfoCard__title">{title}</h1>
              </div>
              <div className="detailInfoCard__metaTop">
                {detail.averageRating !== null ? (
                  <span className="detailRating">
                    <OutlineStarIcon />
                    <span>{formatRating(detail.averageRating)}</span>
                  </span>
                ) : null}
                {detail.ageBadge ? (
                  <span className={`detailAgeBadge detailAgeBadge--${detail.ageBadge.tone}`}>
                    {detail.ageBadge.label}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="detailFactsGrid">
              {detail.yearLabel ? (
                <div className="detailFactCard">
                  <div className="detailFactCard__label">Período</div>
                  <div className="detailFactCard__value">{detail.yearLabel}</div>
                </div>
              ) : null}
              {updatedLabel ? (
                <div className="detailFactCard">
                  <div className="detailFactCard__label">Última atualização</div>
                  <div className="detailFactCard__value">{updatedLabel}</div>
                </div>
              ) : null}
            </div>

            {detail.seasonsPreview.length ? (
              <div className="detailInfoCard__foot">
                <div className="detailInfoCard__footLabel">Temporadas disponíveis</div>
                <div className="detailInfoCard__preview">
                  {detail.seasonsPreview.map((item) => (
                    <span key={item.key} className="detailPreviewTag">{item.label}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </article>

            <section className="detailDescriptionCard">
              <div className="detailDescriptionCard__eyebrow">Descricao</div>
              <div className="detailDescriptionCard__text">{description}</div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
