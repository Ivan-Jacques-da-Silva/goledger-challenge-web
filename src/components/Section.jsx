import { useRef } from 'react'

export default function Section({ id, titulo, action, children, layout = 'carousel' }) {
  const railRef = useRef(null)
  const isStacked = layout === 'stacked'

  function scrollByPages(direction) {
    const el = railRef.current
    if (!el) return
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.9))
    el.scrollBy({ left: direction * amount, behavior: 'smooth' })
  }

  return (
    <section className="section" id={id}>
      <div className="section__inner">
        <div className="section__header">
          <h2 className="section__title">{titulo}</h2>
          <div className="section__actions">
            {action}
          </div>
        </div>
        <div className={`section__carousel${isStacked ? ' section__carousel--stacked' : ''}`} aria-label={`${isStacked ? 'lista' : 'carrossel'} de ${titulo}`}>
          {!isStacked ? (
            <>
              <button
                type="button"
                className="carouselBtn carouselBtn--left"
                onClick={() => scrollByPages(-1)}
                aria-label={`Voltar em ${titulo}`}
              />
              <button
                type="button"
                className="carouselBtn carouselBtn--right"
                onClick={() => scrollByPages(1)}
                aria-label={`Avançar em ${titulo}`}
              />
            </>
          ) : null}
          <div ref={railRef} className={`section__rail${isStacked ? ' section__rail--stacked' : ''}`}>
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}
