const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = 'https://eawrqszeuqvekzscuskc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhd3Jxc3pldXF2ZWt6c2N1c2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4MjIxODcsImV4cCI6MjA1MTM5ODE4N30.eFvVLvCKPJwqwLjDLbRhFxJjKRNRxXGVPQpYfJJPbZo'

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
    console.log('📦 Reading migration file...')
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260114000200_inventory_valuation.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('🚀 Applying migration to database...')
    console.log('   Migration size:', sql.length, 'bytes')

    // Split SQL into individual statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log('   Total statements:', statements.length)

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';'

        // Skip comments
        if (statement.trim().startsWith('--') || statement.trim().startsWith('/*')) {
            continue
        }

        try {
            const { data, error } = await supabase.rpc('exec_sql', { query: statement })

            if (error) {
                console.error(`❌ Statement ${i + 1} failed:`, error.message)
                console.error('   SQL:', statement.substring(0, 100) + '...')
                errorCount++
            } else {
                successCount++
                if ((i + 1) % 10 === 0) {
                    console.log(`   Progress: ${i + 1}/${statements.length} statements`)
                }
            }
        } catch (err) {
            console.error(`❌ Statement ${i + 1} exception:`, err.message)
            errorCount++
        }
    }

    console.log('\n✅ Migration complete!')
    console.log(`   Success: ${successCount} statements`)
    console.log(`   Errors: ${errorCount} statements`)

    // Verify tables and functions created
    console.log('\n🔍 Verifying migration...')

    const { data: tables, error: tableError } = await supabase
        .from('inventory_cost_layers')
        .select('count')
        .limit(1)

    if (!tableError) {
        console.log('✅ inventory_cost_layers table exists')
    } else {
        console.log('❌ inventory_cost_layers table check failed:', tableError.message)
    }

    console.log('\n✨ Done!')
}

applyMigration().catch(console.error)
