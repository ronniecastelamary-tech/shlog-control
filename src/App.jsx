import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

const FORNECEDORES = ['Trucks Control', '3S', 'T4S', 'Autolife', 'Integrard']
const TRUCKS_ITEMS = ['Sirene', 'Bloqueio', 'Antena GPS', 'Trava de 5ªRoda', 'Trava de bau', 'Sensor de cabine', 'Sensor de bau', 'Modulo']

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
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
    const fn = isSignUp ? supabase.auth.signUp : supabase.auth.signInWithPassword
    const { error } = await fn({ email, password })
    if (error) setMsg({ text: error.message, type: 'error' })
    else if (isSignUp) setMsg({ text: 'Cadastro criado. Verifique seu e-mail ou faça login.', type: 'success' })
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>SHLOG Control</h1>
        <p>{isSignUp ? 'Criar conta de acesso' : 'Acesse sua conta'}</p>
        <form onSubmit={handleSubmit}>
          <div className="form-field"><input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="form-field"><input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></div>
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
  }

  async function logout() { await supabase.auth.signOut() }

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
        {page === 'dashboard' && <DashboardPage vehicles={vehicles} documents={documents} tecnologias={tecnologias} />}
        {page === 'veiculos' && <VehiclesPage vehicles={vehicles} reload={loadAll} />}
        {page === 'seguros' && <DocumentsPage documents={documents} reload={loadAll} />}
        {page === 'tecnologias' && <TechnologiesPage tecnologias={tecnologias} reload={loadAll} />}
      </main>
    </div>
  )
}

function DashboardPage({ vehicles, documents, tecnologias }) {
  const carretas = vehicles.filter(v => v.tipo === 'CARRETA').length
  const bau = vehicles.filter(v => v.bau_cofre).length
  const shlogDocs = documents.filter(d => d.seguro === 'SHLOG').length
  const clienteDocs = documents.filter(d => d.seguro === 'Cliente').length

  const hoje = new Date()
  const alertas = documents.filter(d => {
    if (!d.fim_vigencia) return false
    const dias = Math.round((new Date(d.fim_vigencia) - hoje) / 86400000)
    return dias <= 60
  })

  return (
    <>
      <div className="hero">
        <h1>SHLOG Control</h1>
        <p>Gestão de frota, apólices, DDRs e tecnologias embarcadas.</p>
      </div>
      <div className="grid">
        <div className="card"><div className="label">Veículos</div><div className="value">{vehicles.length}</div></div>
        <div className="card"><div className="label">Carretas</div><div className="value">{carretas}</div></div>
        <div className="card"><div className="label">Baú cofre</div><div className="value">{bau}</div></div>
        <div className="card"><div className="label">Documentos</div><div className="value">{documents.length}</div></div>
        <div className="card"><div className="label">Seguros SHLOG</div><div className="value">{shlogDocs}</div></div>
        <div className="card"><div className="label">Seguros do cliente</div><div className="value">{clienteDocs}</div></div>
        <div className="card"><div className="label">Alertas ≤ 60d</div><div className="value">{alertas.length}</div></div>
        <div className="card"><div className="label">Manutenções</div><div className="value">{tecnologias.length}</div></div>
      </div>
    </>
  )
}

