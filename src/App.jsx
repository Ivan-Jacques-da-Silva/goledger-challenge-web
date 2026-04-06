import { useEffect, useMemo, useState } from 'react'
import { createGoLedgerApi } from './api/goledgerApi.js'
import AssetTypeSection, { AssetTypeSectionSkeleton } from './components/AssetTypeSection.jsx'
import Footer from './components/Footer.jsx'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Inicio2Page from './components/Inicio2Page.jsx'
import LoginPage from './components/LoginPage.jsx'
import PainelCadastroPage from './components/PainelCadastroPage.jsx'
import TesteApiPage from './components/TesteApiPage.jsx'
import TvShowDetailPage from './components/TvShowDetailPage.jsx'

const APP_AUTH_STORAGE_KEY = 'goledger.app.authenticated'
const BASE_TITLE = 'Filmes e Séries'
const CATEGORY_LABELS = {
  tvShows: 'Séries',
  seasons: 'Temporadas',
  episodes: 'Episódios',
  watchlist: 'Minha lista',
  assetTypeListData: 'Tipos de ativo'
}
const CATEGORY_ORDER = {
  tvShows: 0,
  episodes: 1,
  seasons: 2,
  assetTypeListData: 3,
  watchlist: 4
}
const HOME_CATEGORY_EXCLUDES = new Set(['watchlist', 'assetTypeListData', 'seasons', 'episodes'])
const HOME_LOADING_SECTION_LABELS = ['Series', 'Filmes']

function getLocationKey() {
  if (typeof window === 'undefined') return ''
  return `${window.location.pathname}${window.location.hash}`
}

function matchesRoute(pathname, hash, route) {
  return pathname === route || hash === `#${route}` || hash === `#${route.slice(1)}`
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function parseHexColor(input) {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (!value.startsWith('#')) return null

  if (value.length === 4) {
    const r = parseInt(value[1] + value[1], 16)
    const g = parseInt(value[2] + value[2], 16)
    const b = parseInt(value[3] + value[3], 16)
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
    return { r, g, b }
  }

  if (value.length === 7) {
    const r = parseInt(value.slice(1, 3), 16)
    const g = parseInt(value.slice(3, 5), 16)
    const b = parseInt(value.slice(5, 7), 16)
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
    return { r, g, b }
  }

  return null
}

function toHexByte(value) {
  return clampByte(value).toString(16).padStart(2, '0')
}

function toHexColor(rgb) {
  if (!rgb) return null
  return `#${toHexByte(rgb.r)}${toHexByte(rgb.g)}${toHexByte(rgb.b)}`
}

function mixColors(a, b, amount) {
  if (!a || !b) return null
  const ratio = Math.max(0, Math.min(1, Number(amount) || 0))

  return {
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio
  }
}

function applyThemeFromHeader(header) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const palette = header?.colors
  const primary = parseHexColor(Array.isArray(palette) ? palette[0] : undefined)
  const surface = parseHexColor(Array.isArray(palette) ? palette[1] : undefined)
  const text = parseHexColor(Array.isArray(palette) ? palette[2] : undefined)
  const black = { r: 0, g: 0, b: 0 }
  const resolvedSurface =
    surface ??
    parseHexColor(getComputedStyle(root).getPropertyValue('--surface')) ??
    parseHexColor('#151517')
  const resolvedText =
    text ??
    parseHexColor(getComputedStyle(root).getPropertyValue('--text')) ??
    parseHexColor('#e6e6e6')

  const bg = mixColors(resolvedSurface, black, 0.28)
  const border = mixColors(resolvedSurface, resolvedText, 0.12)
  const muted = mixColors(resolvedText, resolvedSurface, 0.45)
  const surface2 = mixColors(resolvedSurface, black, 0.12)
  const surface3 = mixColors(resolvedSurface, resolvedText, 0.06)

  if (primary) root.style.setProperty('--primary', toHexColor(primary))
  if (resolvedSurface) root.style.setProperty('--surface', toHexColor(resolvedSurface))
  if (resolvedText) root.style.setProperty('--text', toHexColor(resolvedText))
  if (bg) root.style.setProperty('--bg', toHexColor(bg))
  if (border) root.style.setProperty('--border', toHexColor(border))
  if (muted) root.style.setProperty('--muted', toHexColor(muted))
  if (surface2) root.style.setProperty('--surface-2', toHexColor(surface2))
  if (surface3) root.style.setProperty('--surface-3', toHexColor(surface3))
}

