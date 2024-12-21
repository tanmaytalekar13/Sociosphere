const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase Client Configuration
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = supabase;
