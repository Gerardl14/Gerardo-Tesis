// Supabase Edge Function: admin-create-user
// Deploy with: supabase functions deploy admin-create-user
//
// This function handles admin operations: list, create, update, and delete users.
// Only users with the 'superadministrador' role can call this function.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the caller is authenticated and is a superadmin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create a client with the user's JWT to verify identity
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify the calling user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: caller }, error: authError } = await userClient.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if the caller is a superadmin
    const { data: callerProfile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'superadministrador') {
      return new Response(JSON.stringify({ error: 'Acceso denegado. Solo superadministradores.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create admin client with service role key (full permissions)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = await req.json()
    const { action } = body

    // =============================
    // ACTION: LIST all users
    // =============================
    if (action === 'list') {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers()
      if (error) throw error

      // Merge with profiles to get full_name and role
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('id, full_name, role, created_at')

      const profileMap: Record<string, any> = {}
      profiles?.forEach((p: any) => { profileMap[p.id] = p })

      const enrichedUsers = users.map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: profileMap[u.id]?.full_name || null,
        role: profileMap[u.id]?.role || 'estudiante',
        created_at: profileMap[u.id]?.created_at || u.created_at,
      }))

      return new Response(JSON.stringify({ users: enrichedUsers }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // =============================
    // ACTION: CREATE a new user
    // =============================
    if (action === 'create') {
      const { email, password, full_name, role } = body
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Email y contraseña son obligatorios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Create the user via admin API (skips email confirmation)
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || '' },
      })

      if (createError) throw createError

      // Update the profile with the specified role
      if (newUser.user && role) {
        await adminClient
          .from('profiles')
          .update({ full_name: full_name || null, role })
          .eq('id', newUser.user.id)
      }

      return new Response(JSON.stringify({ user: newUser.user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // =============================
    // ACTION: UPDATE an existing user
    // =============================
    if (action === 'update') {
      const { user_id, full_name, role } = body
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id es obligatorio' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const updates: Record<string, string> = {}
      if (full_name !== undefined) updates.full_name = full_name
      if (role !== undefined) updates.role = role

      const { error: updateError } = await adminClient
        .from('profiles')
        .update(updates)
        .eq('id', user_id)

      if (updateError) throw updateError

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // =============================
    // ACTION: DELETE a user
    // =============================
    if (action === 'delete') {
      const { user_id } = body
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id es obligatorio' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Prevent self-deletion
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: 'No puedes eliminarte a ti mismo' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id)
      if (deleteError) throw deleteError

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Acción no válida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
