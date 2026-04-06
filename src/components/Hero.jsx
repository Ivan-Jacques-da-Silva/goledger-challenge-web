import { useEffect, useMemo, useRef, useState } from 'react'

const HERO_FADE_MS = 900
const HERO_ROTATION_MS = 7200
const HERO_CONTENT = {
  default: {
    title: 'Encontre sua próxima série',
    subtitle: 'Veja títulos, temporadas e episódios de forma rápida.',
    primaryHref: '#tvShows',
    primaryLabel: 'Ver séries',
    secondaryHref: '#/inicio2',
    secondaryLabel: 'Abrir início 2',
    stats: ['Busca rápida', 'Detalhes por temporada', 'Painel centralizado']
  },
  inicio2: {
    title: 'Explore o catálogo',
    subtitle: 'Navegue pelas séries com uma apresentação mais visual.',
    primaryHref: '#tvShows',
    primaryLabel: 'Ver séries',
    secondaryHref: '/',
    secondaryLabel: 'Abrir início 1',
    stats: ['Catálogo visual', 'Troca automática de destaque', 'Acesso rápido ao painel']
  }
}

function buildPosterUrl(path, size = 'w780') {
  if (!path) return ''
  return `https://image.tmdb.org/t/p/${size}${path}`
}

function normalizeSlide(entry) {
  if (typeof entry === 'string') {
    return { path: entry, size: 'w1280', title: '', rating: undefined }
  }

  if (typeof entry === 'object' && entry) {
    return {
      path: entry.path ?? entry.backdrop_path ?? entry.poster_path ?? '',
      size: entry.size ?? 'w1280',
      title: entry.title ?? entry.name ?? '',
      rating: entry.rating ?? entry.vote_average ?? undefined
    }
  }

  return null
}

function shuffleIndexes(count, avoidFirstIndex) {
  const indexes = Array.from({ length: count }, (_, index) => index)

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const currentValue = indexes[index]
    indexes[index] = indexes[randomIndex]
    indexes[randomIndex] = currentValue
  }

  if (typeof avoidFirstIndex === 'number' && indexes.length > 1 && indexes[0] === avoidFirstIndex) {
    const firstValue = indexes[0]
    indexes[0] = indexes[1]
    indexes[1] = firstValue
  }

  return indexes
}

function OutlineStarIcon() {
  return (
    <svg className="hero__backdropCaptionIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.75l2.55 5.17 5.7.83-4.13 4.03.97 5.68L12 16.78l-5.09 2.68.97-5.68-4.13-4.03 5.7-.83L12 3.75Z" />
    </svg>
  )
}

