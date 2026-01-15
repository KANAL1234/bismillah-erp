import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
import { UserProfile, Role, PermissionCheck } from '@/lib/types/rbac';
import { toast } from 'sonner';

interface AuthContextType {
  user: UserProfile | null;
  roles: Role[];
  allowedLocations: { location_id: string; location_name: string; location_code: string }[];
  loading: boolean;
  hasPermission: (permissionCode: string) => boolean;
  hasLocationAccess: (locationId: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  hasAllPermissions: (permissionCodes: string[]) => boolean;
  hasRole: (roleCode: string) => boolean;
  isAdmin: () => boolean;
  refreshPermissions: () => Promise<void>;
  logAction: (action: string, module: string, resource: string, resourceId?: string, oldValues?: any, newValues?: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionCheck[]>([]);
  const [allowedLocations, setAllowedLocations] = useState<{ location_id: string; location_name: string; location_code: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadUserData();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setRoles([]);
        setPermissions([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Function to load/refresh permissions
  const loadPermissions = async (userId: string) => {
    const supabase = createClient();
    const { data: userPermissions } = await supabase.rpc('get_user_permissions', {
      p_user_id: userId
    });

    if (userPermissions) {
      setPermissions(userPermissions);
    }
  };

  // Manual refresh function
  const refreshPermissions = async () => {
    if (user?.id) {
      await loadPermissions(user.id);
    }
  };

  const loadUserData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setLoading(false);
        return;
      }

      // Load user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        setUser(profile);

        // Update last login
        await supabase
          .from('user_profiles')
          .update({ last_login: new Date().toISOString() })
          .eq('id', authUser.id);
      }

      // Load user roles
      const { data: userRoles } = await supabase.rpc('get_user_roles', {
        p_user_id: authUser.id
      });

      if (userRoles) {
        setRoles(userRoles);
      }

      // Load user permissions
      await loadPermissions(authUser.id);

      // Load allowed locations
      const { data: locations, error: locError } = await supabase
        .from('user_allowed_locations')
        .select(`
          location_id,
          locations (
            name,
            code
          )
        `)
        .eq('user_id', authUser.id);

      if (locError) {
        console.error('Error loading locations:', locError);
      } else if (locations) {
        setAllowedLocations(locations.map((l: any) => ({
          location_id: l.location_id,
          location_name: l?.locations?.name || '',
          location_code: l?.locations?.code || ''
        })));
      }

    } catch (error: any) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load user permissions: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (isAdmin()) return true;
    return permissions.some(p => p.permission_code === permissionCode);
  };

  const hasLocationAccess = (locationId: string): boolean => {
    // All users (including Super Admins) now respect location assignments
    return allowedLocations.some(l => l.location_id === locationId);
  };

  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    return permissionCodes.some(code => hasPermission(code));
  };

  const hasAllPermissions = (permissionCodes: string[]): boolean => {
    return permissionCodes.every(code => hasPermission(code));
  };

  const hasRole = (roleCode: string): boolean => {
    return roles.some(r => r.role_code === roleCode);
  };

  const isAdmin = (): boolean => {
    return hasRole('SUPER_ADMIN');
  };

  const logAction = async (
    action: string,
    module: string,
    resource: string,
    resourceId?: string,
    oldValues?: any,
    newValues?: any
  ) => {
    if (!user) return;

    try {
      await supabase.rpc('log_user_action', {
        p_user_id: user.id,
        p_action: action,
        p_module: module,
        p_resource: resource,
        p_resource_id: resourceId || null,
        p_old_values: oldValues ? JSON.stringify(oldValues) : null,
        p_new_values: newValues ? JSON.stringify(newValues) : null,
        p_status: 'success'
      });
    } catch (error) {
      console.error('Error logging action:', error);
    }
  };

  const value = {
    user,
    roles,
    permissions,
    allowedLocations,
    loading,
    hasPermission,
    hasLocationAccess,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isAdmin,
    refreshPermissions,
    logAction
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ========================================
// PERMISSION CHECK HOOKS
// ========================================

export function usePermission(permissionCode: string) {
  const { hasPermission, loading } = useAuth();
  return { hasPermission: hasPermission(permissionCode), loading };
}

export function usePermissions(permissionCodes: string[]) {
  const { hasPermission, loading } = useAuth();
  const permissions = permissionCodes.map(code => ({
    code,
    granted: hasPermission(code)
  }));
  return { permissions, loading };
}

export function useRole(roleCode: string) {
  const { hasRole, loading } = useAuth();
  return { hasRole: hasRole(roleCode), loading };
}

// ========================================
// PERMISSION CHECK COMPONENT
// ========================================

interface PermissionGuardProps {
  permission: string | string[];
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({
  permission,
  requireAll = false,
  fallback = null,
  children
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = useAuth();

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-8 w-32 rounded"></div>;
  }

  const permissionCodes = Array.isArray(permission) ? permission : [permission];

  const hasAccess = requireAll
    ? hasAllPermissions(permissionCodes)
    : permissionCodes.length === 1
      ? hasPermission(permissionCodes[0])
      : hasAnyPermission(permissionCodes);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ========================================
// ROLE CHECK COMPONENT
// ========================================

interface RoleGuardProps {
  role: string | string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGuard({ role, fallback = null, children }: RoleGuardProps) {
  const { hasRole, loading } = useAuth();

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-8 w-32 rounded"></div>;
  }

  const roleCodes = Array.isArray(role) ? role : [role];
  const hasAccess = roleCodes.some(code => hasRole(code));

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ========================================
// AUDIT LOG HOOK
// ========================================

export function useAuditLog() {
  const { user, logAction } = useAuth();

  const log = async (
    action: string,
    module: string,
    resource: string,
    resourceId?: string,
    oldValues?: any,
    newValues?: any
  ) => {
    await logAction(action, module, resource, resourceId, oldValues, newValues);
  };

  return { log, user };
}

// ========================================
// PERMISSION-AWARE BUTTON
// ========================================

interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  permission: string | string[];
  requireAll?: boolean;
  children: ReactNode;
}

export function PermissionButton({
  permission,
  requireAll = false,
  children,
  ...props
}: PermissionButtonProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  const permissionCodes = Array.isArray(permission) ? permission : [permission];

  const hasAccess = requireAll
    ? hasAllPermissions(permissionCodes)
    : permissionCodes.length === 1
      ? hasPermission(permissionCodes[0])
      : hasAnyPermission(permissionCodes);

  if (!hasAccess) {
    return null;
  }

  return <button {...props}>{children}</button>;
}
