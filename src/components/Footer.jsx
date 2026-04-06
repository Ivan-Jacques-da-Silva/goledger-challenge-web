const DEFAULT_BRAND_TITLE = 'Filmes e Séries'

function getBrandTitle(branding) {
  return (
    (typeof branding?.orgTitle === 'string' && branding.orgTitle.trim()) ||
    (typeof branding?.name === 'string' && branding.name.trim()) ||
    DEFAULT_BRAND_TITLE
  )
}

export default function Footer({ branding }) {
  const brandTitle = getBrandTitle(branding)
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container container-xxl footer__inner px-3 px-lg-4">
        <span>{`© ${currentYear} ${brandTitle}`}</span>
      </div>
    </footer>
  )
}
