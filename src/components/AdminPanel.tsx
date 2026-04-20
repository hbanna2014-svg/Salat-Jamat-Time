import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Building2 as Mosque, MapPin, Clock, Save, ArrowLeft, ShieldCheck, Phone, Calendar, Power, AlertCircle, Trash2, Image as ImageIcon, Sparkles, Info, History, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, updateDoc, addDoc, collection, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { MosqueData } from '@/App';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AdminPanelProps {
  mosque: MosqueData;
  onClose: () => void;
  userRole: string | null;
  userId: string | undefined;
  isNew?: boolean;
  userLocation?: { lat: number; lng: number } | null;
}

export default function AdminPanel({ mosque, onClose, userRole, userId, isNew, userLocation }: AdminPanelProps) {
  const [data, setData] = useState<MosqueData>(mosque);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const generateAIImage = async () => {
    setIsGeneratingImage(true);
    try {
      // Using a high-quality placeholder service with a relevant seed
      const seed = encodeURIComponent(data.name || 'mosque architecture');
      const imageUrl = `https://picsum.photos/seed/${seed}/800/600`;
      setData({ ...data, imageUrl });
      toast.success("AI ইমেজ জেনারেট করা হয়েছে (Placeholder)");
    } catch (error) {
      toast.error("ইমেজ জেনারেট করতে সমস্যা হয়েছে");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Check if user has permission to edit this mosque or create a new one
  const canEdit = userRole === 'admin' || isNew || mosque.adminUid === userId;

  const setLocationToCurrent = () => {
    if (userLocation) {
      setData({
        ...data,
        location: { lat: userLocation.lat, lng: userLocation.lng }
      });
      toast.success("আপনার বর্তমান অবস্থান সেট করা হয়েছে");
    } else {
      toast.error("আপনার অবস্থান পাওয়া যায়নি। দয়া করে লোকেশন পারমিশন চেক করুন।");
    }
  };

  const handlePrayerChange = (index: number, field: string, value: string) => {
    if (!canEdit) return;
    const newTimes = [...data.prayerTimes];
    newTimes[index] = { ...newTimes[index], [field]: value };
    setData({ ...data, prayerTimes: newTimes });
  };

  const validateTime = (time: string) => {
    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i;
    return timeRegex.test(time.trim());
  };

  const handleSave = async () => {
    if (!canEdit && !isNew) {
      toast.error("আপনার এই মসজিদের তথ্য পরিবর্তনের অনুমতি নেই");
      return;
    }

    if (isNew && !data.name) {
      toast.error("মসজিদের নাম আবশ্যক");
      return;
    }

    const invalidTimes = data.prayerTimes.filter(p => !validateTime(p.time));
    if (invalidTimes.length > 0) {
      const names = invalidTimes.map(p => p.name).join(', ');
      toast.error(`ভুল সময় ফরম্যাট: ${names}। HH:MM AM/PM ব্যবহার করুন`);
      return;
    }

    if (data.jummahTime && !validateTime(data.jummahTime)) {
      toast.error("জুম্মার সময় ভুল ফরম্যাটে আছে। HH:MM AM/PM ব্যবহার করুন");
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        await addDoc(collection(db, 'mosques'), {
          name: data.name,
          address: data.address,
          active: data.active,
          adminUid: userId,
          location: data.location,
          prayerTimes: data.prayerTimes,
          jummahTime: data.jummahTime || null,
          khateeb: data.khateeb || null,
          imageUrl: data.imageUrl || null,
          description: data.description || null,
          contact: data.contact || null,
          history: data.history || null,
          timezone: data.timezone || 'Asia/Dhaka',
          nextJamaat: data.nextJamaat,
          time: data.time,
          createdAt: serverTimestamp()
        });
        toast.success("নতুন মসজিদ সফলভাবে যোগ হয়েছে!");
      } else {
        const mosqueRef = doc(db, 'mosques', mosque.id);
        await updateDoc(mosqueRef, {
          name: data.name,
          address: data.address,
          active: data.active,
          prayerTimes: data.prayerTimes,
          jummahTime: data.jummahTime || null,
          khateeb: data.khateeb || null,
          imageUrl: data.imageUrl || null,
          description: data.description || null,
          contact: data.contact || null,
          history: data.history || null,
          timezone: data.timezone || 'Asia/Dhaka'
        });
        toast.success("মসজিদের তথ্য সফলভাবে আপডেট হয়েছে!");
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, isNew ? 'mosques' : `mosques/${mosque.id}`);
      toast.error(isNew ? "মসজিদ যোগ করতে সমস্যা হয়েছে" : "তথ্য আপডেট করতে সমস্যা হয়েছে");
    } finally {
      setIsSaving(false);
    }
  };

  const seedSampleData = async () => {
    if (userRole !== 'admin') return;
    
    setIsSaving(true);
    const loadingToast = toast.loading("নমুনা তথ্য যোগ করা হচ্ছে...");
    try {
      const samples = [
        {
          name: "বায়তুল মোকাররম জাতীয় মসজিদ",
          address: "ঢাকা, বাংলাদেশ",
          active: true,
          adminUid: userId,
          location: { lat: 23.7289, lng: 90.4126 },
          nextJamaat: "Dhuhr",
          time: "1:30 PM",
          jummahTime: "1:30 PM",
          khateeb: "মাওলানা মুফতি রুহুল আমীন",
          description: "বায়তুল মোকাররম বাংলাদেশের জাতীয় মসজিদ। এটি ঢাকার প্রাণকেন্দ্রে অবস্থিত এবং এর স্থাপত্যশৈলী অত্যন্ত চমৎকার।",
          history: "১৯৬০ সালে এই মসজিদের নির্মাণ কাজ শুরু হয়। এটি মক্কার কাবার আদলে তৈরি করা হয়েছে।",
          contact: "০২-৯৫৫৫৫৫৫",
          prayerTimes: [
            { name: "Fajr", time: "5:15 AM" },
            { name: "Dhuhr", time: "1:30 PM" },
            { name: "Asr", time: "4:30 PM" },
            { name: "Maghrib", time: "6:15 PM" },
            { name: "Isha", time: "8:00 PM" }
          ]
        },
        {
          name: "তারা মসজিদ (Star Mosque)",
          address: "আরমানিটোলা, ঢাকা",
          active: true,
          adminUid: userId,
          location: { lat: 23.7155, lng: 90.3989 },
          nextJamaat: "Asr",
          time: "4:45 PM",
          jummahTime: "1:45 PM",
          khateeb: "মাওলানা আব্দুল হাই",
          description: "তারা মসজিদ ঢাকার আরমানিটোলায় অবস্থিত একটি প্রাচীন মসজিদ। এর দেয়ালে অসংখ্য নীল রঙের তারা খচিত আছে।",
          history: "আঠারো শতকের প্রথম দিকে মির্জা গোলাম পীর এই মসজিদটি নির্মাণ করেন।",
          contact: "০১৭০০০০০০০০",
          prayerTimes: [
            { name: "Fajr", time: "5:20 AM" },
            { name: "Dhuhr", time: "1:45 PM" },
            { name: "Asr", time: "4:45 PM" },
            { name: "Maghrib", time: "6:20 PM" },
            { name: "Isha", time: "8:15 PM" }
          ]
        },
        {
          name: "লালবাগ কেল্লা মসজিদ",
          address: "লালবাগ, ঢাকা",
          active: true,
          adminUid: userId,
          location: { lat: 23.7189, lng: 90.3881 },
          nextJamaat: "Maghrib",
          time: "6:18 PM",
          jummahTime: "1:30 PM",
          khateeb: "মাওলানা জুবায়ের আহমদ",
          description: "লালবাগ কেল্লা মসজিদ মুঘল স্থাপত্যের এক অনন্য নিদর্শন। এটি কেল্লার ভেতরে অবস্থিত।",
          history: "১৬৭৮ সালে শাহজাদা মুহাম্মদ আজম এই মসজিদের নির্মাণ কাজ শুরু করেন।",
          contact: "০১৮০০০০০০০০",
          prayerTimes: [
            { name: "Fajr", time: "5:10 AM" },
            { name: "Dhuhr", time: "1:30 PM" },
            { name: "Asr", time: "4:30 PM" },
            { name: "Maghrib", time: "6:18 PM" },
            { name: "Isha", time: "8:00 PM" }
          ]
        }
      ];

      for (const sample of samples) {
        await addDoc(collection(db, 'mosques'), sample);
      }
      
      toast.success("নমুনা মসজিদের তথ্য সফলভাবে যোগ করা হয়েছে!", { id: loadingToast });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'mosques');
      toast.error("নমুনা তথ্য যোগ করতে সমস্যা হয়েছে", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (userRole !== 'admin' || isNew) return;
    
    setIsSaving(true);
    const loadingToast = toast.loading("মসজিদ ডিলিট করা হচ্ছে...");
    try {
      const mosqueRef = doc(db, 'mosques', mosque.id);
      await deleteDoc(mosqueRef);
      toast.success("মসজিদটি সফলভাবে ডিলিট হয়েছে", { id: loadingToast });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `mosques/${mosque.id}`);
      toast.error("ডিলিট করতে সমস্যা হয়েছে", { id: loadingToast });
    } finally {
      setIsSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#1e293b]">অনুমতি নেই</h2>
          <p className="text-[#64748b] max-w-md">
            দুঃখিত, শুধুমাত্র এই মসজিদের দায়িত্বপ্রাপ্ত কর্তৃপক্ষ বা এডমিনরাই তথ্য পরিবর্তন করতে পারবেন।
          </p>
        </div>
        <Button onClick={onClose} variant="outline" className="rounded-xl px-8">
          ফিরে যান
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <div className="space-y-6 max-w-2xl mx-auto p-4 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Button variant="ghost" onClick={onClose} className="text-[#64748b] hover:text-[#1e293b] flex items-center gap-2 w-fit">
            <ArrowLeft className="w-4 h-4" /> এডমিন মোড থেকে বের হন
          </Button>
          <Badge className={`${userRole === 'admin' ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-blue-50 text-blue-600'} border-current/20 w-fit`}>
            {userRole === 'admin' ? 'এডমিন সেশন' : 'কর্তৃপক্ষ সেশন'} সক্রিয়
          </Badge>
        </div>

      <Card className={`bg-white border-[#e2e8f0] shadow-sm rounded-2xl overflow-hidden ${userRole !== 'admin' ? 'opacity-90' : ''}`}>
        <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0] p-6">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Mosque className="w-5 h-5 text-[#065f46]" />
                মসজিদের তথ্য
              </CardTitle>
              <CardDescription>আপনার মসজিদের পাবলিক প্রোফাইল আপডেট করুন।</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl mb-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data.active ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                <Power className="w-5 h-5" />
              </div>
              <div>
                <Label className="text-sm font-bold text-[#1e293b]">মসজিদ স্ট্যাটাস</Label>
                <p className="text-[11px] text-[#64748b]">{data.active ? 'সব ব্যবহারকারীর জন্য দৃশ্যমান' : 'প্রধান তালিকা থেকে লুকানো'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-bold uppercase ${data.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                {data.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
              </span>
              <Switch 
                checked={data.active}
                onCheckedChange={(checked) => setData({ ...data, active: checked })}
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-[#64748b]">মসজিদের নাম</Label>
              <div className="relative">
                <Mosque className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <Input 
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  disabled={userRole !== 'admin' && !isNew}
                  className="pl-10 h-11 rounded-xl border-[#e2e8f0] disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-[#64748b]">ঠিকানা / অবস্থান</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <Input 
                  value={data.address}
                  onChange={(e) => setData({ ...data, address: e.target.value })}
                  disabled={userRole !== 'admin' && !isNew}
                  className="pl-10 h-11 rounded-xl border-[#e2e8f0] disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <Label className="text-xs font-bold uppercase text-[#64748b]">মসজিদের ছবি</Label>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-[1fr_200px]">
              <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-[#e2e8f0] bg-[#f8fafc] flex flex-col items-center justify-center group">
                {data.imageUrl ? (
                  <>
                    <img 
                      src={data.imageUrl} 
                      alt="Mosque" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" size="sm" onClick={() => setData({ ...data, imageUrl: '' })} className="rounded-xl">
                        মুছে ফেলুন
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center space-y-2 p-4">
                    <ImageIcon className="w-8 h-8 text-[#94a3b8] mx-auto" />
                    <p className="text-[10px] text-[#64748b]">কোন ছবি নেই। আপনি একটি URL দিতে পারেন বা AI দিয়ে জেনারেট করতে পারেন।</p>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-[#64748b]">ইমেজ URL</Label>
                  <Input 
                    value={data.imageUrl || ''}
                    onChange={(e) => setData({ ...data, imageUrl: e.target.value })}
                    placeholder="https://..."
                    className="h-9 rounded-lg text-[10px]"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={generateAIImage}
                  disabled={isGeneratingImage}
                  className="w-full h-10 rounded-xl border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-2 text-[11px] font-bold"
                >
                  {isGeneratingImage ? <div className="w-4 h-4 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  AI ইমেজ জেনারেট
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase text-[#64748b] flex items-center gap-2">
                    <Info className="w-3 h-3" /> বর্ণনা (Description)
                  </Label>
                  <span className="text-[10px] text-[#94a3b8]">{(data.description || '').length}/500</span>
                </div>
                <textarea 
                  value={data.description || ''}
                  onChange={(e) => setData({ ...data, description: e.target.value.slice(0, 500) })}
                  placeholder="মসজিদ সম্পর্কে কিছু লিখুন (নামাজের নিয়ম, বিশেষ সুবিধা ইত্যাদি)..."
                  maxLength={500}
                  className="w-full min-h-[120px] p-4 rounded-2xl border border-[#e2e8f0] text-sm focus:ring-2 focus:ring-[#065f46] focus:border-transparent outline-none transition-all resize-none bg-[#f8fafc]/50"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase text-[#64748b] flex items-center gap-2">
                    <History className="w-3 h-3" /> ইতিহাস (History)
                  </Label>
                  <span className="text-[10px] text-[#94a3b8]">{(data.history || '').length}/1000</span>
                </div>
                <textarea 
                  value={data.history || ''}
                  onChange={(e) => setData({ ...data, history: e.target.value.slice(0, 1000) })}
                  placeholder="মসজিদের ইতিহাস ও ঐতিহ্য সম্পর্কে বিস্তারিত লিখুন..."
                  maxLength={1000}
                  className="w-full min-h-[120px] p-4 rounded-2xl border border-[#e2e8f0] text-sm focus:ring-2 focus:ring-[#065f46] focus:border-transparent outline-none transition-all resize-none bg-[#f8fafc]/50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-[#64748b] flex items-center gap-2">
                <Phone className="w-3 h-3" /> যোগাযোগ (Contact)
              </Label>
              <div className="relative">
                <Input 
                  value={data.contact || ''}
                  onChange={(e) => setData({ ...data, contact: e.target.value })}
                  placeholder="মোবাইল নম্বর বা ইমেইল এড্রেস..."
                  className="pl-10 h-11 rounded-xl border-[#e2e8f0] focus:ring-2 focus:ring-[#065f46] transition-all"
                />
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              </div>
            </div>
          </div>

          {userRole === 'admin' && (
            <div className="grid gap-6 md:grid-cols-2 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase text-[#64748b]">অক্ষাংশ (Latitude)</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={setLocationToCurrent}
                    className="h-6 text-[10px] text-[#065f46] font-bold hover:bg-emerald-50 px-2 flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" /> আমার বর্তমান অবস্থান ব্যবহার করুন
                  </Button>
                </div>
                <Input 
                  type="number"
                  step="any"
                  value={data.location.lat}
                  onChange={(e) => setData({ ...data, location: { ...data.location, lat: parseFloat(e.target.value) } })}
                  className="h-11 rounded-xl border-[#e2e8f0]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-[#64748b]">দ্রাঘিমাংশ (Longitude)</Label>
                <Input 
                  type="number"
                  step="any"
                  value={data.location.lng}
                  onChange={(e) => setData({ ...data, location: { ...data.location, lng: parseFloat(e.target.value) } })}
                  className="h-11 rounded-xl border-[#e2e8f0]"
                />
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <Label className="text-xs font-bold uppercase text-[#64748b] flex items-center gap-2">
              <Globe className="w-3 h-3" /> টাইমজোন (Timezone)
            </Label>
            <select 
              value={data.timezone || 'Asia/Dhaka'}
              onChange={(e) => setData({ ...data, timezone: e.target.value })}
              className="w-full h-11 px-3 rounded-xl border border-[#e2e8f0] text-sm focus:ring-[#065f46] focus:border-[#065f46] outline-none bg-white"
            >
              <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
              <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
              <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
              <option value="Europe/London">Europe/London (GMT+0/1)</option>
              <option value="America/New_York">America/New_York (GMT-5/4)</option>
              <option value="UTC">UTC (GMT+0)</option>
            </select>
            <p className="text-[10px] text-[#64748b]">মসজিদের স্থানীয় সময় অনুযায়ী টাইমজোন সিলেক্ট করুন।</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#e2e8f0] shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0] p-6">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#065f46]" />
            জুম্মার সময়সূচী
          </CardTitle>
          <CardDescription>সাপ্তাহিক জুম্মার নামাজের সময় ও খতিবের নাম নির্ধারণ করুন।</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-[#64748b]">জুম্মার সময় (শুক্রবার)</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <Input 
                  value={data.jummahTime || ''}
                  onChange={(e) => setData({ ...data, jummahTime: e.target.value })}
                  placeholder="HH:MM AM/PM"
                  className={`pl-10 h-11 rounded-xl border-[#e2e8f0] focus:ring-[#065f46] ${data.jummahTime && !validateTime(data.jummahTime) ? 'border-red-300 ring-1 ring-red-100' : ''}`}
                />
              </div>
              {data.jummahTime && !validateTime(data.jummahTime) && (
                <p className="text-[10px] text-red-500 font-bold">ভুল ফরম্যাট! HH:MM AM/PM ব্যবহার করুন।</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-[#64748b]">খতিবের নাম (ঐচ্ছিক)</Label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <Input 
                  value={data.khateeb || ''}
                  onChange={(e) => setData({ ...data, khateeb: e.target.value })}
                  placeholder="খতিবের নাম লিখুন"
                  className="pl-10 h-11 rounded-xl border-[#e2e8f0] focus:ring-[#065f46]"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#e2e8f0] shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0] p-6">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#065f46]" />
            জামায়াতের সময়সূচী
          </CardTitle>
          <CardDescription>আপনার মসজিদের দৈনিক জামায়াতের সময় নির্ধারণ করুন।</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {data.prayerTimes.map((prayer, index) => (
              <div key={prayer.name} className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl space-y-3 transition-all hover:border-[#065f46]/30">
                <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
                  <Label className="text-[10px] font-bold uppercase text-[#065f46] tracking-wider">{prayer.name}</Label>
                  <Clock className="w-3 h-3 text-[#94a3b8]" />
                </div>
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-[#64748b] uppercase px-0.5">জামায়াত</Label>
                    <Input 
                      type="text"
                      value={prayer.time}
                      onChange={(e) => handlePrayerChange(index, 'time', e.target.value)}
                      placeholder="HH:MM AM/PM"
                      className={`text-center font-bold text-xs h-9 rounded-lg border-[#e2e8f0] bg-white focus:ring-[#065f46] ${!validateTime(prayer.time) ? 'border-red-300 ring-1 ring-red-100' : ''}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-[#64748b] uppercase px-0.5">তারিখ</Label>
                    <Input 
                      type="date"
                      value={prayer.date || ''}
                      onChange={(e) => handlePrayerChange(index, 'date', e.target.value)}
                      className="text-center text-[10px] h-9 rounded-lg border-[#e2e8f0] bg-white focus:ring-[#065f46]"
                    />
                  </div>
                </div>
                {!validateTime(prayer.time) ? (
                  <p className="text-[9px] text-red-500 text-center font-bold">HH:MM AM/PM দিন</p>
                ) : (
                  <p className="text-[9px] text-[#94a3b8] text-center">{prayer.date ? 'বিশেষ তারিখ' : 'প্রতিদিন'}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <Button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 bg-[#065f46] hover:bg-[#044e3a] text-white font-bold py-6 sm:py-8 rounded-2xl text-lg sm:text-xl shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] border-b-4 border-[#044e3a] disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-6 h-6" />
          )}
          {isNew ? 'মসজিদ যোগ করুন' : 'তথ্য সংরক্ষণ করুন'}
        </Button>
        
        {userRole === 'admin' && !isNew && (
          <div className="flex-1">
            <Button 
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving}
              variant="destructive"
              className="w-full h-20 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] disabled:opacity-50 border-b-4 border-red-800"
            >
              <Trash2 className="w-6 h-6" />
              <span className="font-bold text-lg">মসজিদ ডিলিট করুন</span>
            </Button>
          </div>
        )}

        {/* Delete Mosque Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="sm:max-w-[400px] rounded-3xl border-none p-6">
            <DialogHeader>
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#1e293b]">মসজিদটি ডিলিট করবেন?</DialogTitle>
              <DialogDescription className="text-sm text-[#64748b] pt-2">
                আপনি কি নিশ্চিতভাবে এই মসজিদের সকল তথ্য ডিলিট করতে চান? এই অ্যাকশনটি আর ফিরিয়ে আনা সম্ভব হবে না এবং এর সকল রেকর্ড ডাটাবেস থেকে মুছে যাবে।
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-3 pt-6">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border-[#e2e8f0] text-[#64748b] h-12 font-bold"
              >
                বাতিল করুন
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={isSaving}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white h-12 font-bold"
              >
                {isSaving ? "ডিলিট হচ্ছে..." : "হ্যাঁ, ডিলিট করুন"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {userRole === 'admin' && isNew && (
          <Button 
            onClick={seedSampleData}
            disabled={isSaving}
            variant="outline"
            className="flex-1 border-[#065f46] text-[#065f46] hover:bg-emerald-50 font-bold py-8 rounded-2xl text-xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            নমুনা তথ্য (Seed)
          </Button>
        )}
      </div>
      </div>
    </div>
  );
}
