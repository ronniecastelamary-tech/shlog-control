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

