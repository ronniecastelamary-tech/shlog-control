import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'COLE_AQUI_A_URL'
const SUPABASE_ANON_KEY = 'COLE_AQUI_A_CHAVE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