export default function Hero({
  variant,
  backgroundImages,
  backgroundLoading = false,
  readyKey = '',
  onReadyStateChange
}) {
  const content = variant === 'inicio2' ? HERO_CONTENT.inicio2 : HERO_CONTENT.default
  const slides = useMemo(() => {
    return (Array.isArray(backgroundImages) ? backgroundImages : [])
      .filter(Boolean)
      .map(normalizeSlide)
      .filter((slide) => slide?.path)
  }, [backgroundImages])

  const [order, setOrder] = useState([])
  const [position, setPosition] = useState(0)
  const [currentSlide, setCurrentSlide] = useState(null)
  const [previousSlide, setPreviousSlide] = useState(null)
  const [currentVisible, setCurrentVisible] = useState(true)
  const [previousVisible, setPreviousVisible] = useState(false)
  const [isCurrentImageLoaded, setIsCurrentImageLoaded] = useState(false)
  const hasReportedReadyRef = useRef(false)

  const showBackdrop = variant === 'inicio2' && Boolean(currentSlide?.path)
  const currentUrl = showBackdrop ? buildPosterUrl(currentSlide?.path, currentSlide?.size ?? 'w1280') : ''
  const previousUrl =
    showBackdrop && previousSlide?.path
      ? buildPosterUrl(previousSlide.path, previousSlide.size ?? 'w1280')
      : ''
  const captionTitle = showBackdrop ? String(currentSlide?.title ?? '').trim() : ''
  const captionRating = useMemo(() => {
    const rating = showBackdrop ? currentSlide?.rating : undefined
    if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) return ''
    return rating.toFixed(1)
  }, [currentSlide?.rating, showBackdrop])

  useEffect(() => {
    if (slides.length === 0) {
      setOrder([])
      setPosition(0)
      setCurrentSlide(null)
      setPreviousSlide(null)
      return
    }

    const initialOrder = shuffleIndexes(slides.length)
    setOrder(initialOrder)
    setPosition(0)
    setCurrentSlide(slides[initialOrder[0]])
    setPreviousSlide(null)
  }, [slides])

  useEffect(() => {
    if (variant !== 'inicio2' || slides.length <= 1 || order.length === 0) return

    const intervalId = window.setInterval(() => {
      setPosition((currentPosition) => {
        const lastIndex = order[currentPosition] ?? 0
        const nextPosition = currentPosition + 1

        if (nextPosition < order.length) return nextPosition

        setOrder(shuffleIndexes(slides.length, lastIndex))
        return 0
      })
    }, HERO_ROTATION_MS)

    return () => window.clearInterval(intervalId)
  }, [order, slides.length, variant])

  useEffect(() => {
    if (order.length === 0) return

    const nextIndex = order[position] ?? 0
    const nextSlide = slides[nextIndex]
    if (!nextSlide) return

    setPreviousSlide(currentSlide)
    setPreviousVisible(true)
    setCurrentSlide(nextSlide)
    setCurrentVisible(false)

    const rafId = window.requestAnimationFrame(() => {
      setCurrentVisible(true)
      setPreviousVisible(false)
    })

    const timeoutId = window.setTimeout(() => {
      setPreviousSlide(null)
    }, HERO_FADE_MS + 120)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
    }
  }, [currentSlide, order, position, slides])

  useEffect(() => {
    hasReportedReadyRef.current = false
  }, [readyKey])

  useEffect(() => {
    if (!showBackdrop) {
      setIsCurrentImageLoaded(false)
      return
    }

    if (!currentUrl) {
      setIsCurrentImageLoaded(true)
      return
    }

    let cancelled = false
    const image = new Image()

    setIsCurrentImageLoaded(false)

    image.onload = () => {
      if (!cancelled) setIsCurrentImageLoaded(true)
    }

    image.onerror = () => {
      if (!cancelled) setIsCurrentImageLoaded(true)
    }

    image.src = currentUrl

    if (image.complete) {
      setIsCurrentImageLoaded(true)
    }

    return () => {
      cancelled = true
    }
  }, [currentUrl, showBackdrop])

  useEffect(() => {
    if (typeof onReadyStateChange !== 'function' || !readyKey) return

    const isReady =
      variant === 'inicio2'
        ? !backgroundLoading && (!showBackdrop || isCurrentImageLoaded)
        : true

    if (!isReady || hasReportedReadyRef.current) return

    hasReportedReadyRef.current = true
    onReadyStateChange(readyKey, true)
  }, [
    backgroundLoading,
    isCurrentImageLoaded,
    onReadyStateChange,
    readyKey,
    showBackdrop,
    variant
  ])

  function handlePrimaryAction(event) {
    event.preventDefault()
    if (typeof document === 'undefined') return

    const target = document.getElementById('tvShows')
    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className={`hero ${variant === 'inicio2' ? 'hero--inicio2' : ''}`}>
      {showBackdrop ? (
        <div className="hero__backdrop">
          <div className="hero__backdropRight">
            {previousUrl ? (
              <div
                className="hero__slide hero__slide--previous"
                aria-hidden="true"
                style={{ backgroundImage: `url(${previousUrl})`, opacity: previousVisible ? 1 : 0 }}
              />
            ) : null}

            <div
              className="hero__slide hero__slide--current"
              aria-hidden="true"
              style={{ backgroundImage: `url(${currentUrl})`, opacity: currentVisible ? 1 : 0 }}
            />
          </div>

          <div className="hero__backdropFade" />

          {captionTitle || captionRating ? (
            <div className="hero__backdropCaption">
              {captionTitle ? <div className="hero__backdropCaptionTitle">{captionTitle}</div> : null}
              {captionRating ? (
                <div className="hero__backdropCaptionMeta">
                  <OutlineStarIcon />
                  <span>{captionRating}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="container container-xxl hero__content">
        <div className="hero__shell">
          <div className="hero__title">{content.title}</div>
          <div className="hero__subtitle">{content.subtitle}</div>

          <div className="hero__stats">
            {content.stats.map((item) => (
              <span key={item} className="hero__stat">
                {item}
              </span>
            ))}
          </div>

          <div className="hero__actions">
            <button type="button" className="btn hero__primary" onClick={handlePrimaryAction}>
              {content.primaryLabel}
            </button>
            <a className="btn btn--outline hero__ghost" href={content.secondaryHref}>
              {content.secondaryLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
