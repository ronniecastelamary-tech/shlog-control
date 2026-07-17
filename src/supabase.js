import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dxrhzkyptanpkekcrfip.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Mhxc8vP3gk9Ab'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
