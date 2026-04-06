import { useEffect, useMemo, useState } from 'react'
import { createGoLedgerApi } from '../api/goledgerApi.js'
import Section from './Section.jsx'

function pickFirstString(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function getTvShowTitle(show) {
  return (
    pickFirstString(show, ['title', 'name', 'tvShow', 'tvShowName', 'showName']) ??
    pickFirstString(show, ['id', 'key']) ??
    'Série'
  )
}

function Card({ title, subtitle }) {
  return (
    <article className="card">
      <div className="card__title" title={title}>{title}</div>
      {subtitle ? <div className="card__subtitle">{subtitle}</div> : null}
    </article>
  )
}

function SkeletonCard() {
  return <div className="card card--skeleton" aria-hidden="true" />
}

export default function TvShowsSection({ searchText }) {
  const api = useMemo(() => createGoLedgerApi(), [])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [shows, setShows] = useState([])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const items = await api.searchByAssetType('tvShows', { limit: 60 })
      setShows(items)
      setStatus('success')
    } catch (e) {
      setShows([])
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Erro ao carregar séries')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredShows = useMemo(() => {
    const q = (searchText ?? '').trim().toLowerCase()
    if (!q) return shows
    return shows.filter((s) => getTvShowTitle(s).toLowerCase().includes(q))
  }, [shows, searchText])

  const action = useMemo(() => {
    if (status === 'loading') return <span className="muted">Carregando…</span>
    if (status === 'error') {
      return (
        <button type="button" className="btn btn--outline btn--sm" onClick={load}>
          Tentar de novo
        </button>
      )
    }
    return <span className="muted">{filteredShows.length} itens</span>
  }, [status, filteredShows.length])

  return (
    <Section id="descobrir-series" titulo="Explorar séries" action={action}>
      {status === 'loading'
        ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
        : null}

      {status === 'error' ? (
        <div className="alert" role="alert">
          <div className="alert__title">Falha ao buscar dados</div>
          <div className="alert__text">{error}</div>
        </div>
      ) : null}

      {status === 'success' && filteredShows.length === 0 ? (
        <div className="empty">Nenhuma série encontrada</div>
      ) : null}

      {status === 'success'
        ? filteredShows.slice(0, 60).map((show, index) => {
          const title = getTvShowTitle(show)
          const subtitle =
            pickFirstString(show, ['genre', 'category', 'year']) ??
            pickFirstString(show, ['description', 'synopsis'])
          const key =
            pickFirstString(show, ['id']) ??
            pickFirstString(show, ['_id']) ??
            `${title}-${index}`
          return <Card key={key} title={title} subtitle={subtitle} />
        })
        : null}
    </Section>
  )
}
