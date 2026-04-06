import { useEffect, useState } from 'react'

const PREDEFINED_USERNAME = 'admin'
const PREDEFINED_PASSWORD = 'admin'

export default function LoginPage({ isAuthenticated, onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) return
    if (typeof window === 'undefined') return
    window.location.hash = '/painel'
  }, [isAuthenticated])

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus('loading')

    const normalizedUsername = String(username ?? '').trim()
    const normalizedPassword = String(password ?? '').trim()

    const ok = normalizedUsername === PREDEFINED_USERNAME && normalizedPassword === PREDEFINED_PASSWORD
    if (!ok) {
      setStatus('error')
      setError('Usuario ou senha invalidos.')
      return
    }

    setStatus('success')
    onLoginSuccess?.()
  }

  return (
    <main className="page page--auth authPage">
      <div className="container container-xxl">
        <div className="authShell row g-4 g-xl-5 align-items-stretch">
          <div className="col-12 col-xl-5">
            <section className="authShowcase h-100">
              <div className="authShowcase__eyebrow">Painel administrativo</div>
              <h1 className="authShowcase__title">Entre para gerenciar o catalogo com uma interface mais limpa.</h1>
              <p className="authShowcase__text">
                Cadastre series, temporadas e episodios no mesmo fluxo, com formularios alinhados ao contrato real do backend.
              </p>

              <div className="authShowcase__stats" aria-label="Destaques">
                <div className="hero__stat">Fluxo claro</div>
                <div className="hero__stat">Contrato real</div>
                <div className="hero__stat">Acesso rapido</div>
              </div>
            </section>
          </div>

          <div className="col-12 col-xl-7">
            <div className="auth">
              <div className="auth__header">
                <h1 className="auth__title">Acesso ao painel</h1>
                <div className="auth__subtitle">Entre com suas credenciais para continuar.</div>
              </div>

              <section className="panel auth__card">
                <div className="panel__body">
                  <form id="login-form" className="authForm" onSubmit={handleSubmit}>
                    <label className="formRow">
                      <span className="formRow__label">Usuario</span>
                      <div className="formRow__control">
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          autoComplete="username"
                          placeholder="Usuario"
                        />
                      </div>
                    </label>

                    <label className="formRow">
                      <span className="formRow__label">Senha</span>
                      <div className="formRow__control">
                        <input
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          type="password"
                          autoComplete="current-password"
                          placeholder="Senha"
                        />
                      </div>
                    </label>

                    <button type="submit" className="btn authForm__submit" disabled={status === 'loading'}>
                      {status === 'loading' ? 'Entrando...' : 'Entrar'}
                    </button>
                  </form>
                </div>

                {status === 'error' ? (
                  <div className="alert" role="alert">
                    <div className="alert__title">Erro</div>
                    <div className="alert__text">{error}</div>
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
