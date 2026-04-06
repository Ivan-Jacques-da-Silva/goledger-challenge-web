import { useEffect, useMemo, useState } from 'react'
import { createGoLedgerApi } from '../api/goledgerApi.js'

const USERNAME_STORAGE_KEY = 'goledger.api.username'
const PASSWORD_STORAGE_KEY = 'goledger.api.password'

function getEnv(name) {
  const value = import.meta.env?.[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function Pretty({ value }) {
  if (value === undefined) return null
  return (
    <pre className="code">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  )
}

function Row({ label, children }) {
  return (
    <label className="formRow mb-0">
      <span className="formRow__label">{label}</span>
      <div className="formRow__control">{children}</div>
    </label>
  )
}

function tryParseJson(text) {
  if (!text || !text.trim()) return { ok: true, value: undefined }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'JSON inválido' }
  }
}

function EndpointCard({ title, description, children, onRun, status, error, result }) {
  const [paramsOpen, setParamsOpen] = useState(false)
  return (
    <section className="panel h-100">
      <div className="panel__header">
        <div>
          <div className="panel__title">{title}</div>
          {description ? <div className="panel__desc">{description}</div> : null}
        </div>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={async () => {
            setParamsOpen(false)
            await onRun?.()
          }}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Carregando…' : 'Executar'}
        </button>
      </div>
      {children ? (
        <details className="details" open={paramsOpen} onToggle={(e) => setParamsOpen(e.currentTarget.open)}>
          <summary className="details__summary">Parâmetros</summary>
          <div className="panel__body">{children}</div>
        </details>
      ) : null}
      {status === 'error' ? (
        <div className="alert" role="alert">
          <div className="alert__title">Erro</div>
          <div className="alert__text">{error}</div>
        </div>
      ) : null}
      {status === 'success' ? <Pretty value={result} /> : null}
    </section>
  )
}

function useEndpointState() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState(undefined)

  function start() {
    setStatus('loading')
    setError('')
    setResult(undefined)
  }

  function fail(message) {
    setStatus('error')
    setError(message)
  }

  function succeed(payload) {
    setStatus('success')
    setResult(payload)
  }

  return { status, error, result, start, fail, succeed }
}

