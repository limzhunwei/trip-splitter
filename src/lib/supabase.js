import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ltawuhmydsmvegcvsydf.supabase.co'
const supabaseAnonKey = 'sb_publishable_uOK8HU6QKRKdykFCAgEJlw_AxzvzmTJ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
