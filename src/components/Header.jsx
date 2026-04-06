import { useEffect, useMemo, useRef, useState } from 'react'
import { createGoLedgerApi } from '../api/goledgerApi.js'
import faviconUrl from '../../favicon.svg'

const APP_AUTH_STORAGE_KEY = 'goledger.app.authenticated'
const DEFAULT_BRAND_TITLE = 'Filmes e Séries'
const HOME_ROUTE = '/'
const WATCHLIST_ASSET_TYPE = 'watchlist'
const TV_SHOWS_ASSET_TYPE = 'tvShows'

function MenuIcon() {
  return (
    <>
      <path d="M6 7h12" />
      <path d="M6 12h12" />
      <path d="M6 17h12" />
    </>
  )
}

function SearchIcon() {
  return (
    <>
      <path d="M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z" />
      <path d="M16 16l4 4" />
    </>
  )
}

function StarIcon() {
  return <path d="M12 20.5 4.9 13.9A4.9 4.9 0 0 1 12 7.4a4.9 4.9 0 0 1 7.1 6.5L12 20.5Z" />
}

function HomeIcon() {
  return (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10.5V19h11v-8.5" />
    </>
  )
}

function TvIcon() {
  return (
    <>
      <rect x="4" y="6" width="16" height="11" rx="2" />
      <path d="M9 20h6" />
      <path d="m10 3 2 3 2-3" />
    </>
  )
}

function StackIcon() {
  return (
    <>
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </>
  )
}

function PlayIcon() {
  return (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="m10 9 5 3-5 3Z" />
    </>
  )
}

function GridIcon() {
  return (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </>
  )
}

function TerminalIcon() {
  return (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m7 10 3 2-3 2" />
      <path d="M12.5 14H17" />
    </>
  )
}

function LoginIcon() {
  return (
    <>
      <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 16l4-4-4-4" />
      <path d="M14 12H5" />
    </>
  )
}

function LogoutIcon() {
  return (
    <>
      <path d="M10 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="m14 16 4-4-4-4" />
      <path d="M18 12H9" />
    </>
  )
}

function CloseIcon() {
  return (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  )
}

const ICONS = {
  menu: MenuIcon,
  search: SearchIcon,
  star: StarIcon,
  home: HomeIcon,
  tv: TvIcon,
  stack: StackIcon,
  play: PlayIcon,
  grid: GridIcon,
  terminal: TerminalIcon,
  login: LoginIcon,
  logout: LogoutIcon,
  close: CloseIcon
}

function Icon({ name }) {
  const IconComponent = ICONS[name]

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {IconComponent ? <IconComponent /> : null}
    </svg>
  )
}

function DrawerLink({ href, label, icon, active, onClick }) {
  return (
    <a
      href={href}
      className={`drawer__link ${active ? 'drawer__link--active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="drawer__linkIcon">
        <Icon name={icon} />
      </span>
      <span className="drawer__linkText">{label}</span>
    </a>
  )
}

function matchRoute(pathname, hash, route) {
  return pathname === route || hash === `#${route}` || hash === `#${route.slice(1)}`
}

function pickFirstString(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return undefined
}

function getItemRefKey(value) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object') {
    return pickFirstString(value, ['@key', 'key', 'id', '_id'])
  }
  return undefined
}

function buildTvShowLabelMap(items) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const key = getItemRefKey(item)
    const label = pickFirstString(item, ['title', 'name', 'tvShow', 'tvShowName', 'showName'])

    if (key && label) acc[key] = label
    return acc
  }, {})
}

function buildTvShowMap(items) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const key = getItemRefKey(item)
    if (!key) return acc

    acc[key] = {
      title: pickFirstString(item, ['title', 'name', 'tvShow', 'tvShowName', 'showName']),
      description: pickFirstString(item, ['description'])
    }

    return acc
  }, {})
}

