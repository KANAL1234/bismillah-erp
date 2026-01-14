'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createUser(prevState: any, formData: FormData) {
    const supabaseAdmin = await createAdminClient()
    const supabase = await createClient()

    // Check permissions
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, message: 'Unauthorized' }
    }

    // You might want to double check RBAC here using rpc or checking roles table
    // For now we assume the UI Guard + Middleware handles basic access

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string
    const employeeCode = formData.get('employeeCode') as string
    const roleId = formData.get('roleId') as string // Optional initial role

    if (!email || !password || !fullName) {
        return { success: false, message: 'Missing required fields' }
    }

    try {
        // 1. Create Auth User
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email so they can login immediately
            user_metadata: {
                full_name: fullName
            }
        })

        if (authError) throw authError
        if (!authData.user) throw new Error('Failed to create user')

        const newUserId = authData.user.id

        // 2. Create User Profile
        const { data: profileResult, error: profileError } = await supabaseAdmin.rpc('create_user_profile', {
            p_user_id: newUserId,
            p_full_name: fullName,
            p_email: email,
            p_employee_code: employeeCode || null
        })

        if (profileError) {
            console.error('Profile RPC error:', profileError)
            await supabaseAdmin.auth.admin.deleteUser(newUserId)
            throw profileError
        }

        // The RPC returns { success: boolean, message: string }, we must check this!
        if (profileResult && !profileResult.success) {
            console.error('Profile creation logic failed:', profileResult.message)
            await supabaseAdmin.auth.admin.deleteUser(newUserId)
            throw new Error(profileResult.message || 'Failed to create user profile')
        }

        // 3. Assign Role if selected
        if (roleId) {
            const { error: roleError } = await supabaseAdmin.rpc('assign_role_to_user', {
                p_user_id: newUserId,
                p_role_id: roleId,
                p_assigned_by: user.id
            })
            if (roleError) console.error('Role assignment failed:', roleError)
        }

        revalidatePath('/dashboard/settings/users')
        return { success: true, message: 'User created successfully' }

    } catch (error: any) {
        console.error('Create User Error:', error)
        return { success: false, message: error.message || 'Failed to create user' }
    }
}
