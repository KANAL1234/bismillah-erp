const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
    'https://eawrqszeuqvekzscuskc.supabase.co',
    'sb_secret_713a9F-mov9D5qN-w7hFfg_X0RtnOI6'
)

const sql = fs.readFileSync('supabase/migrations/20260115090000_post_delivery_note.sql', 'utf8')

async function runMigration() {
    try {
        console.log('🚀 Running migration...')

        // Execute the SQL
        const { data, error } = await supabase.rpc('exec', { sql })

        if (error) {
            console.error('❌ Error:', error)
            process.exit(1)
        }

        console.log('✅ Migration completed successfully!')
        console.log('📝 Result:', data)
    } catch (err) {
        console.error('❌ Exception:', err)
        process.exit(1)
    }
}

runMigration()