function VehiclesPage({ vehicles, reload }) {
  const [form, setForm] = useState({ placa: '', tipo: '', marca: '', modelo: '', ano: '', bau_cofre: false })
  const [busca, setBusca] = useState('')

  async function submit(e) {
    e.preventDefault()
    const { error } = await supabase.from('veiculos').insert([{ ...form, placa: form.placa.toUpperCase() }])
    if (error) return alert(error.message)
    setForm({ placa: '', tipo: '', marca: '', modelo: '', ano: '', bau_cofre: false })
    reload()
  }

  async function excluir(id) {
    if (!confirm('Excluir este veículo?')) return
    await supabase.from('veiculos').delete().eq('id', id)
    reload()
  }

  const filtrados = vehicles.filter(v => Object.values(v).some(val => String(val || '').toLowerCase().includes(busca.toLowerCase())))

  return (
    <>
      <h2 className="section-title">Veículos</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={submit}>
          <div className="form-grid three">
            <input placeholder="Placa" value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value })} required />
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value, bau_cofre: e.target.value === 'CARRETA' })} required>
              <option value="">Tipo</option><option>CARRETA</option><option>CAVALO</option><option>VUC</option>
            </select>
            <input placeholder="Marca" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} />
            <input placeholder="Modelo" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} />
            <input placeholder="Ano" value={form.ano} onChange={e => setForm({ ...form, ano: e.target.value })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.bau_cofre} onChange={e => setForm({ ...form, bau_cofre: e.target.checked })} /> Baú cofre
            </label>
          </div>
          <button className="primary" type="submit">Adicionar veículo</button>
        </form>
      </div>
      <div className="card">
        <div className="filter-bar"><input placeholder="Buscar placa, marca, modelo ou tipo" value={busca} onChange={e => setBusca(e.target.value)} /></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Placa</th><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Ano</th><th>Baú cofre</th><th></th></tr></thead>
            <tbody>
              {filtrados.map(v => (
                <tr key={v.id}>
                  <td>{v.placa}</td><td>{v.tipo}</td><td>{v.marca}</td><td>{v.modelo}</td><td>{v.ano}</td>
                  <td><span className={`pill ${v.bau_cofre ? 'ok' : 'info'}`}>{v.bau_cofre ? 'Sim' : 'Não'}</span></td>
                  <td><button className="primary danger" onClick={() => excluir(v.id)} style={{ padding: '4px 10px', fontSize: 12 }}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function DocumentsPage({ documents, reload }) {
  const [form, setForm] = useState({ titulo: '', tipo: '', classificacao: 'Principal', seguro: 'SHLOG', origem: 'Manual', cliente: '', seguradora: '', corretora: '', numero: '', lmg: '', inicio_vigencia: '', fim_vigencia: '' })
  const [pdf, setPdf] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [busca, setBusca] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setEnviando(true)
    let arquivo_url = null
    if (pdf) {
      const nome = `${Date.now()}-${pdf.name}`
      const { error: upErr } = await supabase.storage.from('documentos-pdf').upload(nome, pdf)
      if (upErr) { alert(upErr.message); setEnviando(false); return }
      const { data } = supabase.storage.from('documentos-pdf').getPublicUrl(nome)
      arquivo_url = data.publicUrl
    }
    const payload = { ...form, arquivo_url }
    if (!payload.inicio_vigencia) delete payload.inicio_vigencia
    if (!payload.fim_vigencia) delete payload.fim_vigencia
    const { error } = await supabase.from('documentos').insert([payload])
    setEnviando(false)
    if (error) return alert(error.message)
    setForm({ titulo: '', tipo: '', classificacao: 'Principal', seguro: 'SHLOG', origem: 'Manual', cliente: '', seguradora: '', corretora: '', numero: '', lmg: '', inicio_vigencia: '', fim_vigencia: '' })
    setPdf(null)
    document.getElementById('pdfInput').value = ''
    reload()
  }

  async function excluir(id) {
    if (!confirm('Excluir este documento?')) return
    await supabase.from('documentos').delete().eq('id', id)
    reload()
  }

  function alertaVigencia(fim) {
    if (!fim) return { text: '-', cls: 'info' }
    const dias = Math.round((new Date(fim) - new Date()) / 86400000)
    if (dias < 0) return { text: `Vencido ${Math.abs(dias)}d`, cls: 'bad' }
    if (dias <= 30) return { text: `${dias}d`, cls: 'bad' }
    if (dias <= 60) return { text: `${dias}d`, cls: 'warn' }
    return { text: `${dias}d`, cls: 'ok' }
  }

  const filtrados = documents.filter(d => {
    if (filtro && d.seguro !== filtro) return false
    if (busca && !Object.values(d).some(val => String(val || '').toLowerCase().includes(busca.toLowerCase()))) return false
    return true
  })

  return (
    <>
      <h2 className="section-title">Apólices e DDRs</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={submit}>
          <div className="form-grid three">
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} required>
              <option value="">Tipo</option><option>Apólice</option><option>DDR</option><option>Declaração de Seguro</option><option>PGR</option><option>Proposta de Seguro</option><option>Proposta Comercial</option>
            </select>
            <select value={form.classificacao} onChange={e => setForm({ ...form, classificacao: e.target.value })}>
              <option>Principal</option><option>Complementar</option>
            </select>
            <select value={form.seguro} onChange={e => setForm({ ...form, seguro: e.target.value })}>
              <option value="SHLOG">Seguro SHLOG</option><option value="Cliente">Seguro do cliente</option>
            </select>
            <select value={form.origem} onChange={e => setForm({ ...form, origem: e.target.value })}>
              <option>Manual</option><option>PDF</option>
            </select>
            <input placeholder="Título" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required />
            <input placeholder="Cliente / Segurado" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} />
            <input placeholder="Seguradora / Emissor" value={form.seguradora} onChange={e => setForm({ ...form, seguradora: e.target.value })} />
            <input placeholder="Corretora" value={form.corretora} onChange={e => setForm({ ...form, corretora: e.target.value })} />
            <input placeholder="Número / carta / apólice" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} />
            <input placeholder="LMG (Limite Máximo de Garantia)" value={form.lmg} onChange={e => setForm({ ...form, lmg: e.target.value })} />
            <input type="date" value={form.inicio_vigencia} onChange={e => setForm({ ...form, inicio_vigencia: e.target.value })} />
            <input type="date" value={form.fim_vigencia} onChange={e => setForm({ ...form, fim_vigencia: e.target.value })} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#6a7a92' }}>Anexar PDF (opcional):</label>
            <input id="pdfInput" type="file" accept="application/pdf" onChange={e => setPdf(e.target.files[0])} style={{ marginTop: 6 }} />
          </div>
          <button className="primary" type="submit" disabled={enviando}>{enviando ? 'Enviando...' : 'Adicionar apólice ou DDR'}</button>
        </form>
      </div>
      <div className="card">
        <div className="filter-bar">
          <input placeholder="Buscar por título, cliente, número, seguradora" value={busca} onChange={e => setBusca(e.target.value)} />
          <select value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="">Todos os seguros</option><option value="SHLOG">Seguro SHLOG</option><option value="Cliente">Seguro do cliente</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Título</th><th>Tipo</th><th>Classificação</th><th>Seguro</th><th>Cliente</th><th>Seguradora</th><th>Número</th><th>LMG</th><th>Início</th><th>Fim</th><th>Alerta</th><th>PDF</th><th></th></tr></thead>
            <tbody>
              {filtrados.map(d => {
                const a = alertaVigencia(d.fim_vigencia)
                return (
                  <tr key={d.id}>
                    <td>{d.titulo}</td><td>{d.tipo}</td><td>{d.classificacao}</td>
                    <td><span className={`pill ${d.seguro === 'SHLOG' ? 'shlog' : 'client'}`}>{d.seguro === 'SHLOG' ? 'Seguro SHLOG' : 'Seguro do cliente'}</span></td>
                    <td>{d.cliente || '-'}</td><td>{d.seguradora || '-'}</td><td>{d.numero || '-'}</td><td>{d.lmg || '-'}</td>
                    <td>{d.inicio_vigencia || '-'}</td><td>{d.fim_vigencia || '-'}</td>
                    <td><span className={`pill ${a.cls}`}>{a.text}</span></td>
                    <td>{d.arquivo_url ? <a href={d.arquivo_url} target="_blank" rel="noreferrer">Ver</a> : '-'}</td>
                    <td><button className="primary danger" onClick={() => excluir(d.id)} style={{ padding: '4px 10px', fontSize: 12 }}>Excluir</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function TechnologiesPage({ tecnologias, reload }) {
  const [form, setForm] = useState({ placa: '', fornecedor: '', item: '', status: '', data_manutencao: '', observacoes: '' })
  const [customItem, setCustomItem] = useState('')
  const [busca, setBusca] = useState('')

  async function submit(e) {
    e.preventDefault()
    const item = form.item === '__outro__' ? customItem : form.item
    if (!item) return alert('Informe o item')
    const payload = { ...form, item, placa: form.placa.toUpperCase() }
    if (!payload.data_manutencao) delete payload.data_manutencao
    const { error } = await supabase.from('tecnologias').insert([payload])
    if (error) return alert(error.message)
    setForm({ placa: '', fornecedor: '', item: '', status: '', data_manutencao: '', observacoes: '' })
    setCustomItem('')
    reload()
  }

  async function excluir(id) {
    if (!confirm('Excluir este registro?')) return
    await supabase.from('tecnologias').delete().eq('id', id)
    reload()
  }

  const filtrados = tecnologias.filter(t => Object.values(t).some(val => String(val || '').toLowerCase().includes(busca.toLowerCase())))
  const mostrarItens = form.fornecedor === 'Trucks Control'

  return (
    <>
      <h2 className="section-title">Tecnologias — Manutenção de veículos</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={submit}>
          <div className="form-grid three">
            <input placeholder="Placa" value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value })} required />
            <select value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value, item: '' })} required>
              <option value="">Fornecedor</option>
              {FORNECEDORES.map(f => <option key={f}>{f}</option>)}
            </select>
            {mostrarItens ? (
              <select value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} required>
                <option value="">Item Trucks Control</option>
                {TRUCKS_ITEMS.map(i => <option key={i}>{i}</option>)}
                <option value="__outro__">+ Outro item</option>
              </select>
            ) : (
              <input placeholder="Item / serviço" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} required />
            )}
            {form.item === '__outro__' && <input placeholder="Descreva o novo item" value={customItem} onChange={e => setCustomItem(e.target.value)} required />}
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="">Status</option><option>Preventiva</option><option>Corretiva</option><option>Instalação</option><option>Substituição</option><option>Removido</option>
            </select>
            <input type="date" value={form.data_manutencao} onChange={e => setForm({ ...form, data_manutencao: e.target.value })} />
          </div>
          <textarea placeholder="Observações" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows="2" style={{ marginBottom: 10 }}></textarea>
          <button className="primary" type="submit">Registrar manutenção</button>
        </form>
      </div>
      <div className="card">
        <div className="filter-bar"><input placeholder="Buscar por placa, fornecedor ou item" value={busca} onChange={e => setBusca(e.target.value)} /></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Placa</th><th>Fornecedor</th><th>Item</th><th>Status</th><th>Data</th><th>Observações</th><th></th></tr></thead>
            <tbody>
              {filtrados.map(t => (
                <tr key={t.id}>
                  <td>{t.placa}</td><td>{t.fornecedor}</td><td>{t.item}</td><td>{t.status || '-'}</td><td>{t.data_manutencao || '-'}</td><td>{t.observacoes || '-'}</td>
                  <td><button className="primary danger" onClick={() => excluir(t.id)} style={{ padding: '4px 10px', fontSize: 12 }}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