function parseRefToken(value) {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed.startsWith('ref:')) return undefined

  const token = trimmed.slice('ref:'.length).trim()
  return token || undefined
}

function getResolvedTvShowLabels(item, tvShowLabelsByKey) {
  const tvShows = Array.isArray(item?.tvShows) ? item.tvShows : []
  const labels = tvShows
    .map((entry) => {
      const explicitLabel = pickFirstString(entry, [
        'title',
        'name',
        'tvShow',
        'tvShowName',
        'showName'
      ])
      if (explicitLabel) return explicitLabel

      const refKey = getItemRefKey(entry)
      if (refKey && tvShowLabelsByKey[refKey]) return tvShowLabelsByKey[refKey]

      return undefined
    })
    .filter(Boolean)

  return Array.from(new Set(labels))
}

function resolveTvShowFromWatchlist(item, tvShowsByKey) {
  const tvShows = Array.isArray(item?.tvShows) ? item.tvShows : []

  for (const entry of tvShows) {
    const refKey = getItemRefKey(entry)
    if (refKey && tvShowsByKey[refKey]) return tvShowsByKey[refKey]
  }

  const token = parseRefToken(pickFirstString(item, ['description']))
  if (!token || !token.startsWith(`${TV_SHOWS_ASSET_TYPE}:`)) return undefined

  const refKey = token.slice(`${TV_SHOWS_ASSET_TYPE}:`.length).trim()
  return refKey ? tvShowsByKey[refKey] : undefined
}

function getDisplayTitleFromReferences(item, fallbackTitle, tvShowLabelsByKey) {
  const uniqueLabels = getResolvedTvShowLabels(item, tvShowLabelsByKey)
  if (uniqueLabels.length !== 1) return fallbackTitle

  const rawTitle = typeof fallbackTitle === 'string' ? fallbackTitle.trim() : ''
  if (!rawTitle) return uniqueLabels[0]

  const normalizedTitle = rawTitle.replace(/^(s[eé]ries?|series)\s*:\s*/i, '').trim()
  if (!normalizedTitle) return uniqueLabels[0]

  if (normalizedTitle.localeCompare(uniqueLabels[0], 'pt-BR', { sensitivity: 'base' }) === 0) {
    return uniqueLabels[0]
  }

  return fallbackTitle
}

function formatWatchlistSubtitle(item, tvShowLabelsByKey, tvShowsByKey) {
  const resolvedTvShow = resolveTvShowFromWatchlist(item, tvShowsByKey)
  if (resolvedTvShow?.description) return resolvedTvShow.description

  const uniqueLabels = getResolvedTvShowLabels(item, tvShowLabelsByKey)
  if (uniqueLabels.length) return `Séries: ${uniqueLabels.join(', ')}`

  const description = pickFirstString(item, ['description'])
  if (description) return description

  const tvShows = Array.isArray(item?.tvShows) ? item.tvShows : []
  if (tvShows.length === 1) return '1 série vinculada'
  if (tvShows.length > 1) return `${tvShows.length} séries vinculadas`

  return ''
}

function getDetailOrigin(hash) {
  if (typeof hash !== 'string') return ''

  const detailPath = hash.startsWith('#/serie/')
    ? hash.slice('#/serie/'.length)
    : hash.startsWith('#serie/')
      ? hash.slice('#serie/'.length)
      : ''

  if (!detailPath) return ''

  const [, rawQuery = ''] = detailPath.split('?')
  return new URLSearchParams(rawQuery).get('origem') ?? ''
}

function getBrandTitle(branding) {
  return (
    (typeof branding?.orgTitle === 'string' && branding.orgTitle.trim()) ||
    (typeof branding?.name === 'string' && branding.name.trim()) ||
    DEFAULT_BRAND_TITLE
  )
}

function getMarkText(branding) {
  const seed = (
    (typeof branding?.name === 'string' && branding.name.trim()) ||
    (typeof branding?.orgTitle === 'string' && branding.orgTitle.trim()) ||
    'TV'
  )

  return seed.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 2).toUpperCase() || 'TV'
}

