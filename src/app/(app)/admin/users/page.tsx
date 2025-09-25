
'use client';

import { useEffect, useState } from 'react';
import { Users, Crown, Calendar, Mail, User as UserIcon, Filter } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAllUsersClient } from '@/services/user-service-client';
import type { User, SubscriptionStatus } from '@/models/types';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

const getStatusColor = (status: SubscriptionStatus): string => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 border-green-200';
    case 'trial': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'canceled': return 'bg-red-100 text-red-800 border-red-200';
    case 'expired': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'incomplete': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'paused': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getExperienceColor = (experience: string): string => {
  switch (experience) {
    case 'beginner': return 'bg-green-100 text-green-800 border-green-200';
    case 'intermediate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'advanced': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [experienceFilter, setExperienceFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchUsers = async (retryCount = 0) => {
    setLoading(true);
    try {
      console.log('🔄 Starting to fetch users... (attempt', retryCount + 1, ')');
      const fetchedUsers = await getAllUsersClient();
      console.log('✅ Successfully fetched users:', fetchedUsers.length);
      setUsers(fetchedUsers);
      setFilteredUsers(fetchedUsers);
    } catch (error) {
      console.error('❌ Failed to fetch users:', error);

      // If it's an auth error and we haven't retried yet, try once more after a delay
      if (retryCount === 0 && error instanceof Error &&
          (error.message.includes('not authenticated') || error.message.includes('log in'))) {
        console.log('🔄 Auth error, retrying in 2 seconds...');
        setTimeout(() => fetchUsers(1), 2000);
        return; // Don't set loading to false yet
      }

      toast({
        title: 'Error',
        description: `Failed to load users: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Add a small delay to ensure auth is ready
    const timer = setTimeout(() => {
      fetchUsers();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let filtered = [...users];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.subscriptionStatus === statusFilter);
    }

    // Apply experience filter
    if (experienceFilter !== 'all') {
      filtered = filtered.filter(user => user.experience === experienceFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, statusFilter, experienceFilter]);

  const activeUsers = users.filter(u => u.subscriptionStatus === 'active').length;
  const trialUsers = users.filter(u => u.subscriptionStatus === 'trial').length;
  const expiredUsers = users.filter(u => u.subscriptionStatus === 'expired').length;
  const canceledUsers = users.filter(u => u.subscriptionStatus === 'canceled').length;
  const adminUsers = users.filter(u => u.isAdmin).length;

  // Additional statistics
  const newUsersThisMonth = users.filter(u => {
    if (!u.trialStartDate) return false;
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const trialStartDate = u.trialStartDate instanceof Date ? u.trialStartDate : new Date(u.trialStartDate);
    return trialStartDate > oneMonthAgo;
  }).length;

  const usersWithStripe = users.filter(u => u.stripeCustomerId).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">User Management</h1>
          <p className="text-muted-foreground">View and manage registered users of the application.</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +{newUsersThisMonth} this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
            <Crown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {users.length > 0 ? Math.round((activeUsers / users.length) * 100) : 0}% conversion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Users</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{trialUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {expiredUsers} expired trials
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
            <UserIcon className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{adminUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {usersWithStripe} have Stripe IDs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-green-600">Active:</span>
              <span className="font-medium">{activeUsers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-600">Trial:</span>
              <span className="font-medium">{trialUsers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Expired:</span>
              <span className="font-medium">{expiredUsers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-600">Canceled:</span>
              <span className="font-medium">{canceledUsers}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search users by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active ({activeUsers})</SelectItem>
                <SelectItem value="trial">Trial ({trialUsers})</SelectItem>
                <SelectItem value="expired">Expired ({expiredUsers})</SelectItem>
                <SelectItem value="canceled">Canceled ({canceledUsers})</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Select value={experienceFilter} onValueChange={setExperienceFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by experience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Experience</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Users</CardTitle>
          <CardDescription>
            Showing {filteredUsers.length} of {users.length} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Trial Start</TableHead>
                <TableHead>Stripe Status</TableHead>
                <TableHead>Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <Mail className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {user.firstName || user.lastName
                              ? `${user.firstName} ${user.lastName}`.trim()
                              : 'No name set'
                            }
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ID: {user.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getExperienceColor(user.experience)}>
                        {user.experience}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(user.subscriptionStatus || 'trial')}>
                        {user.subscriptionStatus || 'trial'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{user.goal}</span>
                    </TableCell>
                    <TableCell>{user.frequency} days/week</TableCell>
                    <TableCell>
                      {user.trialStartDate
                        ? format(new Date(user.trialStartDate), 'MMM dd, yyyy')
                        : 'Unknown'
                      }
                    </TableCell>
                    <TableCell>
                      {user.stripeCustomerId ? (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                            Connected
                          </Badge>
                          {user.subscriptionId && (
                            <span className="text-xs text-muted-foreground">
                              ID: {user.subscriptionId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                          No Stripe
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                          <Crown className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">User</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    No users found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
