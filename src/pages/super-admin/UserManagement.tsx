import { useState, useEffect } from 'react';
import { 
  Users, Search, Shield, UserCog, MoreHorizontal, RefreshCw,
  Mail, Calendar, Building2, Loader2, Key, UserPlus, Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { CreateStaffDialog } from '@/components/super-admin/CreateStaffDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

type AppRole = 'admin' | 'kiosk' | 'student' | 'super_admin';

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  campus_id: string;
  created_at: string;
  role: AppRole;
  campus_name?: string;
  campus_code?: string;
}

interface UserStats {
  total_users: number;
  admins: number;
  students: number;
  kiosk_users: number;
}

export function UserManagement() {
  const { filters, campuses } = useSuperAdmin();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRole, setNewRole] = useState<AppRole>('student');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('user_roles_readable')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.campusId) {
        const campus = campuses.find(c => c.id === filters.campusId);
        if (campus) query = query.eq('campus_code', campus.code);
      }
      if (roleFilter !== 'all') query = query.eq('role', roleFilter as AppRole);

      const { data, error } = await query;
      if (error) throw error;

      setUsers((data || []).map(row => ({
        id: row.id || '',
        user_id: row.user_id || '',
        full_name: row.full_name,
        email: row.email,
        phone: null,
        campus_id: row.campus_id || '',
        created_at: row.created_at || '',
        role: (row.role || 'student') as AppRole,
        campus_name: row.campus_name,
        campus_code: row.campus_code
      })));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserStats = async () => {
    const { data, error } = await supabase.rpc('get_campus_user_stats', { p_campus_id: filters.campusId });
    if (!error && data && typeof data === 'object') setUserStats(data as unknown as UserStats);
  };

  const handleChangeRole = async () => {
    if (!selectedUser || !newRole) return;
    setIsUpdating(true);
    try {
      const response = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'update_role',
          user_role_id: selectedUser.id,
          user_id: selectedUser.user_id,
          new_role: newRole,
          old_role: selectedUser.role,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast.success(`Role changed to ${newRole}`);
      setShowRoleDialog(false);
      setSelectedUser(null);
      fetchUsers();
      fetchUserStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to change role');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsUpdating(true);
    try {
      const response = await supabase.functions.invoke('manage-staff', {
        body: { action: 'delete', user_id: selectedUser.user_id },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast.success('User deleted successfully');
      setShowDeleteDialog(false);
      setSelectedUser(null);
      fetchUsers();
      fetchUserStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUserStats();
  }, [filters.campusId, roleFilter]);

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return user.full_name?.toLowerCase().includes(q) || user.email?.toLowerCase().includes(q) || user.campus_name?.toLowerCase().includes(q);
  });

  const getRoleBadge = (role: string) => {
    const configs: Record<string, string> = {
      super_admin: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      admin: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      kiosk: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    };
    return <Badge className={configs[role] || ''} variant={role === 'student' ? 'secondary' : 'outline'}>
      {role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage all users and create staff accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { fetchUsers(); fetchUserStats(); }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Create Staff
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Users', value: userStats?.total_users ?? 0, icon: Users, color: '' },
          { label: 'Admins', value: userStats?.admins ?? 0, icon: Shield, color: 'text-blue-600' },
          { label: 'Students', value: userStats?.students ?? 0, icon: Users, color: 'text-green-600' },
          { label: 'Kiosk Users', value: userStats?.kiosk_users ?? 0, icon: UserCog, color: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
                <s.icon className="h-8 w-8 text-muted-foreground/20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, email, or campus..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="kiosk">Kiosk</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader><CardTitle>All Users ({filteredUsers.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{user.campus_name || user.campus_code || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(user); setNewRole(user.role); setShowRoleDialog(true);
                            }}>
                              <Key className="h-4 w-4 mr-2" /> Change Role
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              if (user.email) { navigator.clipboard.writeText(user.email); toast.success('Email copied'); }
                            }}>
                              <Mail className="h-4 w-4 mr-2" /> Copy Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => {
                              setSelectedUser(user); setShowDeleteDialog(true);
                            }}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>Change role for {selectedUser?.full_name || selectedUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Role</Label>
              <div>{selectedUser && getRoleBadge(selectedUser.role)}</div>
            </div>
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={newRole} onValueChange={(val) => setNewRole(val as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="kiosk">Kiosk</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
            <Button onClick={handleChangeRole} disabled={isUpdating || newRole === selectedUser?.role}>
              {isUpdating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedUser?.full_name || selectedUser?.email}'s account, 
              including their profile, roles, and auth data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isUpdating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Staff Dialog */}
      <CreateStaffDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
        campuses={campuses}
        onSuccess={() => { fetchUsers(); fetchUserStats(); }}
      />
    </div>
  );
}