export default function TesteApiPage() {
  const [rememberCreds, setRememberCreds] = useState(false)
  const [username, setUsername] = useState(getEnv('VITE_API_USERNAME') ?? 'goledger')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const envUsername = getEnv('VITE_API_USERNAME')
    const envPassword = getEnv('VITE_API_PASSWORD')
    if (envUsername) setUsername(envUsername)
    if (envPassword) setPassword(envPassword)
    if (envUsername || envPassword) return

    const storedUsername = window.localStorage.getItem(USERNAME_STORAGE_KEY)
    const storedPassword = window.localStorage.getItem(PASSWORD_STORAGE_KEY)
    if (storedUsername) setUsername(storedUsername)
    if (storedPassword) setPassword(storedPassword)
    setRememberCreds(Boolean(storedUsername || storedPassword))
  }, [])

  useEffect(() => {
    if (!rememberCreds) return
    window.localStorage.setItem(USERNAME_STORAGE_KEY, username)
    window.localStorage.setItem(PASSWORD_STORAGE_KEY, password)
  }, [rememberCreds, username, password])

  const api = useMemo(() => createGoLedgerApi({ username, password }), [username, password])
  const [useScoped, setUseScoped] = useState(true)
  const [channelName, setChannelName] = useState('mainchannel')
  const [chaincodeName, setChaincodeName] = useState('streaming-cc')
  const [blockNumber, setBlockNumber] = useState('10')
  const [txid, setTxid] = useState('04c489db64feb774a7275d687fc165e07a76026aae2ed91a327086f79ddad031')

  const headerState = useEndpointState()
  const getTxState = useEndpointState()
  const schemaState = useEndpointState()

  const chainInfoState = useEndpointState()
  const blockByNumberState = useEndpointState()
  const txByIdState = useEndpointState()
  const blockByTxIdState = useEndpointState()

  const postSchemaListState = useEndpointState()
  const postSchemaTypeState = useEndpointState()
  const postSearchState = useEndpointState()
  const postReadAssetState = useEndpointState()
  const postReadAssetHistoryState = useEndpointState()
  const postGetTxDetailsState = useEndpointState()
  const postQueryTxState = useEndpointState()
  const postInvokeTxState = useEndpointState()
  const postCreateAssetState = useEndpointState()
  const putUpdateAssetState = useEndpointState()
  const deleteAssetState = useEndpointState()

  const [schemaAssetType, setSchemaAssetType] = useState('tvShows')
  const [txName, setTxName] = useState('getSchema')
  const [genericQueryTxName, setGenericQueryTxName] = useState('getSchema')
  const [genericInvokeTxName, setGenericInvokeTxName] = useState('createAsset')

  const [searchQueryJson, setSearchQueryJson] = useState('{\n  \"selector\": {\n    \"@assetType\": \"tvShows\"\n  },\n  \"limit\": 5\n}')
  const [readKeyJson, setReadKeyJson] = useState('{\n  \"@assetType\": \"tvShows\",\n  \"title\": \"\"\n}')
  const [readHistoryKeyJson, setReadHistoryKeyJson] = useState('{\n  \"@assetType\": \"tvShows\",\n  \"title\": \"\"\n}')
  const [createAssetJson, setCreateAssetJson] = useState('[\n  {\n    \"@assetType\": \"tvShows\",\n    \"title\": \"\",\n    \"description\": \"\",\n    \"recommendedAge\": 0\n  }\n]')
  const [updateAssetJson, setUpdateAssetJson] = useState('{\n  \"@assetType\": \"tvShows\",\n  \"title\": \"\",\n  \"description\": \"\",\n  \"recommendedAge\": 0\n}')
  const [deleteKeyJson, setDeleteKeyJson] = useState('{\n  \"@assetType\": \"tvShows\",\n  \"title\": \"\"\n}')
  const [genericQueryBodyJson, setGenericQueryBodyJson] = useState('{}')
  const [genericInvokeBodyJson, setGenericInvokeBodyJson] = useState('{}')

  function scopedPath(path) {
    if (!useScoped) return path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `/${channelName}/${chaincodeName}${normalizedPath}`
  }

  async function run(state, fn, logLabel) {
    state.start()
    try {
      const payload = await fn()
      state.succeed(payload)
      console.log(logLabel, payload)
    } catch (e) {
      state.fail(e instanceof Error ? e.message : 'Erro desconhecido')
    }
  }

  function fail(state, message) {
    state.start()
    state.fail(message)
  }

  return (
    <main className="container container-xxl page page--console">
      <div className="page__header">
        <div className="page__kicker">Laboratorio da API</div>
        <h1 className="page__title">Teste da API</h1>
        <div className="page__subtitle">
          Use esta página para executar as rotas do Swagger e ver as respostas na tela e na aba Rede do navegador.
        </div>
        <div className="page__subtitle">
          Base URL atual: <span className="pill">{api.baseUrl}</span>
        </div>
      </div>

      <section className="panel">
        <details className="details">
          <summary className="details__summary">Credenciais</summary>
          <div className="panel__body">
            <div className="formGrid">
              <Row label="Usuário">
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </Row>
              <Row label="Senha">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="cole a senha aqui"
                  autoComplete="current-password"
                />
              </Row>
              <label className="checkRow">
                <input
                  type="checkbox"
                  checked={rememberCreds}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setRememberCreds(checked)
                    if (!checked) {
                      window.localStorage.removeItem(USERNAME_STORAGE_KEY)
                      window.localStorage.removeItem(PASSWORD_STORAGE_KEY)
                    }
                  }}
                />
                <span>Lembrar neste navegador (armazenamento local)</span>
              </label>
            </div>
          </div>
        </details>
      </section>

      <section className="panel">
        <details className="details">
          <summary className="details__summary">Parâmetros globais</summary>
          <div className="panel__body">
            <div className="formGrid">
              <label className="checkRow">
                <input type="checkbox" checked={useScoped} onChange={(e) => setUseScoped(e.target.checked)} />
                <span>Usar rotas com canal/contrato (channelName/chaincodeName)</span>
              </label>
              <Row label="channelName">
                <input value={channelName} onChange={(e) => setChannelName(e.target.value)} />
              </Row>
              <Row label="chaincodeName">
                <input value={chaincodeName} onChange={(e) => setChaincodeName(e.target.value)} />
              </Row>
            </div>
          </div>
        </details>
      </section>

      <div className="grid2 grid2--console">
        <EndpointCard
          title={`GET ${scopedPath('/query/getHeader')}`}
          description="Retorna informações do contrato."
          onRun={() => run(headerState, () => api.request(scopedPath('/query/getHeader'), { method: 'GET' }), 'GET /query/getHeader')}
          status={headerState.status}
          error={headerState.error}
          result={headerState.result}
        />

        <EndpointCard
          title={`GET ${scopedPath('/query/getTx')}`}
          description="Lista as transações definidas."
          onRun={() => run(getTxState, () => api.request(scopedPath('/query/getTx'), { method: 'GET' }), 'GET /query/getTx')}
          status={getTxState.status}
          error={getTxState.error}
          result={getTxState.result}
        />

        <EndpointCard
          title={`GET ${scopedPath('/query/getSchema')}`}
          description="Lista os tipos de ativo (assetTypes) existentes."
          onRun={() => run(schemaState, () => api.request(scopedPath('/query/getSchema'), { method: 'GET' }), 'GET /query/getSchema')}
          status={schemaState.status}
          error={schemaState.error}
          result={schemaState.result}
        />

        <EndpointCard
          title="GET /{channelName}/qscc/getChainInfo"
          onRun={() =>
            run(
              chainInfoState,
              () => api.request(`/${channelName}/qscc/getChainInfo`, { method: 'GET' }),
              'GET /{channel}/qscc/getChainInfo'
            )
          }
          status={chainInfoState.status}
          error={chainInfoState.error}
          result={chainInfoState.result}
        />

        <EndpointCard
          title="GET /{channelName}/qscc/getBlockByNumber"
          description="Requer parâmetro na URL: number."
          onRun={() =>
            blockNumber && blockNumber.trim()
              ? run(
                  blockByNumberState,
                  () => api.request(`/${channelName}/qscc/getBlockByNumber?number=${encodeURIComponent(blockNumber)}`, { method: 'GET' }),
                  'GET /{channel}/qscc/getBlockByNumber'
                )
              : fail(blockByNumberState, 'Informe o parâmetro number.')
          }
          status={blockByNumberState.status}
          error={blockByNumberState.error}
          result={blockByNumberState.result}
        >
          <Row label="number">
            <input value={blockNumber} onChange={(e) => setBlockNumber(e.target.value)} />
          </Row>
        </EndpointCard>

        <EndpointCard
          title="GET /{channelName}/qscc/getTransactionByID"
          description="Requer parâmetro na URL: txid."
          onRun={() =>
            txid && txid.trim()
              ? run(
                  txByIdState,
                  () => api.request(`/${channelName}/qscc/getTransactionByID?txid=${encodeURIComponent(txid)}`, { method: 'GET' }),
                  'GET /{channel}/qscc/getTransactionByID'
                )
              : fail(txByIdState, 'Informe o parâmetro txid.')
          }
          status={txByIdState.status}
          error={txByIdState.error}
          result={txByIdState.result}
        >
          <Row label="txid">
            <input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="cole um txid aqui" />
          </Row>
        </EndpointCard>

        <EndpointCard
          title="GET /{channelName}/qscc/getBlockByTxID"
          description="Requer parâmetro na URL: txid."
          onRun={() =>
            txid && txid.trim()
              ? run(
                  blockByTxIdState,
                  () => api.request(`/${channelName}/qscc/getBlockByTxID?txid=${encodeURIComponent(txid)}`, { method: 'GET' }),
                  'GET /{channel}/qscc/getBlockByTxID'
                )
              : fail(blockByTxIdState, 'Informe o parâmetro txid.')
          }
          status={blockByTxIdState.status}
          error={blockByTxIdState.error}
          result={blockByTxIdState.result}
        >
          <Row label="txid">
            <input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="cole um txid aqui" />
          </Row>
        </EndpointCard>

        <EndpointCard
          title={`POST ${scopedPath('/query/getSchema')}`}
          description="Sem corpo (body): lista os tipos de ativo."
          onRun={() => run(postSchemaListState, () => api.request(scopedPath('/query/getSchema'), { method: 'POST', body: {} }), 'POST /query/getSchema')}
          status={postSchemaListState.status}
          error={postSchemaListState.error}
          result={postSchemaListState.result}
        />

        <EndpointCard
          title={`POST ${scopedPath('/query/getSchema')}`}
          description="Com corpo (body): detalhes do esquema (schema) de um tipo de ativo."
          onRun={() =>
            run(
              postSchemaTypeState,
              () => api.request(scopedPath('/query/getSchema'), { method: 'POST', body: { assetType: schemaAssetType } }),
              'POST /query/getSchema (assetType)'
            )
          }
          status={postSchemaTypeState.status}
          error={postSchemaTypeState.error}
          result={postSchemaTypeState.result}
        >
          <Row label="tipo de ativo (assetType)">
            <input value={schemaAssetType} onChange={(e) => setSchemaAssetType(e.target.value)} />
          </Row>
        </EndpointCard>

        <EndpointCard
          title={`POST ${scopedPath('/query/search')}`}
          description="Busca ativos via seletor (selector) (@assetType etc.)."
          onRun={() => {
            const parsed = tryParseJson(searchQueryJson)
            if (!parsed.ok) {
              postSearchState.start()
              postSearchState.fail(parsed.error)
              return
            }
            run(postSearchState, () => api.request(scopedPath('/query/search'), { method: 'POST', body: { query: parsed.value ?? {} } }), 'POST /query/search')
          }}
          status={postSearchState.status}
          error={postSearchState.error}
          result={postSearchState.result}
        >
          <Row label="consulta (JSON)">
            <textarea value={searchQueryJson} onChange={(e) => setSearchQueryJson(e.target.value)} rows={10} spellCheck={false} />
          </Row>
        </EndpointCard>

        <EndpointCard
          title={`POST ${scopedPath('/query/readAsset')}`}
          description="Lê um ativo pela chave primária."
          onRun={() => {
            const parsed = tryParseJson(readKeyJson)
            if (!parsed.ok) {
              postReadAssetState.start()
              postReadAssetState.fail(parsed.error)
              return
            }
            const key = parsed.value ?? {}
            const title = typeof key?.title === 'string' ? key.title.trim() : ''
            if (!title) {
              fail(postReadAssetState, 'Informe title na chave para evitar 404.')
              return
            }
            run(postReadAssetState, () => api.request(scopedPath('/query/readAsset'), { method: 'POST', body: { key } }), 'POST /query/readAsset')
          }}
          status={postReadAssetState.status}
          error={postReadAssetState.error}
          result={postReadAssetState.result}
        >
          <Row label="chave (JSON)">
            <textarea value={readKeyJson} onChange={(e) => setReadKeyJson(e.target.value)} rows={8} spellCheck={false} />
          </Row>
        </EndpointCard>

        <EndpointCard
          title={`POST ${scopedPath('/query/readAssetHistory')}`}
          description="Lê o histórico de um ativo pela chave primária."
          onRun={() => {
            const parsed = tryParseJson(readHistoryKeyJson)
            if (!parsed.ok) {
              postReadAssetHistoryState.start()
              postReadAssetHistoryState.fail(parsed.error)
              return
            }
            const key = parsed.value ?? {}
            const title = typeof key?.title === 'string' ? key.title.trim() : ''
            if (!title) {
              fail(postReadAssetHistoryState, 'Informe title na chave para evitar 404.')
              return
            }
            run(
              postReadAssetHistoryState,
              () => api.request(scopedPath('/query/readAssetHistory'), { method: 'POST', body: { key } }),
              'POST /query/readAssetHistory'
            )
          }}
          status={postReadAssetHistoryState.status}
          error={postReadAssetHistoryState.error}
          result={postReadAssetHistoryState.result}
        >
          <Row label="chave (JSON)">
            <textarea value={readHistoryKeyJson} onChange={(e) => setReadHistoryKeyJson(e.target.value)} rows={8} spellCheck={false} />
          </Row>
        </EndpointCard>

        <EndpointCard
          title={`POST ${scopedPath('/query/getTx')}`}
          description="Retorna detalhes de uma transação pelo nome (txName)."
          onRun={() =>
            run(postGetTxDetailsState, () => api.request(scopedPath('/query/getTx'), { method: 'POST', body: { txName } }), 'POST /query/getTx')
          }
          status={postGetTxDetailsState.status}
          error={postGetTxDetailsState.error}
          result={postGetTxDetailsState.result}
        >
          <Row label="nome da transação (txName)">
            <input value={txName} onChange={(e) => setTxName(e.target.value)} />
          </Row>
        </EndpointCard>

        <EndpointCard
          title={`POST ${scopedPath(`/query/${genericQueryTxName}`)}`}
          description="Executa uma transação em modo consulta (não grava). Corpo (JSON) livre."
          onRun={() => {
            const parsed = tryParseJson(genericQueryBodyJson)
            if (!parsed.ok) {
              postQueryTxState.start()
              postQueryTxState.fail(parsed.error)
              return
            }
            run(
              postQueryTxState,
              () => api.request(scopedPath(`/query/${genericQueryTxName}`), { method: 'POST', body: parsed.value ?? {} }),
              'POST /query/{txName}'
            )
          }}
          status={postQueryTxState.status}
          error={postQueryTxState.error}
          result={postQueryTxState.result}
        >
          <Row label="nome da transação (txName)">
            <input value={genericQueryTxName} onChange={(e) => setGenericQueryTxName(e.target.value)} />
          </Row>
          <Row label="corpo (JSON)">
            <textarea value={genericQueryBodyJson} onChange={(e) => setGenericQueryBodyJson(e.target.value)} rows={8} spellCheck={false} />
          </Row>
        </EndpointCard>

        <EndpointCard
          title={`POST ${scopedPath(`/invoke/${genericInvokeTxName}`)}`}
          description="Executa uma transação em modo gravação (grava). Corpo (JSON) livre."
          onRun={() => {
            const parsed = tryParseJson(genericInvokeBodyJson)
            if (!parsed.ok) {
              postInvokeTxState.start()
              postInvokeTxState.fail(parsed.error)
              return
            }
            run(
              postInvokeTxState,
              () => api.request(scopedPath(`/invoke/${genericInvokeTxName}`), { method: 'POST', body: parsed.value ?? {} }),
              'POST /invoke/{txName}'
            )
          }}
          status={postInvokeTxState.status}
          error={postInvokeTxState.error}
          result={postInvokeTxState.result}
        >
          <Row label="nome da transação (txName)">
            <input value={genericInvokeTxName} onChange={(e) => setGenericInvokeTxName(e.target.value)} />
          </Row>
          <Row label="corpo (JSON)">
            <textarea value={genericInvokeBodyJson} onChange={(e) => setGenericInvokeBodyJson(e.target.value)} rows={8} spellCheck={false} />
          </Row>
        </EndpointCard>

        <EndpointCard
          title={`POST ${scopedPath('/invoke/createAsset')}`}
          description="Cria ativo(s). Espera { asset: [...] }."
          onRun={() => {
            const parsed = tryParseJson(createAssetJson)
            if (!parsed.ok) {
              postCreateAssetState.start()
              postCreateAssetState.fail(parsed.error)
              return
            }
            const normalizedAssets = Array.isArray(parsed.value) ? parsed.value : parsed.value ? [parsed.value] : []
            run(
              postCreateAssetState,
              () => api.request(scopedPath('/invoke/createAsset'), { method: 'POST', body: { asset: normalizedAssets } }),
              'POST /invoke/createAsset'
            )
          }}
          status={postCreateAssetState.status}
          error={postCreateAssetState.error}
          result={postCreateAssetState.result}
        >
          <Row label="ativos (JSON array)">
            <textarea value={createAssetJson} onChange={(e) => setCreateAssetJson(e.target.value)} rows={10} spellCheck={false} />
          </Row>
        </EndpointCard>

        <EndpointCard
          title={`PUT ${scopedPath('/invoke/updateAsset')}`}
          description="Atualiza um ativo. Espera { update: {...} }."
          onRun={() => {
            const parsed = tryParseJson(updateAssetJson)
            if (!parsed.ok) {
              putUpdateAssetState.start()
              putUpdateAssetState.fail(parsed.error)
              return
            }
            const update = parsed.value ?? {}
            const title = typeof update?.title === 'string' ? update.title.trim() : ''
            if (!title) {
              fail(putUpdateAssetState, 'Informe title no update para evitar 404.')
              return
            }
            run(
              putUpdateAssetState,
              () => api.request(scopedPath('/invoke/updateAsset'), { method: 'PUT', body: { update } }),
              'PUT /invoke/updateAsset'
            )
          }}
          status={putUpdateAssetState.status}
          error={putUpdateAssetState.error}
          result={putUpdateAssetState.result}
        >
          <Row label="atualização (JSON)">
            <textarea value={updateAssetJson} onChange={(e) => setUpdateAssetJson(e.target.value)} rows={10} spellCheck={false} />
          </Row>
        </EndpointCard>

        <EndpointCard
          title={`DELETE ${scopedPath('/invoke/deleteAsset')}`}
          description="Deleta um ativo. Espera { key: {...} }."
          onRun={() => {
            const parsed = tryParseJson(deleteKeyJson)
            if (!parsed.ok) {
              deleteAssetState.start()
              deleteAssetState.fail(parsed.error)
              return
            }
            const key = parsed.value ?? {}
            const title = typeof key?.title === 'string' ? key.title.trim() : ''
            if (!title) {
              fail(deleteAssetState, 'Informe title na key para evitar 404.')
              return
            }
            run(
              deleteAssetState,
              () => api.request(scopedPath('/invoke/deleteAsset'), { method: 'DELETE', body: { key } }),
              'DELETE /invoke/deleteAsset'
            )
          }}
          status={deleteAssetState.status}
          error={deleteAssetState.error}
          result={deleteAssetState.result}
        >
          <Row label="chave (JSON)">
            <textarea value={deleteKeyJson} onChange={(e) => setDeleteKeyJson(e.target.value)} rows={8} spellCheck={false} />
          </Row>
        </EndpointCard>
      </div>
    </main>
  )
}
