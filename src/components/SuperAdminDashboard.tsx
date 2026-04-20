import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Building2 as Mosque, 
  Settings, 
  Search, 
  Edit, 
  Trash2, 
  Plus, 
  ShieldCheck, 
  UserPlus, 
  Mail, 
  Phone, 
  MapPin,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { MosqueData } from '@/App';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserProfile {
  id: string;
  displayName?: string;
  email: string;
  phone?: string;
  role: 'user' | 'authority' | 'admin';
}

export default function SuperAdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [mosques, setMosques] = useState<MosqueData[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [mosqueSearch, setMosqueSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    // Listen to all users
    const usersRef = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(userList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // Listen to all mosques
    const mosquesRef = collection(db, 'mosques');
    const unsubscribeMosques = onSnapshot(mosquesRef, (snapshot) => {
      const mosqueList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MosqueData[];
      setMosques(mosqueList);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'mosques');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeMosques();
    };
  }, []);

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`ইউজারের রোল ${newRole} এ আপডেট করা হয়েছে`);
    } catch (error) {
      toast.error("রোল আপডেট করতে সমস্যা হয়েছে");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success("ইউজার মুছে ফেলা হয়েছে");
      setDeleteConfirmId(null);
    } catch (error) {
      toast.error("ইউজার মুছতে সমস্যা হয়েছে");
    }
  };

  const toggleMosqueStatus = async (mosqueId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'mosques', mosqueId), { active: !currentStatus });
      toast.success(`মসজিদ ${!currentStatus ? 'সক্রিয়' : 'নিষ্ক্রিয়'} করা হয়েছে`);
    } catch (error) {
      toast.error("স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে");
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.phone?.includes(userSearch)
  );

  const filteredMosques = mosques.filter(m => 
    m.name?.toLowerCase().includes(mosqueSearch.toLowerCase()) || 
    m.address?.toLowerCase().includes(mosqueSearch.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col space-y-6 pb-20">
      <div className="flex items-center justify-between w-full">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">অ্যাডমিন ড্যাশবোর্ড</h1>
          <p className="text-sm text-[#64748b]">অ্যাপ্লিকেশনের সকল ইউজার এবং মসজিদ ম্যানেজ করুন।</p>
        </div>
        <Badge className="bg-[#065f46] text-white px-3 py-1">Super Admin Access</Badge>
      </div>

      <Tabs defaultValue="users" className="w-full flex flex-col items-stretch">
        <TabsList className="grid w-full grid-cols-3 bg-[#f1f5f9] p-1 rounded-xl h-12">
          <TabsTrigger value="users" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-[11px] sm:text-sm">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> ইউজার
          </TabsTrigger>
          <TabsTrigger value="mosques" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-[11px] sm:text-sm">
            <Mosque className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> মসজিদ
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-[11px] sm:text-sm">
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> সেটিংস
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="w-full block text-left mt-6 space-y-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <Input 
              placeholder="নাম, ইমেইল বা ফোন নম্বর দিয়ে খুঁজুন..." 
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-10 h-12 w-full rounded-xl border-[#e2e8f0]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 w-full">
            {filteredUsers.map(user => (
              <Card key={user.id} className="border-[#e2e8f0] shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-[#64748b] shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-[#1e293b] truncate">{user.displayName || 'Unnamed User'}</h4>
                          <Badge variant="outline" className={`text-[9px] font-bold uppercase px-1.5 py-0 h-4 ${
                            user.role === 'admin' ? 'border-red-200 text-red-600 bg-red-50' : 
                            user.role === 'authority' ? 'border-blue-200 text-blue-600 bg-blue-50' : 
                            'border-gray-200 text-gray-600 bg-gray-50'
                          }`}>
                            {user.role}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] sm:text-xs text-[#64748b] flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 shrink-0" /> {user.email}
                        </span>
                        {user.phone && (
                          <span className="text-[10px] sm:text-xs text-[#64748b] flex items-center gap-1 truncate">
                            <Phone className="w-3 h-3 shrink-0" /> {user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#f1f5f9]">
                    <div className="relative flex-1 sm:flex-none">
                      <select 
                        value={user.role}
                        onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                        disabled={updatingUserId === user.id}
                        className="w-full sm:w-auto text-[11px] font-bold bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#065f46] disabled:opacity-50 appearance-none pr-6"
                      >
                        <option value="user">User</option>
                        <option value="authority">Authority</option>
                        <option value="admin">Admin</option>
                      </select>
                      {updatingUserId === user.id && (
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                          <div className="w-3 h-3 border-2 border-[#065f46] border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setDeleteConfirmId(user.id)}
                      disabled={updatingUserId === user.id}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="mosques" className="w-full block text-left mt-6 space-y-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <Input 
              placeholder="মসজিদের নাম বা ঠিকানা দিয়ে খুঁজুন..." 
              value={mosqueSearch}
              onChange={(e) => setMosqueSearch(e.target.value)}
              className="pl-10 h-12 w-full rounded-xl border-[#e2e8f0]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 w-full">
            {filteredMosques.map(mosque => (
              <Card key={mosque.id} className="border-[#e2e8f0] shadow-sm overflow-hidden">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${mosque.active ? 'bg-emerald-50 text-[#065f46]' : 'bg-gray-100 text-gray-400'}`}>
                      <Mosque className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-[#1e293b] truncate">{mosque.name}</h4>
                      <p className="text-[10px] sm:text-xs text-[#64748b] flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> {mosque.address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#f1f5f9]">
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${mosque.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {mosque.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toggleMosqueStatus(mosque.id, mosque.active)}
                      className={`text-[10px] font-bold h-8 px-4 rounded-lg transition-all ${mosque.active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                    >
                      {mosque.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="w-full block text-left mt-6">
          <Card className="w-full border-[#e2e8f0] shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">গ্লোবাল সেটিংস</CardTitle>
              <CardDescription>অ্যাপ্লিকেশনের সাধারণ কনফিগারেশন পরিবর্তন করুন।</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  গ্লোবাল সেটিংস বর্তমানে ডেভেলপমেন্ট পর্যায়ে আছে। শীঘ্রই এখানে মেইনটেন্যান্স মোড, ডিফল্ট রেডিয়াস এবং অন্যান্য ফিচার যুক্ত করা হবে।
                </p>
              </div>

              <div className="space-y-4 opacity-50 pointer-events-none">
                <div className="flex items-center justify-between p-3 border border-[#e2e8f0] rounded-xl">
                  <div>
                    <p className="text-sm font-bold">Maintenance Mode</p>
                    <p className="text-[10px] text-[#64748b]">Disable app for regular users</p>
                  </div>
                  <div className="w-10 h-5 bg-gray-200 rounded-full" />
                </div>
                <div className="flex items-center justify-between p-3 border border-[#e2e8f0] rounded-xl">
                  <div>
                    <p className="text-sm font-bold">Default Search Radius</p>
                    <p className="text-[10px] text-[#64748b]">Initial radius for mosque search (km)</p>
                  </div>
                  <Badge variant="outline">1 km</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-none p-6">
          <DialogHeader>
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#1e293b]">ইউজার মুছে ফেলবেন?</DialogTitle>
            <DialogDescription className="text-sm text-[#64748b] pt-2">
              আপনি কি নিশ্চিতভাবে এই ইউজারকে মুছে ফেলতে চান? এই অ্যাকশনটি আর ফিরিয়ে আনা সম্ভব হবে না এবং ইউজারের সকল তথ্য স্থায়ীভাবে ডিলিট হয়ে যাবে।
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-6">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmId(null)}
              className="flex-1 rounded-xl border-[#e2e8f0] text-[#64748b] h-12 font-bold"
            >
              বাতিল করুন
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirmId && handleDeleteUser(deleteConfirmId)}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white h-12 font-bold"
            >
              মুছে ফেলুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
