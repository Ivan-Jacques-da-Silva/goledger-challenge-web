import { useEffect, useState } from 'react'
import Hero from './Hero.jsx'
import AssetTypeSection, { AssetTypeSectionSkeleton } from './AssetTypeSection.jsx'

const DEFAULT_TMDB_MODE = 'bearer'
const DEFAULT_TMDB_READ_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1NTkwMjE5NzcyZjdlYzllMjFhY2YwMWRmOGMyODFhYiIsIm5iZiI6MTY5OTI5MzAyMi43NzQwMDAyLCJzdWIiOiI2NTQ5Mjc1ZTkyNGNlNjAxMDFmNTdjOTUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.CCWFHTD46mSdJMVTVn7e8uwlZ2k63rw-bHypNBaMucc'
const DEFAULT_TMDB_LANG = 'pt-BR'
const HOME_LOADING_SECTION_LABELS = ['Series', 'Filmes']

export default function Inicio2Page({ searchText, categoriesStatus, categoriesError, categories }) {
  const [heroImages, setHeroImages] = useState([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ls = window.localStorage
    let changed = false

    function setIfMissing(key, value) {
      const current = ls.getItem(key)
      if (typeof current === 'string' && current.trim()) return
      ls.setItem(key, String(value))
      changed = true
    }

    setIfMissing('tmdb.auth.mode', DEFAULT_TMDB_MODE)
    setIfMissing('tmdb.auth.token', DEFAULT_TMDB_READ_TOKEN)
    setIfMissing('tmdb.lang', DEFAULT_TMDB_LANG)

    if (changed) window.dispatchEvent(new Event('tmdb:configChanged'))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadHeroImages() {
      try {
        const token = DEFAULT_TMDB_READ_TOKEN

        async function request(path) {
          const url = new URL(`https://api.themoviedb.org/3${path}`)
          url.search = new URLSearchParams({ language: DEFAULT_TMDB_LANG }).toString()
          const res = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              accept: 'application/json',
              authorization: `Bearer ${token}`
            }
          })
          if (!res.ok) return []
          const payload = await res.json()
          return Array.isArray(payload?.results) ? payload.results : []
        }

        const [tvResults, movieResults] = await Promise.all([
          request('/trending/tv/week'),
          request('/trending/movie/week')
        ])

        if (cancelled) return

        const all = [...tvResults, ...movieResults]
        const seen = new Set()
        const items = []
        for (const result of all) {
          const path = result?.backdrop_path ?? result?.poster_path ?? ''
          if (!path || seen.has(path)) continue
          seen.add(path)

          const title = String(result?.name ?? result?.title ?? '').trim()
          const rating = typeof result?.vote_average === 'number' ? result.vote_average : undefined
          items.push({ path, size: 'w1280', title, rating })
          if (items.length >= 12) break
        }

        setHeroImages(items.slice(0, 10))
      } catch {
        if (!cancelled) setHeroImages([])
      }
    }

    loadHeroImages()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="homePage homePage--inicio2 d-flex flex-column">
      <Hero variant="inicio2" backgroundImages={heroImages} />

      {categoriesStatus === 'loading'
        ? HOME_LOADING_SECTION_LABELS.map((label) => (
            <AssetTypeSectionSkeleton key={label} label={label} />
          ))
        : null}

      {categoriesStatus === 'error' ? (
        <div className="container container-xxl section">
          <div className="alert" role="alert">
            <div className="alert__title">Falha ao carregar categorias</div>
            <div className="alert__text">{categoriesError}</div>
          </div>
        </div>
      ) : null}

      {categoriesStatus === 'success'
        ? (Array.isArray(categories) ? categories : []).map((category) => (
            <AssetTypeSection
              key={category.tag}
              assetType={category.tag}
              label={category.label}
              searchText={searchText}
              enableTmdbPosters
              performanceProfile="home"
            />
          ))
        : null}
    </main>
  )
}
