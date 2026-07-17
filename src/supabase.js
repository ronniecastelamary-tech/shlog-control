import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dxrhzkyptanpkekcrfip.supabase.co'
const SUPABASE_ANON_KEY = 'COLE_AQUI_A_CHAVE_REAL_COMPLETA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
