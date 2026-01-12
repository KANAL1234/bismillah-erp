import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function TestDatabasePage() {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    // Test 1: Count products
    const { count: productCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
    const { count: adminProductCount } = await adminSupabase
        .from('products')
        .select('*', { count: 'exact', head: true })

    // Test 2: Get location types
    const { data: locationTypes, error: locationsError } = await supabase
        .from('location_types')
        .select('*')
    const { data: adminLocationTypes } = await adminSupabase
        .from('location_types')
        .select('*')

    // Test 3: Get roles
    const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('name, description')
    const { data: adminRoles } = await adminSupabase
        .from('roles')
        .select('name, description')

    // Test 4: Get UOMs
    const { data: uoms, error: uomsError } = await supabase
        .from('units_of_measure')
        .select('code, name')
    const { data: adminUoms } = await adminSupabase
        .from('units_of_measure')
        .select('code, name')

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-4xl font-bold mb-8">Database Connection Test</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Products</CardTitle>
                        <CardDescription>Total products in database</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {productsError ? (
                            <p className="text-red-500 text-sm">Error: {JSON.stringify(productsError)}</p>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-3xl font-bold">Anon: {productCount || 0}</p>
                                <p className="text-xl text-blue-600">Admin: {adminProductCount || 0}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Location Types</CardTitle>
                        <CardDescription>Available location types</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-bold border-b mb-2">Anon Client</h4>
                                {locationTypes?.map((type: any) => (
                                    <div key={type.id} className="text-sm">{type.name}</div>
                                ))}
                                {(!locationTypes || locationTypes.length === 0) && <p className="text-gray-400 italic text-sm">Empty</p>}
                            </div>
                            <div>
                                <h4 className="font-bold border-b mb-2 text-blue-600">Admin Client</h4>
                                {adminLocationTypes?.map((type: any) => (
                                    <div key={type.id} className="text-sm">{type.name}</div>
                                ))}
                                {(!adminLocationTypes || adminLocationTypes.length === 0) && <p className="text-gray-400 italic text-sm">Empty</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>User Roles</CardTitle>
                        <CardDescription>System roles</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-bold border-b mb-2">Anon Client</h4>
                                {roles?.map((role: any) => (
                                    <div key={role.name} className="text-sm">{role.name}</div>
                                ))}
                            </div>
                            <div>
                                <h4 className="font-bold border-b mb-2 text-blue-600">Admin Client</h4>
                                {adminRoles?.map((role: any) => (
                                    <div key={role.name} className="text-sm">{role.name}</div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Units of Measure</CardTitle>
                        <CardDescription>Available UOMs</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-bold border-b mb-2">Anon Client</h4>
                                {uoms?.map((uom: any) => (
                                    <div key={uom.code} className="text-sm">{uom.code}</div>
                                ))}
                            </div>
                            <div>
                                <h4 className="font-bold border-b mb-2 text-blue-600">Admin Client</h4>
                                {adminUoms?.map((uom: any) => (
                                    <div key={uom.code} className="text-sm">{uom.code}</div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {(adminProductCount! > 0 || adminLocationTypes!.length > 0) && !locationTypes?.length && (
                <div className="mt-8 p-4 bg-orange-50 border border-orange-200 rounded">
                    <h2 className="text-xl font-bold text-orange-800 mb-2">⚠️ RLS Issue Detected</h2>
                    <p className="text-orange-700">
                        The Admin client can see data, but the Anon client cannot. This means Row Level Security (RLS) is enabled on your tables, but you haven't added any SELECT policies for anonymous users.
                    </p>
                </div>
            )}
        </div>
    )
}