function getCategoryIcon(tag) {
  if (tag === 'tvShows') return 'tv'
  if (tag === 'seasons') return 'stack'
  if (tag === 'episodes') return 'play'
  return 'grid'
}

function dedupeLinksByHref(links) {
  return links.filter((link, index, list) => list.findIndex((item) => item.href === link.href) === index)
}

export default function Header({ searchValue, onSearchChange, categories, branding, showSearch = true }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)
  const [listaStatus, setListaStatus] = useState('idle')
  const [listaErro, setListaErro] = useState('')
  const [listaItems, setListaItems] = useState([])
  const [confirmAberto, setConfirmAberto] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState('idle')
  const [confirmErro, setConfirmErro] = useState('')
  const [confirmItem, setConfirmItem] = useState(null)
  const [tvShowLabelsByKey, setTvShowLabelsByKey] = useState({})
  const [tvShowsByKey, setTvShowsByKey] = useState({})
  const listaRef = useRef(null)
  const api = useMemo(() => createGoLedgerApi(), [])

  const pathname = typeof window !== 'undefined' ? window.location.pathname : HOME_ROUTE
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  const isTesteApi = matchRoute(pathname, hash, '/teste-api')
  const isPainel = matchRoute(pathname, hash, '/painel')
  const isLogin = matchRoute(pathname, hash, '/login')
  const isAuthed =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(APP_AUTH_STORAGE_KEY) === '1'
      : false

  const detailOrigin = useMemo(() => getDetailOrigin(hash), [hash])
  const preferredHomeHash =
    hash === '#/inicio2' || hash === '#inicio2' || detailOrigin === 'inicio2' ? '#/inicio2' : ''
  const brandTitle = useMemo(() => getBrandTitle(branding), [branding])
  const markText = useMemo(() => getMarkText(branding), [branding])

  async function loadLista() {
    setListaStatus('loading')
    setListaErro('')

    try {
      const [watchlistResult, tvShowsResult] = await Promise.allSettled([
        api.searchByAssetType(WATCHLIST_ASSET_TYPE, { limit: 60 }),
        api.searchByAssetType(TV_SHOWS_ASSET_TYPE, { limit: 200 })
      ])

      if (watchlistResult.status !== 'fulfilled') {
        throw watchlistResult.reason
      }

      const watchlistItems = Array.isArray(watchlistResult.value) ? watchlistResult.value : []
      const tvShows = tvShowsResult.status === 'fulfilled' ? tvShowsResult.value : []

      setListaItems(watchlistItems)
      setTvShowLabelsByKey(buildTvShowLabelMap(tvShows))
      setTvShowsByKey(buildTvShowMap(tvShows))
      setListaStatus('success')
    } catch (error) {
      setListaItems([])
      setTvShowLabelsByKey({})
      setTvShowsByKey({})
      setListaStatus('error')
      setListaErro(error instanceof Error ? error.message : 'Erro ao carregar minha lista')
    }
  }

  async function removeDaLista(item) {
    const title = pickFirstString(item, ['title'])
    const rawKey = pickFirstString(item, ['@key', 'key', 'id', '_id'])
    const keyCandidates = []

    if (rawKey) keyCandidates.push({ '@assetType': WATCHLIST_ASSET_TYPE, '@key': rawKey })
    if (title) keyCandidates.push({ '@assetType': WATCHLIST_ASSET_TYPE, title })

    if (!keyCandidates.length) {
      setConfirmStatus('error')
      setConfirmErro('Não foi possível remover: item sem chave.')
      return
    }

    setConfirmStatus('loading')
    setConfirmErro('')

    try {
      let lastError = null

      for (const key of keyCandidates) {
        try {
          await api.request('/invoke/deleteAsset', {
            method: 'DELETE',
            body: { key }
          })

          const removedTitle = pickFirstString(item, ['title'])
          const removedKey = pickFirstString(item, ['@key', 'key', 'id', '_id'])

          setListaItems((prev) =>
            prev.filter((entry) => {
              if (removedKey && pickFirstString(entry, ['@key', 'key', 'id', '_id']) === removedKey) {
                return false
              }

              if (removedTitle && pickFirstString(entry, ['title']) === removedTitle) {
                return false
              }

              return true
            })
          )

          setConfirmStatus('success')
          setConfirmItem(null)
          setConfirmAberto(false)
          return
        } catch (error) {
          lastError = error

          if (!(error instanceof Error)) break
          if (!error.message.includes('HTTP 404')) break
        }
      }

      throw lastError ?? new Error('Erro ao remover item')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao remover item'
      setConfirmStatus('error')
      setConfirmErro(`${message}\n\nA chave informada pode não corresponder ao item salvo no ledger.`)
    }
  }

  useEffect(() => {
    if (isTesteApi) return
    loadLista()
  }, [api, isTesteApi])

  useEffect(() => {
    if (typeof window === 'undefined') return

    function onFavoritesChanged() {
      if (isTesteApi) return
      loadLista()
    }

    window.addEventListener('goledger:favoritesChanged', onFavoritesChanged)
    return () => window.removeEventListener('goledger:favoritesChanged', onFavoritesChanged)
  }, [isTesteApi])

  useEffect(() => {
    if (!listaAberta) return

    function onMouseDown(event) {
      const root = listaRef.current
      if (!root) return
      if (event.target instanceof Node && root.contains(event.target)) return
      setListaAberta(false)
    }

    document.addEventListener('mousedown', onMouseDown, true)
    return () => document.removeEventListener('mousedown', onMouseDown, true)
  }, [listaAberta])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!confirmAberto && !listaAberta && !menuAberto) return

    function onKeyDown(event) {
      if (event.key !== 'Escape') return

      if (confirmAberto) {
        if (confirmStatus === 'loading') return
        setConfirmAberto(false)
        setConfirmItem(null)
        return
      }

      if (listaAberta) {
        setListaAberta(false)
        return
      }

      if (menuAberto) {
        setMenuAberto(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmAberto, confirmStatus, listaAberta, menuAberto])

  useEffect(() => {
    if (typeof window === 'undefined' || !menuAberto) return undefined

    const { body, documentElement } = document
    const scrollY = window.scrollY
    const previousBodyOverflow = body.style.overflow
    const previousBodyPosition = body.style.position
    const previousBodyTop = body.style.top
    const previousBodyWidth = body.style.width
    const previousBodyPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth

    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      body.style.overflow = previousBodyOverflow
      body.style.position = previousBodyPosition
      body.style.top = previousBodyTop
      body.style.width = previousBodyWidth
      body.style.paddingRight = previousBodyPaddingRight
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' })
    }
  }, [menuAberto])

  const links = useMemo(() => {
    if (!Array.isArray(categories)) return []

    return categories
      .filter((category) => category && typeof category.tag === 'string' && typeof category.label === 'string')
      .map((category) => ({
        href: `#${category.tag}`,
        label: category.label,
        tag: category.tag
      }))
  }, [categories])

  function handleHomeNavigation(event) {
    event.preventDefault()
    setMenuAberto(false)
    setListaAberta(false)

    if (typeof window === 'undefined') return

    if (preferredHomeHash) {
      if (window.location.hash !== preferredHomeHash) {
        window.location.hash = preferredHomeHash.slice(1)
      }
    } else if (window.location.hash) {
      window.location.hash = ''
    } else if (window.location.pathname !== HOME_ROUTE) {
      window.history.pushState({}, '', HOME_ROUTE)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  const publicLinks = useMemo(
    () => [
      {
        href: preferredHomeHash || HOME_ROUTE,
        label: 'Início',
        icon: 'home',
        active:
          !isPainel &&
          !isTesteApi &&
          !isLogin &&
          (!hash || hash === '#' || hash === '#/inicio2' || hash === '#inicio2'),
        onClick: handleHomeNavigation
      },
      ...links.map((link) => ({
        href: link.href,
        label: link.label,
        icon: getCategoryIcon(link.tag),
        active: hash === link.href,
        onClick: () => setMenuAberto(false)
      }))
    ],
    [hash, isLogin, isPainel, isTesteApi, links, preferredHomeHash]
  )

  const uniquePublicLinks = useMemo(() => dedupeLinksByHref(publicLinks), [publicLinks])

  const adminLinks = isAuthed
    ? [
        {
          href: '#/painel',
          label: 'Painel de cadastros',
          icon: 'grid',
          active: isPainel
        },
        {
          href: '#/teste-api',
          label: 'Teste da API',
          icon: 'terminal',
          active: isTesteApi
        },
        {
          href: '#/logout',
          label: 'Sair',
          icon: 'logout',
          active: false
        }
      ]
    : [
        {
          href: '#/login',
          label: 'Login',
          icon: 'login',
          active: isLogin
        }
      ]

  return (
    <>
      <header className="header navbar navbar-dark">
        <div className="container container-xxl header__inner px-2 px-sm-3 px-xl-4">
          <div className="header__left d-flex align-items-center">
            <button
              type="button"
              className="iconBtn shadow-sm"
              aria-label="Abrir menu"
              onClick={() => setMenuAberto(true)}
            >
              <Icon name="menu" />
              <span className="iconBtn__label">Menu</span>
            </button>

            <a
              className="logo"
              href={preferredHomeHash || HOME_ROUTE}
              onClick={handleHomeNavigation}
              aria-label="Ir para o início"
            >
              <span className="logo__mark">
                <img className="logo__markIcon" src={faviconUrl} alt="" aria-hidden="true" />
              </span>
              <span className="logo__text">{brandTitle}</span>
            </a>
          </div>

          {showSearch ? (
            <div className="header__center d-flex justify-content-center">
              <form className="search shadow-sm" role="search" onSubmit={(event) => event.preventDefault()}>
                <Icon name="search" />
                <input
                  value={searchValue}
                  onChange={(event) => onSearchChange?.(event.target.value)}
                  type="search"
                  placeholder="Pesquisar"
                  aria-label="Pesquisar"
                />
              </form>
            </div>
          ) : null}

          <div className="header__right d-flex align-items-center justify-content-end">
            <div className="favWrap" ref={listaRef}>
              <button
                type="button"
                className="favBtn shadow-sm"
                aria-label="Abrir minha lista"
                aria-expanded={listaAberta}
                aria-controls="minha-lista-dropdown"
                onClick={() => {
                  setListaAberta((currentValue) => {
                    const nextValue = !currentValue
                    if (nextValue) loadLista()
                    return nextValue
                  })
                }}
              >
                <Icon name="star" />
                <span className="favBtn__label">Minha lista</span>
                <span className="appBadge" aria-label={`${listaItems.length} itens na minha lista`}>
                  {listaItems.length}
                </span>
              </button>

              {listaAberta ? (
                <div
                  id="minha-lista-dropdown"
                  className="favDropdown shadow-lg"
                  role="dialog"
                  aria-label="Minha lista"
                >
                  <div className="favDropdown__header">
                    <div className="favDropdown__title">Minha lista</div>
                    {listaStatus === 'error' ? (
                      <button type="button" className="btn btn--outline btn--sm" onClick={loadLista}>
                        Recarregar
                      </button>
                    ) : null}
                  </div>

                  <div className="favDropdown__list">
                    {listaStatus === 'loading' ? <div className="muted">Carregando...</div> : null}
                    {listaStatus === 'error' ? <div className="muted">{listaErro}</div> : null}
                    {listaStatus === 'success' && listaItems.length === 0 ? (
                      <div className="empty">Sem itens</div>
                    ) : null}

                    {listaStatus === 'success'
                      ? listaItems.map((item, index) => {
                          const rawTitle =
                            pickFirstString(item, ['title']) ??
                            pickFirstString(item, ['@key']) ??
                            `Item ${index + 1}`
                          const title = getDisplayTitleFromReferences(
                            item,
                            rawTitle,
                            tvShowLabelsByKey
                          )
                          const subtitle = formatWatchlistSubtitle(
                            item,
                            tvShowLabelsByKey,
                            tvShowsByKey
                          )
                          const key =
                            pickFirstString(item, ['@key', '@lastTxID', 'id', '_id', 'key']) ??
                            `${title}-${index}`

                          return (
                            <div key={key} className="favItem">
                              <div className="favItem__top">
                                <div className="favItem__title" title={title}>
                                  {title}
                                </div>
                                <button
                                  type="button"
                                  className="favItem__remove"
                                  aria-label={`Remover ${title} da minha lista`}
                                  onClick={() => {
                                    setConfirmItem(item)
                                    setConfirmStatus('idle')
                                    setConfirmErro('')
                                    setConfirmAberto(true)
                                  }}
                                >
                                  ×
                                </button>
                              </div>

                              {subtitle ? <div className="favItem__subtitle">{subtitle}</div> : null}
                            </div>
                          )
                        })
                      : null}
                  </div>
                </div>
              ) : null}

              {confirmAberto ? (
                <div
                  className="modalOverlay"
                  role="presentation"
                  onMouseDown={() => {
                    if (confirmStatus === 'loading') return
                    setConfirmAberto(false)
                    setConfirmItem(null)
                  }}
                >
                  <div
                    className="modal"
                    role="dialog"
                    aria-label="Confirmar remoção"
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <div className="modal__title">Remover da minha lista?</div>
                    <div className="modal__text">
                      {pickFirstString(confirmItem, ['title']) ?? 'Item'}
                    </div>
                    {confirmStatus === 'error' ? <div className="modal__error">{confirmErro}</div> : null}
                    <div className="modal__actions">
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => {
                          setConfirmAberto(false)
                          setConfirmItem(null)
                        }}
                        disabled={confirmStatus === 'loading'}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => removeDaLista(confirmItem)}
                        disabled={confirmStatus === 'loading'}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className={`drawer ${menuAberto ? 'drawer--open' : ''}`} aria-hidden={!menuAberto}>
        <div className="drawer__panel" role="dialog" aria-label="Menu">
          <div className="drawer__header">
            <div className="drawer__title">Menu</div>
            <button
              type="button"
              className="drawer__close"
              aria-label="Fechar menu"
              onClick={() => setMenuAberto(false)}
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="drawer__content">
            <div className="drawer__brand">
              <span className="drawer__brandMark">{markText}</span>
              <div>
                <div className="drawer__brandTitle">{brandTitle}</div>
                <div className="drawer__brandText">Navegação principal</div>
              </div>
            </div>

            <nav className="drawer__section" aria-label="Navegação principal">
              <div className="drawer__sectionTitle">Explorar</div>
              <div className="drawer__links">
                {uniquePublicLinks.map((link) => (
                  <DrawerLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    icon={link.icon}
                    active={link.active}
                    onClick={link.onClick}
                  />
                ))}
              </div>
            </nav>

            <nav className="drawer__section" aria-label="Área administrativa">
              <div className="drawer__sectionTitle">
                {isAuthed ? 'Área administrativa' : 'Conta'}
              </div>
              <div className="drawer__links">
                {adminLinks.map((link) => (
                  <DrawerLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    icon={link.icon}
                    active={link.active}
                    onClick={() => setMenuAberto(false)}
                  />
                ))}
              </div>
            </nav>
          </div>
        </div>

        <button
          type="button"
          className="drawer__backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenuAberto(false)}
        />
      </div>
    </>
  )
}
