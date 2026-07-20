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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
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
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="primary">
            {isSignUp ? 'Cadastrar' : 'Entrar'}
          </button>

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
          <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>
            Dashboard
          </button>
          <button className={page === 'veiculos' ? 'active' : ''} onClick={() => setPage('veiculos')}>
            Veículos
          </button>
          <button className={page === 'seguros' ? 'active' : ''} onClick={() => setPage('seguros')}>
            Apólices e DDRs
          </button>
          <button className={page === 'tecnologias' ? 'active' : ''} onClick={() => setPage('tecnologias')}>
            Tecnologias
          </button>
          <button className="logout-btn" onClick={logout}>
            Sair
          </button>
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
  return (
    <>
      <div className="hero">
        <h1>SHLOG Control</h1>
        <p>Gestão de frota, apólices, DDRs e tecnologias embarcadas.</p>
      </div>

      <div className="grid">
        <div className="card"><div className="label">Veículos</div><div className="value">{vehicles.length}</div></div>
        <div className="card"><div className="label">Documentos</div><div className="value">{documents.length}</div></div>
        <div className="card"><div className="label">Tecnologias</div><div className="value">{tecnologias.length}</div></div>
      </div>
    </>
  )
}

function VehiclesPage({ vehicles }) {
  return (
    <>
      <h2 className="section-title">Veículos</h2>
      <div className="card">
        <p>Total carregado: {vehicles.length}</p>
      </div>
    </>
  )
}

function DocumentsPage({ documents }) {
  return (
    <>
      <h2 className="section-title">Apólices e DDRs</h2>
      <div className="card">
        <p>Total carregado: {documents.length}</p>
      </div>
    </>
  )
}

function TechnologiesPage({ tecnologias }) {
  return (
    <>
      <h2 className="section-title">Tecnologias</h2>
      <div className="card">
        <p>Fornecedores padrão: {FORNECEDORES.join(', ')}</p>
        <p>Itens Trucks Control: {TRUCKS_ITEMS.join(', ')}</p>
        <p>Total carregado: {tecnologias.length}</p>
      </div>
    </>
  )
}
