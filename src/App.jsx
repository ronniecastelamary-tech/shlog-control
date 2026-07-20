import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'

const STORAGE_BUCKET = 'documentos-pdf'
const FORNECEDORES_PADRAO = ['Trucks Control', '3S', 'T4S', 'Autolife', 'Integrard']
const TRUCKS_ITEMS = [
  'Sirene',
  'Bloqueio',
  'Antena GPS',
  'Trava de 5ªRoda',
  'Trava de baú',
  'Sensor de cabine',
  'Sensor de baú',
  'Módulo'
]
const TIPOS_DOCUMENTO = ['Apólice', 'DDR', 'Declaração', 'PGR', 'Proposta', 'Complementar']
const CLASSIFICACOES = ['Principal', 'Complementar']
const TIPOS_SEGURO = ['SHLOG', 'Cliente']
const ORIGENS = ['Manual', 'PDF', 'Importação']
const STATUS_TECNOLOGIA = ['Ativo', 'Preventiva', 'Corretiva', 'Instalação', 'Substituição', 'Removido']

const emptyVehicle = {
  placa: '',
  tipo: '',
  marca: '',
  modelo: '',
  ano: '',
  bau_cofre: false,
  status: 'Ativo'
}

const emptyDocument = {
  titulo: '',
  tipo: 'Apólice',
  classificacao: 'Principal',
  seguro: 'SHLOG',
  cliente: '',
  seguradora: '',
  corretora: '',
  numero: '',
  lmg: '',
  inicio_vigencia: '',
  fim_vigencia: '',
  origem: 'Manual',
  arquivo_url: '',
  observacoes: ''
}

const emptyTech = {
  placa: '',
  fornecedor: '',
  item: '',
  status: 'Ativo',
  data_manutencao: '',
  observacoes: ''
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  const target = new Date(`${dateStr}T00:00:00`)
  return Math.ceil((target - today) / 86400000)
}

function alertLabel(days) {
  if (days === null) return '-'
  if (days < 0) return `Vencido há ${Math.abs(days)}d`
  if (days <= 7) return `${days}d · crítico`
  if (days <= 15) return `${days}d · alto`
  if (days <= 30) return `${days}d · médio`
  if (days <= 60) return `${days}d · atenção`
  return `${days}d`
}

function alertClass(days) {
  if (days === null) return 'pill neutral'
  if (days < 0) return 'pill danger'
  if (days <= 7) return 'pill danger'
  if (days <= 15) return 'pill warning'
  if (days <= 30) return 'pill warning'
  if (days <= 60) return 'pill info'
  return 'pill success'
}

function normalizeBool(value) {
  const v = String(value ?? '').trim().toLowerCase()
  return ['1', 'sim', 'true', 's', 'yes', 'y', 'x'].includes(v)
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell)
      if (row.some(col => String(col).trim() !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    if (row.some(col => String(col).trim() !== '')) rows.push(row)
  }

  if (!rows.length) return []
  const headers = rows[0].map(h => String(h).trim())
  return rows.slice(1).map(cols => {
    const obj = {}
    headers.forEach((header, idx) => {
      obj[header] = cols[idx] ?? ''
    })
    return obj
  })
}

async function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsText(file, 'utf-8')
  })
}

