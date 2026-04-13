const SUPABASE_URL = "https://bubcilkbujuycpvysico.supabase.co";
const SUPABASE_KEY = "sb_publishable_9ScFMiMlii1eQo-BxvbOZg_LRXvTloH";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// joga global
window.supabaseClient = supabaseClient;