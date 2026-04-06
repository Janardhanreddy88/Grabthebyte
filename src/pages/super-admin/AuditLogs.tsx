import { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter,
  RefreshCw,
  User,
  Calendar,
  Activity,
  Loader2,
  FileText,
  Shield,
  Database,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  user_id: string;
  campus_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export function AuditLogs() {
  const { filters } = useSuperAdmin();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters.campusId) {
        query = query.eq('campus_id', filters.campusId);
      }

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Batch-fetch user profiles to avoid N+1 queries
      const uniqueUserIds = [...new Set((data || []).map(log => log.user_id))];
      const profileMap = new Map<string, { full_name: string | null; email: string | null }>();

      if (uniqueUserIds.length > 0) {
        // Fetch in batches of 50 to stay within query limits
        for (let i = 0; i < uniqueUserIds.length; i += 50) {
          const batch = uniqueUserIds.slice(i, i + 50);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', batch);
          
          (profiles || []).forEach(p => {
            profileMap.set(p.user_id, { full_name: p.full_name, email: p.email });
          });
        }
      }

      const logsWithUsers = (data || []).map(log => ({
        ...log,
        user_name: profileMap.get(log.user_id)?.full_name,
        user_email: profileMap.get(log.user_id)?.email,
      }));

      setLogs(logsWithUsers);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters.campusId, actionFilter]);

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(query) ||
      log.entity_type.toLowerCase().includes(query) ||
      log.user_email?.toLowerCase().includes(query) ||
      log.user_name?.toLowerCase().includes(query)
    );
  });

  const getActionBadge = (action: string) => {
    if (action.includes('create') || action.includes('insert')) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Create</Badge>;
    }
    if (action.includes('update') || action.includes('change')) {
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Update</Badge>;
    }
    if (action.includes('delete') || action.includes('remove')) {
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Delete</Badge>;
    }
    if (action.includes('login') || action.includes('auth')) {
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Auth</Badge>;
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'user_role':
        return <Shield className="h-4 w-4" />;
      case 'order':
        return <FileText className="h-4 w-4" />;
      case 'settings':
        return <Settings className="h-4 w-4" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  const uniqueActions = [...new Set(logs.map(log => log.action))];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all administrative actions for security and accountability
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by action, entity, user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity Log ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(log.created_at), 'MMM d, h:mm a')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{log.user_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{log.user_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEntityIcon(log.entity_type)}
                          <span className="capitalize">{log.entity_type.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              {selectedLog && format(new Date(selectedLog.created_at), 'MMMM d, yyyy \'at\' h:mm:ss a')}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Action</p>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entity Type</p>
                  <p className="font-medium capitalize">{selectedLog.entity_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">User</p>
                  <p className="font-medium">{selectedLog.user_name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{selectedLog.user_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entity ID</p>
                  <p className="font-mono text-sm">{selectedLog.entity_id || 'N/A'}</p>
                </div>
              </div>

              {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Previous Values</p>
                  <ScrollArea className="h-24 rounded-md border p-3 bg-muted/50">
                    <pre className="text-xs">{JSON.stringify(selectedLog.old_values, null, 2)}</pre>
                  </ScrollArea>
                </div>
              )}

              {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">New Values</p>
                  <ScrollArea className="h-24 rounded-md border p-3 bg-muted/50">
                    <pre className="text-xs">{JSON.stringify(selectedLog.new_values, null, 2)}</pre>
                  </ScrollArea>
                </div>
              )}

              {(selectedLog.ip_address || selectedLog.user_agent) && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Additional Info</p>
                  {selectedLog.ip_address && (
                    <p className="text-sm">IP: {selectedLog.ip_address}</p>
                  )}
                  {selectedLog.user_agent && (
                    <p className="text-xs text-muted-foreground truncate">{selectedLog.user_agent}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