async function uploadPdfToSupabase(file) {
  const ext = file.name.split('.').pop() || 'pdf'
  const filePath = `documentos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: false, contentType: file.type || 'application/pdf' })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setLoading(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="loading">Carregando...</div>
  return session ? <Dashboard /> : <Login />
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    let error = null

    if (isSignUp) {
      const result = await supabase.auth.signUp({ email, password })
      error = result.error
    } else {
      const result = await supabase.auth.signInWithPassword({ email, password })
      error = result.error
    }

    if (error) {
      setMsg({ text: error.message, type: 'error' })
    } else if (isSignUp) {
      setMsg({ text: 'Cadastro criado. Verifique seu e-mail ou faça login.', type: 'success' })
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>SHLOG Control</h1>
        <p>{isSignUp ? 'Criar conta de acesso' : 'Acesse sua conta'}</p>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-field">
            <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <button type="submit" className="primary">{isSignUp ? 'Cadastrar' : 'Entrar'}</button>
          {msg.text && <div className={msg.type}>{msg.text}</div>}
        </form>
        <div className="login-toggle" onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Já tenho conta — Entrar' : 'Criar nova conta'}
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const [page, setPage] = useState('dashboard')
  const [vehicles, setVehicles] = useState([])
  const [documents, setDocuments] = useState([])
  const [tecnologias, setTecnologias] = useState([])
  const [globalMsg, setGlobalMsg] = useState({ text: '', type: '' })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const [v, d, t] = await Promise.all([
      supabase.from('veiculos').select('*').order('placa'),
      supabase.from('documentos').select('*').order('fim_vigencia', { ascending: true }),
      supabase.from('tecnologias').select('*').order('criado_em', { ascending: false })
    ])

    setVehicles(v.data || [])
    setDocuments(d.data || [])
    setTecnologias(t.data || [])

    const error = v.error || d.error || t.error
    if (error) setGlobalMsg({ text: error.message, type: 'error' })
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="layout">
      <aside>
        <div className="logo-box">
          <h2>SHLOG Control</h2>
          <p>Sistema de Gestão</p>
        </div>
        <nav className="nav">
          <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>Dashboard</button>
          <button className={page === 'veiculos' ? 'active' : ''} onClick={() => setPage('veiculos')}>Veículos</button>
          <button className={page === 'seguros' ? 'active' : ''} onClick={() => setPage('seguros')}>Apólices e DDRs</button>
          <button className={page === 'tecnologias' ? 'active' : ''} onClick={() => setPage('tecnologias')}>Tecnologias</button>
          <button className="logout-btn" onClick={logout}>Sair</button>
        </nav>
      </aside>

      <main>
        {globalMsg.text && <div className={globalMsg.type}>{globalMsg.text}</div>}
        {page === 'dashboard' && <DashboardPage vehicles={vehicles} documents={documents} tecnologias={tecnologias} />}
        {page === 'veiculos' && <VehiclesPage vehicles={vehicles} reload={loadAll} />}
        {page === 'seguros' && <DocumentsPage documents={documents} vehicles={vehicles} reload={loadAll} />}
        {page === 'tecnologias' && <TechnologiesPage tecnologias={tecnologias} vehicles={vehicles} reload={loadAll} />}
      </main>
    </div>
  )
}

function DashboardPage({ vehicles, documents, tecnologias }) {
  const carretas = vehicles.filter(v => String(v.tipo || '').toUpperCase() === 'CARRETA').length
  const bau = vehicles.filter(v => !!v.bau_cofre).length
  const shlogDocs = documents.filter(d => d.seguro === 'SHLOG').length
  const clienteDocs = documents.filter(d => d.seguro === 'Cliente').length
  const alertas = documents.filter(d => {
    const dias = daysUntil(d.fim_vigencia)
    return dias !== null && dias <= 60
  })
  const trucksControl = tecnologias.filter(t => t.fornecedor === 'Trucks Control').length

  return (
    <>
      <div className="hero">
        <h1>SHLOG Control</h1>
        <p>Gestão separada de frota, apólices/DDRs e tecnologias com controle de manutenção.</p>
      </div>

      <div className="grid eight">
        <Metric label="Veículos" value={vehicles.length} />
        <Metric label="Carretas" value={carretas} />
        <Metric label="Baú cofre" value={bau} />
        <Metric label="Documentos" value={documents.length} />
        <Metric label="Seguros SHLOG" value={shlogDocs} />
        <Metric label="Seguros cliente" value={clienteDocs} />
        <Metric label="Alertas ≤ 60d" value={alertas.length} />
        <Metric label="Itens Trucks Control" value={trucksControl} />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">Alertas de vencimento</div>
          {alertas.length === 0 ? <p>Nenhum documento com vencimento em até 60 dias.</p> : (
            <table className="table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Seguro</th>
                  <th>Fim vigência</th>
                  <th>Alerta</th>
                </tr>
              </thead>
              <tbody>
                {alertas.slice(0, 8).map(doc => {
                  const dias = daysUntil(doc.fim_vigencia)
                  return (
                    <tr key={doc.id}>
                      <td>{doc.titulo}</td>
                      <td>{doc.tipo}</td>
                      <td>{doc.seguro}</td>
                      <td>{doc.fim_vigencia || '-'}</td>
                      <td><span className={alertClass(dias)}>{alertLabel(dias)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-title">Regras aplicadas</div>
          <ul className="bullet-list">
            <li>Importação e cadastro manual de veículos.</li>
            <li>Importação, cadastro manual e PDF para Apólices e DDRs.</li>
            <li>Campos principais de documentos: vigência, LMG e flag SHLOG/Cliente.</li>
            <li>Tecnologias controlam manutenção por veículo e fornecedor.</li>
            <li>Fornecedor Trucks Control libera itens específicos.</li>
          </ul>
        </div>
      </div>
    </>
  )
}

function Metric({ label, value }) {
  return (
    <div className="card metric-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  )
}

function VehiclesPage({ vehicles, reload }) {
  const [form, setForm] = useState(emptyVehicle)
  const [editingId, setEditingId] = useState(null)
  const [busca, setBusca] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [importing, setImporting] = useState(false)

  const filtrados = useMemo(() => vehicles.filter(v =>
    [v.placa, v.tipo, v.marca, v.modelo, v.ano, v.status].some(val => String(val || '').toLowerCase().includes(busca.toLowerCase()))
  ), [vehicles, busca])

  function editItem(item) {
    setEditingId(item.id)
    setForm({
      placa: item.placa || '',
      tipo: item.tipo || '',
      marca: item.marca || '',
      modelo: item.modelo || '',
      ano: item.ano || '',
      bau_cofre: !!item.bau_cofre,
      status: item.status || 'Ativo'
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyVehicle)
  }

  async function submit(e) {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    const payload = {
      ...form,
      placa: form.placa.toUpperCase().trim(),
      tipo: form.tipo.toUpperCase().trim(),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      ano: form.ano.trim()
    }

    const query = editingId
      ? supabase.from('veiculos').update(payload).eq('id', editingId)
      : supabase.from('veiculos').insert([payload])

    const { error } = await query
    if (error) return setMsg({ text: error.message, type: 'error' })

    setMsg({ text: editingId ? 'Veículo atualizado.' : 'Veículo cadastrado.', type: 'success' })
    resetForm()
    reload()
  }

  async function removeItem(id) {
    if (!confirm('Excluir este veículo?')) return
    const { error } = await supabase.from('veiculos').delete().eq('id', id)
    if (error) return setMsg({ text: error.message, type: 'error' })
    setMsg({ text: 'Veículo excluído.', type: 'success' })
    reload()
  }

  async function handleImport(file) {
    if (!file) return
    setImporting(true)
    setMsg({ text: '', type: '' })

    try {
      const text = await readTextFile(file)
      const rows = parseCsv(text)
      const payload = rows.map(r => ({
        placa: String(r.placa || r.PLACA || '').trim().toUpperCase(),
        tipo: String(r.tipo || r['TIPO VEÍCULO'] || r.tipo_veiculo || '').trim().toUpperCase(),
        marca: String(r.marca || r.MARCA || '').trim(),
        modelo: String(r.modelo || r.MODELO || '').trim(),
        ano: String(r.ano || r.ANO || '').trim(),
        bau_cofre: normalizeBool(r.bau_cofre ?? r.BAU_COFRE),
        status: String(r.status || r.STATUS || 'Ativo').trim()
      })).filter(v => v.placa)

      if (!payload.length) throw new Error('Nenhum registro válido encontrado no CSV de veículos.')
      const { error } = await supabase.from('veiculos').upsert(payload, { onConflict: 'placa' })
      if (error) throw error
      setMsg({ text: `${payload.length} veículos importados/atualizados.`, type: 'success' })
      reload()
    } catch (error) {
      setMsg({ text: error.message || 'Falha ao importar veículos.', type: 'error' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <h2 className="section-title">Veículos</h2>
      {msg.text && <div className={msg.type}>{msg.text}</div>}

      <div className="card">
        <div className="card-title">Importação de veículos</div>
        <p className="helper">CSV com colunas: placa, tipo, marca, modelo, ano, bau_cofre, status. Também aceita cabeçalhos em maiúsculo, como PLACA e TIPO VEÍCULO.</p>
        <input type="file" accept=".csv,text/csv" onChange={e => handleImport(e.target.files?.[0])} disabled={importing} />
      </div>

      <div className="card">
        <div className="card-title">{editingId ? 'Editar veículo' : 'Novo veículo'}</div>
        <form onSubmit={submit}>
          <div className="form-grid three">
            <input placeholder="Placa" value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value })} required />
            <input placeholder="Tipo" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} required />
            <input placeholder="Marca" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} />
            <input placeholder="Modelo" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} />
            <input placeholder="Ano" value={form.ano} onChange={e => setForm({ ...form, ano: e.target.value })} />
            <input placeholder="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} />
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.bau_cofre} onChange={e => setForm({ ...form, bau_cofre: e.target.checked })} />
            Possui baú cofre
          </label>
          <div className="actions-row">
            <button type="submit" className="primary">{editingId ? 'Salvar alterações' : 'Cadastrar veículo'}</button>
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancelar edição</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="card-title">Lista de veículos</div>
          <input placeholder="Buscar por placa, tipo, marca..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Placa</th>
              <th>Tipo</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Ano</th>
              <th>Baú cofre</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(item => (
              <tr key={item.id}>
                <td>{item.placa}</td>
                <td>{item.tipo}</td>
                <td>{item.marca || '-'}</td>
                <td>{item.modelo || '-'}</td>
                <td>{item.ano || '-'}</td>
                <td>{item.bau_cofre ? 'Sim' : 'Não'}</td>
                <td>{item.status || '-'}</td>
                <td className="actions-cell">
                  <button className="link-btn" onClick={() => editItem(item)}>Editar</button>
                  <button className="link-btn danger-text" onClick={() => removeItem(item.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function DocumentsPage({ documents, vehicles, reload }) {
  const [form, setForm] = useState(emptyDocument)
  const [editingId, setEditingId] = useState(null)
  const [busca, setBusca] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [placaFiltro, setPlacaFiltro] = useState('')
  const [importing, setImporting] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)

  const filtrados = useMemo(() => documents.filter(d => {
    const textoOk = [d.titulo, d.tipo, d.classificacao, d.seguro, d.cliente, d.seguradora, d.numero, d.lmg]
      .some(val => String(val || '').toLowerCase().includes(busca.toLowerCase()))
    const placaOk = !placaFiltro || String(d.observacoes || '').toLowerCase().includes(placaFiltro.toLowerCase())
    return textoOk && placaOk
  }), [documents, busca, placaFiltro])

  function editItem(item) {
    setEditingId(item.id)
    setForm({
      titulo: item.titulo || '',
      tipo: item.tipo || 'Apólice',
      classificacao: item.classificacao || 'Principal',
      seguro: item.seguro || 'SHLOG',
      cliente: item.cliente || '',
      seguradora: item.seguradora || '',
      corretora: item.corretora || '',
      numero: item.numero || '',
      lmg: item.lmg || '',
      inicio_vigencia: item.inicio_vigencia || '',
      fim_vigencia: item.fim_vigencia || '',
      origem: item.origem || 'Manual',
      arquivo_url: item.arquivo_url || '',
      observacoes: item.observacoes || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyDocument)
  }

  async function submit(e) {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    const payload = { ...form }
    const query = editingId
      ? supabase.from('documentos').update(payload).eq('id', editingId)
      : supabase.from('documentos').insert([payload])

    const { error } = await query
    if (error) return setMsg({ text: error.message, type: 'error' })

    setMsg({ text: editingId ? 'Documento atualizado.' : 'Documento cadastrado.', type: 'success' })
    resetForm()
    reload()
  }

  async function removeItem(id) {
    if (!confirm('Excluir este documento?')) return
    const { error } = await supabase.from('documentos').delete().eq('id', id)
    if (error) return setMsg({ text: error.message, type: 'error' })
    setMsg({ text: 'Documento excluído.', type: 'success' })
    reload()
  }

  async function handleImport(file) {
    if (!file) return
    setImporting(true)
    setMsg({ text: '', type: '' })

    try {
      const text = await readTextFile(file)
      const rows = parseCsv(text)
      const payload = rows.map(r => ({
        titulo: String(r.titulo || r.TITULO || '').trim(),
        tipo: String(r.tipo || r.TIPO || 'Apólice').trim(),
        classificacao: String(r.classificacao || r.CLASSIFICACAO || 'Principal').trim(),
        seguro: String(r.seguro || r.SEGURO || 'SHLOG').trim(),
        cliente: String(r.cliente || r.CLIENTE || '').trim(),
        seguradora: String(r.seguradora || r.SEGURADORA || '').trim(),
        corretora: String(r.corretora || r.CORRETORA || '').trim(),
        numero: String(r.numero || r.NUMERO || '').trim(),
        lmg: String(r.lmg || r.LMG || '').trim(),
        inicio_vigencia: String(r.inicio_vigencia || r.INICIO_VIGENCIA || '').trim(),
        fim_vigencia: String(r.fim_vigencia || r.FIM_VIGENCIA || '').trim(),
        origem: String(r.origem || r.ORIGEM || 'Importação').trim(),
        arquivo_url: String(r.arquivo_url || r.ARQUIVO_URL || '').trim(),
        observacoes: String(r.observacoes || r.OBSERVACOES || '').trim()
      })).filter(d => d.titulo)

      if (!payload.length) throw new Error('Nenhum registro válido encontrado no CSV de documentos.')
      const { error } = await supabase.from('documentos').insert(payload)
      if (error) throw error
      setMsg({ text: `${payload.length} documentos importados.`, type: 'success' })
      reload()
    } catch (error) {
      setMsg({ text: error.message || 'Falha ao importar documentos.', type: 'error' })
    } finally {
      setImporting(false)
    }
  }

  async function handlePdfUpload(file) {
    if (!file) return
    setUploadingPdf(true)
    setMsg({ text: '', type: '' })
    try {
      const url = await uploadPdfToSupabase(file)
      setForm(prev => ({
        ...prev,
        origem: 'PDF',
        arquivo_url: url,
        titulo: prev.titulo || file.name.replace(/\.pdf$/i, '')
      }))
      setMsg({ text: 'PDF enviado. Agora finalize os demais campos e salve.', type: 'success' })
    } catch (error) {
      setMsg({ text: error.message || 'Falha ao enviar PDF.', type: 'error' })
    } finally {
      setUploadingPdf(false)
    }
  }

  return (
    <>
      <h2 className="section-title">Apólices e DDRs</h2>
      {msg.text && <div className={msg.type}>{msg.text}</div>}

      <div className="card">
        <div className="card-title">Importação de apólices e DDRs</div>
        <p className="helper">CSV com colunas: titulo, tipo, classificacao, seguro, cliente, seguradora, corretora, numero, lmg, inicio_vigencia, fim_vigencia, origem, arquivo_url, observacoes.</p>
        <input type="file" accept=".csv,text/csv" onChange={e => handleImport(e.target.files?.[0])} disabled={importing} />
      </div>

      <div className="card">
        <div className="card-title">Cadastro manual ou por PDF</div>
        <div className="helper">Você pode preencher manualmente ou subir um PDF para gravar a URL no cadastro.</div>
        <input type="file" accept="application/pdf,.pdf" onChange={e => handlePdfUpload(e.target.files?.[0])} disabled={uploadingPdf} />
      </div>

      <div className="card">
        <div className="card-title">{editingId ? 'Editar documento' : 'Novo documento'}</div>
        <form onSubmit={submit}>
          <div className="form-grid three">
            <input placeholder="Título" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required />
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>{TIPOS_DOCUMENTO.map(v => <option key={v}>{v}</option>)}</select>
            <select value={form.classificacao} onChange={e => setForm({ ...form, classificacao: e.target.value })}>{CLASSIFICACOES.map(v => <option key={v}>{v}</option>)}</select>
            <select value={form.seguro} onChange={e => setForm({ ...form, seguro: e.target.value })}>{TIPOS_SEGURO.map(v => <option key={v}>{v}</option>)}</select>
            <input placeholder="Cliente / Segurado" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} />
            <input placeholder="Seguradora" value={form.seguradora} onChange={e => setForm({ ...form, seguradora: e.target.value })} />
            <input placeholder="Corretora" value={form.corretora} onChange={e => setForm({ ...form, corretora: e.target.value })} />
            <input placeholder="Número da apólice / DDR" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} />
            <input placeholder="LMG" value={form.lmg} onChange={e => setForm({ ...form, lmg: e.target.value })} />
            <input type="date" value={form.inicio_vigencia} onChange={e => setForm({ ...form, inicio_vigencia: e.target.value })} />
            <input type="date" value={form.fim_vigencia} onChange={e => setForm({ ...form, fim_vigencia: e.target.value })} />
            <select value={form.origem} onChange={e => setForm({ ...form, origem: e.target.value })}>{ORIGENS.map(v => <option key={v}>{v}</option>)}</select>
            <input className="full-span" placeholder="URL do PDF" value={form.arquivo_url} onChange={e => setForm({ ...form, arquivo_url: e.target.value })} />
            <textarea className="full-span" rows="3" placeholder="Observações / placas / vínculo operacional" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div className="actions-row">
            <button type="submit" className="primary">{editingId ? 'Salvar alterações' : 'Cadastrar documento'}</button>
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancelar edição</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar two-lines">
          <div className="card-title">Lista de apólices e DDRs</div>
          <div className="toolbar-filters">
            <input placeholder="Buscar por título, tipo, seguradora, número..." value={busca} onChange={e => setBusca(e.target.value)} />
            <select value={placaFiltro} onChange={e => setPlacaFiltro(e.target.value)}>
              <option value="">Filtrar por placa em observações</option>
              {vehicles.map(v => <option key={v.id} value={v.placa}>{v.placa}</option>)}
            </select>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Tipo</th>
              <th>Seguro</th>
              <th>LMG</th>
              <th>Fim vigência</th>
              <th>Alerta</th>
              <th>Origem</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(item => {
              const dias = daysUntil(item.fim_vigencia)
              return (
                <tr key={item.id}>
                  <td>{item.titulo}</td>
                  <td>{item.tipo}</td>
                  <td>{item.seguro}</td>
                  <td>{item.lmg || '-'}</td>
                  <td>{item.fim_vigencia || '-'}</td>
                  <td><span className={alertClass(dias)}>{alertLabel(dias)}</span></td>
                  <td>{item.origem || '-'}</td>
                  <td className="actions-cell">
                    <button className="link-btn" onClick={() => editItem(item)}>Editar</button>
                    <button className="link-btn danger-text" onClick={() => removeItem(item.id)}>Excluir</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function TechnologiesPage({ tecnologias, vehicles, reload }) {
  const [form, setForm] = useState(emptyTech)
  const [editingId, setEditingId] = useState(null)
  const [busca, setBusca] = useState('')
  const [fornecedorExtra, setFornecedorExtra] = useState('')
  const [itemExtra, setItemExtra] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })

  const fornecedores = useMemo(() => {
    const extras = tecnologias.map(t => t.fornecedor).filter(Boolean)
    return [...new Set([...FORNECEDORES_PADRAO, ...extras])]
  }, [tecnologias])

  const itensTrucks = useMemo(() => {
    const extras = tecnologias.filter(t => t.fornecedor === 'Trucks Control').map(t => t.item).filter(Boolean)
    return [...new Set([...TRUCKS_ITEMS, ...extras])]
  }, [tecnologias])

  const filtrados = useMemo(() => tecnologias.filter(t =>
    [t.placa, t.fornecedor, t.item, t.status, t.data_manutencao, t.observacoes].some(val => String(val || '').toLowerCase().includes(busca.toLowerCase()))
  ), [tecnologias, busca])

  function editItem(item) {
    setEditingId(item.id)
    setForm({
      placa: item.placa || '',
      fornecedor: item.fornecedor || '',
      item: item.item || '',
      status: item.status || 'Ativo',
      data_manutencao: item.data_manutencao || '',
      observacoes: item.observacoes || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setFornecedorExtra('')
    setItemExtra('')
    setForm(emptyTech)
  }

  async function submit(e) {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    const fornecedorFinal = form.fornecedor === '__novo__' ? fornecedorExtra.trim() : form.fornecedor
    const itemFinal = form.item === '__novo__' ? itemExtra.trim() : form.item

    if (!fornecedorFinal) return setMsg({ text: 'Informe o fornecedor.', type: 'error' })
    if (!itemFinal) return setMsg({ text: 'Informe o item.', type: 'error' })

    const payload = {
      placa: form.placa.toUpperCase().trim(),
      fornecedor: fornecedorFinal,
      item: itemFinal,
      status: form.status,
      data_manutencao: form.data_manutencao || null,
      observacoes: form.observacoes
    }

    const query = editingId
      ? supabase.from('tecnologias').update(payload).eq('id', editingId)
      : supabase.from('tecnologias').insert([payload])

    const { error } = await query
    if (error) return setMsg({ text: error.message, type: 'error' })

    setMsg({ text: editingId ? 'Tecnologia atualizada.' : 'Tecnologia cadastrada.', type: 'success' })
    resetForm()
    reload()
  }

  async function removeItem(id) {
    if (!confirm('Excluir este item de tecnologia?')) return
    const { error } = await supabase.from('tecnologias').delete().eq('id', id)
    if (error) return setMsg({ text: error.message, type: 'error' })
    setMsg({ text: 'Tecnologia excluída.', type: 'success' })
    reload()
  }

  const isTrucks = form.fornecedor === 'Trucks Control'

  return (
    <>
      <h2 className="section-title">Tecnologias</h2>
      {msg.text && <div className={msg.type}>{msg.text}</div>}

      <div className="card">
        <div className="card-title">{editingId ? 'Editar tecnologia' : 'Novo controle de tecnologia / manutenção'}</div>
        <form onSubmit={submit}>
          <div className="form-grid three">
            <select value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value })} required>
              <option value="">Placa do veículo</option>
              {vehicles.map(v => <option key={v.id} value={v.placa}>{v.placa}</option>)}
            </select>

            <select value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value, item: '' })} required>
              <option value="">Fornecedor</option>
              {fornecedores.map(v => <option key={v}>{v}</option>)}
              <option value="__novo__">+ Novo fornecedor</option>
            </select>

            {form.fornecedor === '__novo__' ? (
              <input placeholder="Nome do novo fornecedor" value={fornecedorExtra} onChange={e => setFornecedorExtra(e.target.value)} required />
            ) : isTrucks ? (
              <select value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} required>
                <option value="">Item Trucks Control</option>
                {itensTrucks.map(v => <option key={v}>{v}</option>)}
                <option value="__novo__">+ Novo item</option>
              </select>
            ) : (
              <input placeholder="Item / equipamento" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} required />
            )}

            {form.item === '__novo__' && (
              <input placeholder="Novo item Trucks Control" value={itemExtra} onChange={e => setItemExtra(e.target.value)} required />
            )}

            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {STATUS_TECNOLOGIA.map(v => <option key={v}>{v}</option>)}
            </select>
            <input type="date" value={form.data_manutencao} onChange={e => setForm({ ...form, data_manutencao: e.target.value })} />
            <textarea className="full-span" rows="3" placeholder="Observações" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div className="actions-row">
            <button type="submit" className="primary">{editingId ? 'Salvar alterações' : 'Cadastrar tecnologia'}</button>
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancelar edição</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="card-title">Lista de tecnologias / manutenções</div>
          <input placeholder="Buscar por placa, fornecedor, item..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Placa</th>
              <th>Fornecedor</th>
              <th>Item</th>
              <th>Status</th>
              <th>Data manutenção</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(item => (
              <tr key={item.id}>
                <td>{item.placa}</td>
                <td>{item.fornecedor}</td>
                <td>{item.item}</td>
                <td>{item.status || '-'}</td>
                <td>{item.data_manutencao || '-'}</td>
                <td className="actions-cell">
                  <button className="link-btn" onClick={() => editItem(item)}>Editar</button>
                  <button className="link-btn danger-text" onClick={() => removeItem(item.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