function getTvShowDetailRoute(pathname, hash) {
  const rawDetailPath =
    pathname.startsWith('/serie/')
      ? pathname.slice('/serie/'.length)
      : hash.startsWith('#/serie/')
        ? hash.slice('#/serie/'.length)
        : hash.startsWith('#serie/')
          ? hash.slice('#serie/'.length)
          : ''

  if (!rawDetailPath) return { key: '', origin: '' }

  const [rawKey, rawQuery = ''] = rawDetailPath.split('?')
  let key = rawKey

  try {
    key = decodeURIComponent(rawKey)
  } catch {
    key = rawKey
  }

  return {
    key,
    origin: new URLSearchParams(rawQuery).get('origem') ?? ''
  }
}

function buildCategoriesUi(categories, featuredAvailability) {
  if (!Array.isArray(categories)) return []

  const mappedCategories = categories
    .filter((category) => category && typeof category.tag === 'string')
    .map((category, index) => ({
      ...category,
      label: CATEGORY_LABELS[category.tag] ?? category.label ?? category.tag,
      __index: index
    }))
    .filter((category) => {
      if (category.tag === 'assetTypeListData') return featuredAvailability.assetTypeListData
      return true
    })

  mappedCategories.sort((categoryA, categoryB) => {
    const orderA = CATEGORY_ORDER[categoryA.tag] ?? 999
    const orderB = CATEGORY_ORDER[categoryB.tag] ?? 999

    if (orderA !== orderB) return orderA - orderB
    return (categoryA.__index ?? 0) - (categoryB.__index ?? 0)
  })

  return mappedCategories.map(({ __index, ...category }) => category)
}

function getDocumentTitle({ isTvShowDetail, isInicio2, isPainel, isTesteApi, isLogin }) {
  if (isTvShowDetail) return `Detalhe da série | ${BASE_TITLE}`
  if (isInicio2) return `Início 2 | ${BASE_TITLE}`
  if (isPainel) return `Painel de cadastros | ${BASE_TITLE}`
  if (isTesteApi) return `Teste da API | ${BASE_TITLE}`
  if (isLogin) return `Login | ${BASE_TITLE}`
  return BASE_TITLE
}

