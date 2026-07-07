import { createClient } from '@supabase/supabase-js'

// Notice the quotes wrapping the values completely below!
const supabaseUrl = 'https://bimeizflzmrfhpsydamx.supabase.co'
const supabaseAnonKey = 'sb_publishable_z_Nhab-P-mdWiH1AM0LcEQ_dCEk2BoO'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)