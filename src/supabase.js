import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dxrhzkyptanpkekcrfip.supabase.co'
const SUPABASE_ANON_KEY = 'SUA_CHAVE_REAL_AQUI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