export default function App() {
  const [locationKey, setLocationKey] = useState(getLocationKey)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(APP_AUTH_STORAGE_KEY) === '1'
  })
  const [searchText, setSearchText] = useState('')
  const [categoriesStatus, setCategoriesStatus] = useState('idle')
  const [categoriesError, setCategoriesError] = useState('')
  const [categories, setCategories] = useState([])
  const [featuredAvailability, setFeaturedAvailability] = useState({
    assetTypeListData: false
  })
  const [headerInfo, setHeaderInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const api = useMemo(() => createGoLedgerApi(), [])

  const categoriesUi = useMemo(
    () => buildCategoriesUi(categories, featuredAvailability),
    [categories, featuredAvailability]
  )
  const categoriesUiHome = useMemo(
    () => categoriesUi.filter((category) => !HOME_CATEGORY_EXCLUDES.has(category?.tag)),
    [categoriesUi]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    function handleLocationChange() {
      setLocationKey(getLocationKey())
    }

    window.addEventListener('hashchange', handleLocationChange)
    window.addEventListener('popstate', handleLocationChange)

    return () => {
      window.removeEventListener('hashchange', handleLocationChange)
      window.removeEventListener('popstate', handleLocationChange)
    }
  }, [])

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  const tvShowDetailRoute = useMemo(() => getTvShowDetailRoute(pathname, hash), [pathname, hash])
  const isTesteApi = matchesRoute(pathname, hash, '/teste-api')
  const isLogin = matchesRoute(pathname, hash, '/login')
  const isPainel = matchesRoute(pathname, hash, '/painel')
  const isLogout = matchesRoute(pathname, hash, '/logout')
  const isInicio2 = matchesRoute(pathname, hash, '/inicio2')
  const isTvShowDetail = Boolean(tvShowDetailRoute.key)
  const isSistema = isTesteApi || isLogin || isPainel || isLogout
  const isInicio1 = !isSistema && !isTvShowDetail && !isInicio2
  const showNavbarSearch = isInicio1 || isInicio2

  useEffect(() => {
    if (!isLogout || typeof window === 'undefined') return
    window.localStorage.removeItem(APP_AUTH_STORAGE_KEY)
    window.location.hash = '/login'
  }, [isLogout])

  useEffect(() => {
    if (!isPainel || typeof window === 'undefined') return

    const authenticated = window.localStorage.getItem(APP_AUTH_STORAGE_KEY) === '1'
    setIsAuthenticated(authenticated)

    if (!authenticated) window.location.hash = '/login'
  }, [isPainel])

  function handleLoginSuccess() {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(APP_AUTH_STORAGE_KEY, '1')
    setIsAuthenticated(true)
    window.location.hash = '/painel'
  }

  useEffect(() => {
    let cancelled = false

    async function loadHeader() {
      try {
        const payload = await api.getHeader()
        if (cancelled) return
        setHeaderInfo(payload && typeof payload === 'object' ? payload : null)
      } catch {
        if (cancelled) return
        setHeaderInfo(null)
      }
    }

    async function loadCategories() {
      if (isSistema) return

      setCategoriesStatus('loading')
      setCategoriesError('')

      try {
        const payload = await api.getSchema()
        if (cancelled) return
        setCategories(Array.isArray(payload) ? payload : [])
        setCategoriesStatus('success')
      } catch (error) {
        if (cancelled) return
        setCategories([])
        setCategoriesStatus('error')
        setCategoriesError(
          error instanceof Error ? error.message : 'Erro ao carregar categorias'
        )
      }
    }

    async function loadFeaturedAvailability() {
      if (isSistema) return

      async function hasAny(assetType) {
        try {
          const rows = await api.searchByAssetType(assetType, { limit: 1 })
          return Array.isArray(rows) && rows.length > 0
        } catch {
          return false
        }
      }

      const assetTypeListData = await hasAny('assetTypeListData')
      if (cancelled) return
      setFeaturedAvailability({ assetTypeListData })
    }

    async function loadData() {
      await Promise.all([loadHeader(), loadCategories(), loadFeaturedAvailability()])
      if (!cancelled) setIsLoading(false)
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [api, isSistema, locationKey])

  useEffect(() => {
    applyThemeFromHeader(headerInfo)
    if (typeof document === 'undefined') return

    document.title = getDocumentTitle({
      isTvShowDetail,
      isInicio2,
      isPainel,
      isTesteApi,
      isLogin
    })

    document.body.classList.toggle('route--painel', isPainel)
    return () => {
      document.body.classList.remove('route--painel')
    }
  }, [headerInfo, isPainel, isTesteApi, isLogin, isTvShowDetail, isInicio2])

  return (
    <div className={`app${isPainel ? ' app--painel' : ''}`}>
      {isLoading ? (
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <div className="loading-text">Carregando...</div>
        </div>
      ) : (
        <>
          <Header
            searchValue={searchText}
            onSearchChange={setSearchText}
            categories={isSistema ? undefined : categoriesUiHome}
            branding={headerInfo}
            showSearch={showNavbarSearch}
          />

          {isLogout ? null : isLogin ? (
            <LoginPage isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess} />
          ) : isPainel ? (
            <PainelCadastroPage />
          ) : isTesteApi ? (
            <TesteApiPage />
          ) : isTvShowDetail ? (
            <TvShowDetailPage
              tvShowKey={tvShowDetailRoute.key}
              detailOrigin={tvShowDetailRoute.origin}
            />
          ) : isInicio2 ? (
            <Inicio2Page
              searchText={searchText}
              categoriesStatus={categoriesStatus}
              categoriesError={categoriesError}
              categories={categoriesUiHome}
            />
          ) : (
            <main className="homePage homePage--inicio1 d-flex flex-column">
              <Hero />

              {categoriesStatus === 'loading' ? (
                HOME_LOADING_SECTION_LABELS.map((label) => (
                  <AssetTypeSectionSkeleton key={label} label={label} />
                ))
              ) : null}

              {categoriesStatus === 'error' ? (
                <div className="container container-xxl section">
                  <div className="alert" role="alert">
                    <div className="alert__title">Falha ao carregar categorias</div>
                    <div className="alert__text">{categoriesError}</div>
                  </div>
                </div>
              ) : null}

              {categoriesStatus === 'success'
                ? categoriesUiHome.map((category) => (
                    <AssetTypeSection
                      key={category.tag}
                      assetType={category.tag}
                      label={category.label}
                      searchText={searchText}
                      performanceProfile="home"
                    />
                  ))
                : null}
            </main>
          )}

          <Footer branding={headerInfo} />
        </>
      )}
    </div>
  )
}
