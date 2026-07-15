import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_xxxxx'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
