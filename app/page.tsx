import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()

  // Test database connection
  const { data, error } = await supabase.from('_test').select('*').limit(1)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">
        Bismillah Oil Agency ERP
      </h1>
      <p className="text-xl">
        {error ? 'Database not connected yet (normal)' : 'Connected!'}
      </p>
    </div>
  )
}
