/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { Building2 as Mosque, Compass as CompassIcon, Bell, BellRing, Settings, MapPin, Volume2, VolumeX, ShieldCheck, Search, ChevronRight, Clock, Settings2, BookOpen, ArrowUpDown, LogIn, LogOut, User as UserIcon, Key, Trash2, Info, History, Phone, Image as ImageIcon, Sparkles, Globe, LayoutDashboard, Plus, Mail, ExternalLink, CloudOff } from 'lucide-react';
import QiblaFinder from './components/QiblaFinder';
import AdminPanel from './components/AdminPanel';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import Library from './components/Library';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { auth, db, googleProvider, OperationType, handleFirestoreError, sendPasswordResetEmail, updateProfile, updateEmail } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, where, doc, getDoc, setDoc, addDoc, updateDoc } from 'firebase/firestore';

// Types
export interface MosqueData {
  id: string;
  name: string;
  address: string;
  distance?: string;
  nextJamaat: string;
  time: string;
  location: { lat: number; lng: number };
  active: boolean;
  adminUid: string;
  prayerTimes: { name: string; time: string; date?: string }[];
  jummahTime?: string;
  khateeb?: string;
  imageUrl?: string;
  description?: string;
  contact?: string;
  history?: string;
  timezone?: string;
  createdAt?: any;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('mosques');
  const [mosques, setMosques] = useState<MosqueData[]>([]);
  const [selectedMosque, setSelectedMosque] = useState<MosqueData | null>(null);
  const [alertTime, setAlertTime] = useState(5);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [fajrAlertEnabled, setFajrAlertEnabled] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [customReminders, setCustomReminders] = useState<{ id: string; prayer: string; time: string; enabled: boolean }[]>([]);
  const [newReminderPrayer, setNewReminderPrayer] = useState('Fajr');
  const [newReminderTime, setNewReminderTime] = useState('05:00');
  const [radiusFilter, setRadiusFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'time' | 'newest'>('newest');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [prayerNameFilter, setPrayerNameFilter] = useState<string>('all');
  const [timeSearchFilter, setTimeSearchFilter] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [notifiedMosques, setNotifiedMosques] = useState<Set<string>>(new Set());
  const [notifiedAlarms, setNotifiedAlarms] = useState<Set<string>>(new Set());
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [speechLanguage, setSpeechLanguage] = useState('bn-BD');
  const [speechRate, setSpeechRate] = useState(1.0);

  // Constants for marker styling (keeping them outside state)
  const markerColor = '#ef4444';
  const markerIcon = 'mosque';

  // Offline Sync - Load from localStorage
  useEffect(() => {
    const cached = localStorage.getItem('mosques_cache');
    if (cached) {
      try {
        setMosques(JSON.parse(cached));
      } catch (e) {
        console.error("Cache parsing error", e);
      }
    }

    const handleOnline = () => {
      setIsOffline(false);
      toast.success("আপনি এখন অনলাইন আছেন");
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error("আপনি অফলাইনে আছেন। লিমিটেড ফিচার কাজ করবে।");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update cache when mosques change
  useEffect(() => {
    if (mosques.length > 0) {
      localStorage.setItem('mosques_cache', JSON.stringify(mosques));
    }
  }, [mosques]);

  const playNotification = (message: string, isAlarm: boolean = false) => {
    // 1. Voice Alert
    if (voiceEnabled) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = speechLanguage;
      utterance.rate = speechRate;
      window.speechSynthesis.speak(utterance);
    }

    // 2. Alarm Sound
    if (alarmEnabled || isAlarm) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.error("Audio play failed:", e));
    }

    // 3. System Notification
    if (Notification.permission === 'granted') {
      new Notification('মসজিদ কানেক্ট (Masjid Connect)', {
        body: message,
        icon: '/favicon.ico'
      });
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success("নোটিফিকেশন পারমিশন দেওয়া হয়েছে");
      } else {
        toast.error("নোটিফিকেশন পারমিশন রিফিউজ করা হয়েছে");
      }
    }
  };

  const testVoiceAlert = () => {
    playNotification("আসসালামু আলাইকুম। এটি একটি পরীক্ষামূলক ভয়েস অ্যালার্ট।");
  };

  // Geo-fencing and Location Tracking
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      console.error("Geolocation is not supported by this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setUserLocation({ lat, lng });
      },
      (error) => {
        console.error("Error tracking location:", error);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Check for Geo-fence entries
  useEffect(() => {
    if (!userLocation || mosques.length === 0) return;

    const GEOFENCE_RADIUS_METERS = 500;

    mosques.forEach(mosque => {
      if (!mosque.active) return;

      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        mosque.location.lat,
        mosque.location.lng
      );

      const distanceInMeters = distance * 1000;

      if (distanceInMeters <= GEOFENCE_RADIUS_METERS) {
        if (!notifiedMosques.has(mosque.id)) {
          const next = getNextJamaat(mosque.prayerTimes);
          
          toast(`🕌 আপনি ${mosque.name} এর কাছে আছেন`, {
            description: `পরবর্তী জামায়াত: ${next.name} (${next.time})`,
            duration: 8000,
            icon: <Mosque className="w-4 h-4 text-[#065f46]" />
          });

          if (voiceEnabled || alarmEnabled) {
            playNotification(`আপনি ${mosque.name} এর কাছে আছেন। পরবর্তী জামায়াত ${next.name} ${next.time}`);
          }

          setNotifiedMosques(prev => new Set(prev).add(mosque.id));
        }
      } else {
        // Remove from notified list if they move away, so they can be notified again if they re-enter
        if (notifiedMosques.has(mosque.id)) {
          setNotifiedMosques(prev => {
            const next = new Set(prev);
            next.delete(mosque.id);
            return next;
          });
        }
      }
    });
  }, [userLocation, mosques, notifiedMosques, voiceEnabled]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setNewName(currentUser.displayName || '');
        setNewEmail(currentUser.email || '');
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setNewPhone(data.phone || '');
            // System Admin check (Hasanul Banna)
            const isSystemAdmin = currentUser.email === 'hasanul.banna1991@gmail.com';
            if (isSystemAdmin && data.role !== 'admin') {
              await setDoc(doc(db, 'users', currentUser.uid), { ...data, role: 'admin' }, { merge: true });
              setUserRole('admin');
            } else {
              setUserRole(data.role || 'user');
            }
          } else {
            // Create default user profile
            const isSystemAdmin = currentUser.email === 'hasanul.banna1991@gmail.com';
            const newProfile = { 
              email: currentUser.email, 
              role: isSystemAdmin ? 'admin' : 'user',
              phone: '',
              displayName: currentUser.displayName || '',
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            setUserRole(newProfile.role);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole('user'); // Fallback
        }
      } else {
        setUserRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Custom Reminders & Prayer Time Alarms Trigger
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTotalMinutes = currentHours * 60 + currentMinutes;
      const currentTimeStr = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
      
      // 1. Custom Reminders
      customReminders.forEach(reminder => {
        const reminderId = `custom-${reminder.id}-${currentTimeStr}`;
        if (reminder.enabled && reminder.time === currentTimeStr && !notifiedAlarms.has(reminderId)) {
          toast(`⏰ রিমাইন্ডার: ${reminder.prayer} এর সময় হয়েছে`, {
            description: `আপনার সেট করা সময়: ${reminder.time}`,
            duration: 10000,
          });
          
          playNotification(`${reminder.prayer} এর সময় হয়েছে`, true);
          setNotifiedAlarms(prev => new Set(prev).add(reminderId));
        }
      });

      // 2. Mosque Prayer Time Alerts (X minutes before)
      mosques.forEach(mosque => {
        if (!mosque.active) return;
        
        mosque.prayerTimes.forEach(p => {
          const prayerMinutes = parseTime(p.time);
          const alertTotalMinutes = prayerMinutes - alertTime;
          
          // Trigger if we are exactly at the alert time
          if (currentTotalMinutes === alertTotalMinutes) {
            const alertId = `mosque-${mosque.id}-${p.name}-${currentTimeStr}`;
            if (!notifiedAlarms.has(alertId)) {
              toast(`📢 জামায়াত অ্যালার্ট: ${mosque.name}`, {
                description: `${p.name} জামায়াত ${alertTime} মিনিট পর শুরু হবে (${p.time})`,
                duration: 15000,
              });
              
              playNotification(`${mosque.name} এ ${p.name} জামায়াত আর ${alertTime} মিনিট পর শুরু হবে।`);
              setNotifiedAlarms(prev => new Set(prev).add(alertId));
            }
          }
        });
      });
      
      // Clear notifiedAlarms for previous times every hour to keep memory low
      if (currentMinutes === 0) {
        setNotifiedAlarms(new Set());
      }

    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [customReminders, mosques, alertTime, voiceEnabled, alarmEnabled, notifiedAlarms]);

  // Firestore Real-time Listener for Mosques
  useEffect(() => {
    const mosquesRef = collection(db, 'mosques');
    const unsubscribe = onSnapshot(mosquesRef, (snapshot) => {
      const mosqueList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MosqueData[];
      setMosques(mosqueList);
      
      // Update selected mosque if it exists in the new list
      setSelectedMosque(prev => {
        const listWithNext = mosqueList.map(m => {
          const next = getNextJamaat(m.prayerTimes);
          return { ...m, nextJamaat: next.name, time: next.time };
        });
        
        if (!prev && listWithNext.length > 0) return listWithNext[0];
        if (prev) {
          const updated = listWithNext.find(m => m.id === prev.id);
          return updated || (listWithNext.length > 0 ? listWithNext[0] : null);
        }
        return null;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'mosques');
    });
    return () => unsubscribe();
  }, []); // Remove selectedMosque from dependencies to avoid re-subscribing on every selection

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("সফলভাবে লগইন হয়েছে");
    } catch (error) {
      toast.error("লগইন ব্যর্থ হয়েছে");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAdminMode(false);
      toast.success("লগআউট হয়েছে");
    } catch (error) {
      toast.error("লগআউট ব্যর্থ হয়েছে");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error("দয়া করে ইমেইল এড্রেস দিন");
      return;
    }

    setIsResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success("পাসওয়ার্ড রিসেট লিঙ্ক আপনার ইমেইলে পাঠানো হয়েছে");
      setIsForgotPasswordOpen(false);
      setResetEmail('');
    } catch (error: any) {
      console.error("Password reset error:", error);
      if (error.code === 'auth/user-not-found') {
        toast.error("এই ইমেইল দিয়ে কোন একাউন্ট পাওয়া যায়নি");
      } else if (error.code === 'auth/invalid-email') {
        toast.error("ভুল ইমেইল এড্রেস");
      } else {
        toast.error("পাসওয়ার্ড রিসেট করতে সমস্যা হয়েছে");
      }
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsProfileLoading(true);
    try {
      // Update Firebase Auth Profile
      if (newName !== user.displayName) {
        await updateProfile(user, { displayName: newName });
      }

      // Update Email if changed
      if (newEmail !== user.email) {
        await updateEmail(user, newEmail);
      }

      // Update Firestore User Document
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: newName,
        email: newEmail,
        phone: newPhone
      });

      // Force update the local user state to reflect changes in header
      setUser({ ...auth.currentUser! });

      toast.success("প্রোফাইল সফলভাবে আপডেট করা হয়েছে");
    } catch (error: any) {
      console.error("Profile update error:", error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error("ইমেইল পরিবর্তনের জন্য আপনাকে পুনরায় লগইন করতে হবে");
      } else {
        toast.error("প্রোফাইল আপডেট করতে সমস্যা হয়েছে");
      }
    } finally {
      setIsProfileLoading(false);
    }
  };

  const addCustomReminder = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setCustomReminders([...customReminders, { id, prayer: newReminderPrayer, time: newReminderTime, enabled: true }]);
    toast.success("রিমাইন্ডার যোগ করা হয়েছে");
  };

  const removeCustomReminder = (id: string) => {
    setCustomReminders(customReminders.filter(r => r.id !== id));
    toast.success("রিমাইন্ডার মুছে ফেলা হয়েছে");
  };

  const toggleCustomReminder = (id: string) => {
    setCustomReminders(customReminders.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const seedSampleData = async () => {
    if (userRole !== 'admin') return;
    
    const loadingToast = toast.loading("নমুনা তথ্য যোগ করা হচ্ছে...");
    try {
          const samples = [
            {
              name: "বায়তুল মোকাররম জাতীয় মসজিদ",
              address: "ঢাকা, বাংলাদেশ",
              active: true,
              adminUid: user?.uid || '',
              location: { lat: 23.7289, lng: 90.4126 },
          nextJamaat: "Dhuhr",
          time: "1:30 PM",
          jummahTime: "1:30 PM",
          khateeb: "মাওলানা মুফতি রুহুল আমীন",
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
          adminUid: user?.uid,
          location: { lat: 23.7155, lng: 90.3989 },
          nextJamaat: "Asr",
          time: "4:45 PM",
          jummahTime: "1:45 PM",
          khateeb: "মাওলানা আব্দুল হাই",
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
          adminUid: user?.uid,
          location: { lat: 23.7189, lng: 90.3881 },
          nextJamaat: "Maghrib",
          time: "6:18 PM",
          jummahTime: "1:30 PM",
          khateeb: "মাওলানা জুবায়ের আহমদ",
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
    }
  };

  const parseDistance = (distStr: string) => {
    const value = parseFloat(distStr);
    if (distStr.toLowerCase().includes('km')) return value;
    if (distStr.toLowerCase().includes('m')) return value / 1000;
    return value;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  const parseTime = (timeStr: string) => {
    if (!timeStr) return 0;
    try {
      const parts = timeStr.trim().split(' ');
      const timePart = parts[0];
      const modifier = parts[1]; // AM/PM (might be undefined for 24h)
      
      let [hours, minutes] = timePart.split(':').map(Number);
      if (isNaN(hours)) hours = 0;
      if (isNaN(minutes)) minutes = 0;

      if (modifier) {
        if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
      }
      return hours * 60 + minutes;
    } catch (e) {
      return 0;
    }
  };

  const getLocalTimeFromMosqueTime = (mosqueTime: string, mosqueTimezone: string = 'Asia/Dhaka') => {
    if (!mosqueTime) return '';
    
    try {
      const now = new Date();
      const [time, modifier] = mosqueTime.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;

      // Create a date object in the mosque's timezone
      const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      
      // This represents the time AT the mosque
      const mosqueDate = toZonedTime(dateStr, mosqueTimezone);
      
      // Format it for the user's local timezone
      return mosqueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) {
      return mosqueTime;
    }
  };

  const getNextJamaat = (prayerTimes: { name: string; time: string }[]) => {
    if (!prayerTimes || prayerTimes.length === 0) return { name: 'N/A', time: '--:--' };
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Sort prayer times by their minutes from midnight
    const sortedTimes = [...prayerTimes].sort((a, b) => parseTime(a.time) - parseTime(b.time));
    
    // Find the first prayer that is after the current time
    const next = sortedTimes.find(p => parseTime(p.time) > currentMinutes);
    
    // If no prayer is left today, the next one is the first prayer of tomorrow (usually Fajr)
    return next || sortedTimes[0];
  };

  const handleSaveSettings = () => {
    toast.success(`সেটিংস সেভ করা হয়েছে: জামায়াতের ${alertTime} মিনিট আগে অ্যালার্ট পাবেন`);
  };

  // Update mosques list with calculated next jamaat and distance
  const processedMosques = mosques.map(m => {
    const next = getNextJamaat(m.prayerTimes);
    let distance = m.distance;

    if (userLocation) {
      const d = calculateDistance(userLocation.lat, userLocation.lng, m.location.lat, m.location.lng);
      distance = d.toFixed(2) + ' km';
    }

    return { ...m, nextJamaat: next.name, time: next.time, distance };
  });

  const filteredMosques = processedMosques
    .filter(mosque => {
      // Status Filter
      if (statusFilter === 'active' && !mosque.active) return false;
      if (statusFilter === 'inactive' && mosque.active) return false;

      // Radius Filter
      if (radiusFilter !== 'all') {
        const distance = mosque.distance ? parseDistance(mosque.distance) : 0;
        if (distance > (radiusFilter as number)) return false;
      }

      // Prayer Name & Time Filter
      if (prayerNameFilter !== 'all' || timeSearchFilter) {
        return mosque.prayerTimes.some(pt => {
          const matchesName = prayerNameFilter === 'all' || pt.name === prayerNameFilter;
          const matchesTime = !timeSearchFilter || pt.time.toLowerCase().includes(timeSearchFilter.toLowerCase());
          return matchesName && matchesTime;
        });
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'distance') {
        const distA = a.distance ? parseDistance(a.distance) : Infinity;
        const distB = b.distance ? parseDistance(b.distance) : Infinity;
        return distA - distB;
      } else if (sortBy === 'time') {
        return parseTime(a.time) - parseTime(b.time);
      } else {
        // newest
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt || 0));
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt || 0));
        return timeB - timeA;
      }
    });

  if (isAdminMode && selectedMosque) {
    return (
      <AdminPanel 
        mosque={selectedMosque} 
        onClose={() => {
          setIsAdminMode(false);
          setIsAddingNew(false);
        }} 
        userRole={userRole}
        userId={user?.uid}
        isNew={isAddingNew}
        userLocation={userLocation}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#1e293b] font-sans">
      {/* Desktop Layout */}
      <div className="hidden lg:grid grid-cols-[280px_1fr_320px] grid-rows-[70px_1fr] h-screen overflow-hidden">
        {/* Header */}
        <header className="col-span-full bg-[#065f46] text-white flex items-center justify-between px-6 shadow-md z-10">
          <div className="flex items-center gap-3">
            <Mosque className="w-6 h-6" />
            <div className="flex flex-col">
              <span className="text-xl font-bold leading-none">মসজিদ কানেক্ট (Masjid Connect)</span>
              {isOffline && (
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-amber-200">
                  <CloudOff className="w-3 h-3" />
                  <span className="font-bold uppercase tracking-wider">অফলাইন মোড</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div 
                  className="text-right cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setActiveTab('profile')}
                >
                  <p className="text-xs font-bold">{user.displayName || 'ইউজার'}</p>
                  <p className="text-[9px] opacity-70 uppercase">{userRole}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-full text-xs"
                >
                  লগআউট
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button 
                  onClick={() => setIsForgotPasswordOpen(true)}
                  variant="ghost"
                  className="text-white/70 hover:text-white text-[10px] h-auto p-0"
                >
                  পাসওয়ার্ড ভুলে গেছেন?
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogin}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-full text-xs"
                >
                  লগইন
                </Button>
              </div>
            )}
            <Button 
              onClick={() => {
                if (!user) {
                  toast.error("দয়া করে আগে লগইন করুন");
                  return;
                }
                setIsAdminMode(true);
              }}
              variant="outline" 
              className="bg-white/15 border-white/30 text-white hover:bg-white/20 rounded-full text-xs px-4 h-9"
            >
              এডমিন মোড
            </Button>
          </div>
        </header>

        {/* Forgot Password Dialog */}
        <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
          <DialogContent className="sm:max-w-[400px] bg-white rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-6 bg-[#065f46] text-white">
              <DialogTitle className="text-xl font-bold">পাসওয়ার্ড রিসেট করুন</DialogTitle>
              <DialogDescription className="text-white/80 text-xs mt-1">
                আপনার ইমেইল এড্রেসটি দিন। আমরা আপনাকে পাসওয়ার্ড রিসেট করার একটি লিঙ্ক পাঠাবো।
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">ইমেইল এড্রেস</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                  <Input 
                    id="reset-email"
                    type="email"
                    placeholder="example@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="h-12 pl-10 rounded-xl border-[#e2e8f0] focus:ring-[#065f46] focus:border-[#065f46]"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsForgotPasswordOpen(false)}
                  className="flex-1 h-12 rounded-xl border-[#e2e8f0] text-[#64748b] font-bold"
                >
                  বাতিল
                </Button>
                <Button 
                  type="submit" 
                  disabled={isResetLoading}
                  className="flex-1 bg-[#065f46] text-white font-bold h-12 rounded-xl shadow-lg shadow-[#065f46]/20"
                >
                  {isResetLoading ? "পাঠানো হচ্ছে..." : "লিঙ্ক পাঠান"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Sidebar */}
        <aside className="bg-white border-r border-[#e2e8f0] p-5 flex flex-col gap-5 overflow-y-auto">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94a3b8] px-1">নিকটস্থ মসজিদসমূহ</h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2">
                <span className="text-[10px] font-bold text-[#64748b] uppercase">নিষ্ক্রিয়</span>
                <Switch 
                  checked={statusFilter === 'all'}
                  onCheckedChange={(checked) => setStatusFilter(checked ? 'all' : 'active')}
                  size="sm"
                />
              </div>
              <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-[#64748b]" />
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as 'distance' | 'time')}
                  className="text-[10px] font-bold text-[#065f46] bg-transparent border-none focus:ring-0 cursor-pointer p-0 w-full"
                >
                  <option value="distance">দূরত্ব</option>
                  <option value="time">সময়</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2">
              <MapPin className="w-3.5 h-3.5 text-[#64748b]" />
              <select 
                value={radiusFilter} 
                onChange={(e) => setRadiusFilter(e.target.value === 'all' ? 'all' : parseFloat(e.target.value))}
                className="text-[10px] font-bold text-[#065f46] bg-transparent border-none focus:ring-0 cursor-pointer p-0 w-full"
              >
                <option value={0.5}>0.5km</option>
                <option value={1}>1km</option>
                <option value={2}>2km</option>
                <option value={5}>5km</option>
                <option value="all">সব দূরত্ব</option>
              </select>
            </div>
          </div>

          {userRole === 'admin' ? (
            <Button 
              onClick={() => {
                const newMosque: MosqueData = {
                  id: '',
                  name: '',
                  address: '',
                  active: true,
                  adminUid: user?.uid || '',
                  nextJamaat: 'Fajr',
                  time: '5:00 AM',
                  location: { lat: 23.7, lng: 90.4 },
                  prayerTimes: [
                    { name: 'Fajr', time: '5:00 AM' },
                    { name: 'Dhuhr', time: '1:30 PM' },
                    { name: 'Asr', time: '4:30 PM' },
                    { name: 'Maghrib', time: '6:15 PM' },
                    { name: 'Isha', time: '8:00 PM' }
                  ]
                };
                setSelectedMosque(newMosque);
                setIsAddingNew(true);
                setIsAdminMode(true);
              }}
              className="w-full bg-[#065f46] text-white font-bold rounded-xl py-4 flex items-center justify-center gap-2 shadow-sm"
            >
              <Mosque className="w-4 h-4" /> নতুন মসজিদ যোগ করুন
            </Button>
          ) : !user ? (
            <Button 
              onClick={handleLogin}
              variant="outline"
              className="w-full border-dashed border-[#cbd5e1] text-[#64748b] font-bold rounded-xl py-4 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" /> লগইন করে মসজিদ যোগ করুন
            </Button>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-700 leading-relaxed">
                নতুন মসজিদ যোগ করার জন্য আপনার <strong>এডমিন</strong> পারমিশন প্রয়োজন। দয়া করে এডমিনের সাথে যোগাযোগ করুন।
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            {filteredMosques.map((mosque) => (
              <div 
                key={mosque.id}
                onClick={() => {
                  setSelectedMosque(mosque);
                  setIsDetailModalOpen(true);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                  selectedMosque?.id === mosque.id 
                    ? 'border-[#059669] bg-[#ecfdf5]' 
                    : 'bg-[#f8fafc] border-[#e2e8f0] hover:border-[#cbd5e1]'
                } ${!mosque.active ? 'opacity-60 grayscale-[0.5]' : ''}`}
              >
                {!mosque.active && (
                  <Badge className="absolute top-2 right-2 bg-gray-200 text-gray-600 text-[8px] h-4 px-1.5 border-none">
                    Inactive
                  </Badge>
                )}
                <div className="font-semibold text-[15px] mb-1">{mosque.name}</div>
                <div className="flex justify-between text-[12px] text-[#64748b]">
                  <span>{mosque.distance} দূরে</span>
                  <span>আসন্ন: {mosque.nextJamaat}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Map View */}
        <main className="relative bg-[#e5e7eb] map-pattern flex items-center justify-center overflow-hidden">
          {/* Geo-fence Visualization */}
          <div className="geofence-circle absolute w-[500px] h-[500px] rounded-full flex items-center justify-center">
            <div className="w-60 h-60 bg-emerald-500/5 rounded-full border border-emerald-500/10" />
          </div>
          
          {/* User Marker (Center) */}
          <div className="relative z-20">
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg relative">
              <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-40" />
            </div>
          </div>

          {/* Mosque Markers */}
          {filteredMosques.map((mosque) => {
            // Use real location if available, otherwise mock relative to a default center
            const centerLat = userLocation?.lat || 23.72;
            const centerLng = userLocation?.lng || 90.41;
            
            const latDiff = (mosque.location.lat - centerLat) * 5000;
            const lngDiff = (mosque.location.lng - centerLng) * 5000;
            const isSelected = selectedMosque?.id === mosque.id;
            
            // Calculate real distance for pulse
            const distKm = userLocation 
              ? calculateDistance(userLocation.lat, userLocation.lng, mosque.location.lat, mosque.location.lng)
              : (mosque.distance ? parseDistance(mosque.distance) : 1);
            
            const isVeryClose = distKm < 0.5;
            
            return (
              <div 
                key={mosque.id}
                className="absolute transition-all duration-500 cursor-pointer z-10"
                style={{ 
                  transform: `translate(${lngDiff}px, ${-latDiff}px)`,
                  opacity: mosque.active ? 1 : 0.4
                }}
                onClick={() => {
                  setSelectedMosque(mosque);
                  setIsDetailModalOpen(true);
                }}
              >
                <div className="relative group">
                  {/* Proximity Pulse */}
                  {mosque.active && isVeryClose && (
                    <div 
                      className="pulse-ring" 
                      style={{ color: isSelected ? '#059669' : markerColor }} 
                    />
                  )}
                  
                  {/* Marker Pin */}
                  <div 
                    className={`w-8 h-8 rounded-full rounded-bl-none rotate-[-45deg] border-2 border-white shadow-md flex items-center justify-center transition-all duration-300 overflow-hidden ${
                      isSelected ? 'scale-125 z-30' : 'scale-100'
                    }`}
                    style={{ 
                      backgroundColor: mosque.active ? (isSelected ? '#059669' : markerColor) : '#94a3b8' 
                    }}
                  >
                    <div className="rotate-[45deg] text-white w-full h-full flex items-center justify-center">
                      {mosque.imageUrl ? (
                        <img 
                          src={mosque.imageUrl} 
                          alt="" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Mosque className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* Label */}
                  <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded text-[8px] font-bold whitespace-nowrap shadow-sm border border-gray-100 transition-opacity ${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    {mosque.name}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl text-[10px] border border-[#e2e8f0] shadow-sm flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="font-bold">আপনার অবস্থান</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3 h-3 text-[#059669]" />
              <span className="text-[#64748b]">Geo-fencing: Active (500m)</span>
            </div>
          </div>
        </main>

        {/* Details Panel */}
        <aside className="bg-white border-l border-[#e2e8f0] p-6 flex flex-col gap-6 overflow-y-auto">
          {selectedMosque ? (
            <>
              {selectedMosque.imageUrl && (
                <div className="relative aspect-video rounded-2xl overflow-hidden shadow-lg mb-2">
                  <img 
                    src={selectedMosque.imageUrl} 
                    alt={selectedMosque.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                    <Badge className="bg-emerald-500 text-white border-none text-[10px] font-bold">
                      {selectedMosque.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </Badge>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="text-2xl font-bold m-0 text-[#1e293b]">{selectedMosque.name}</h2>
                    <p className="text-[#64748b] text-sm mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {selectedMosque.address}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedMosque.location.lat},${selectedMosque.location.lng}`, '_blank')}
                    className="rounded-xl border-[#e2e8f0] text-[#64748b] hover:text-[#065f46] hover:border-[#065f46] flex items-center gap-2 text-[10px] font-bold h-9"
                  >
                    <ExternalLink className="w-3 h-3" /> ম্যাপে দেখুন
                  </Button>
                </div>
              </div>

              {selectedMosque.description && (
                <div className="p-5 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 space-y-3">
                  <div className="flex items-center gap-2 text-[#065f46]">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Info className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">মসজিদ সম্পর্কে</h4>
                  </div>
                  <p className="text-sm text-[#475569] leading-relaxed">{selectedMosque.description}</p>
                </div>
              )}

              {selectedMosque.history && (
                <div className="p-5 bg-amber-50/30 rounded-2xl border border-amber-100/50 space-y-3">
                  <div className="flex items-center gap-2 text-amber-700">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <History className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">ইতিহাস ও ঐতিহ্য</h4>
                  </div>
                  <p className="text-sm text-[#475569] leading-relaxed italic">{selectedMosque.history}</p>
                </div>
              )}

              {selectedMosque.contact && (
                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#94a3b8] uppercase">যোগাযোগের তথ্য</p>
                      <p className="text-sm font-bold text-[#1e293b]">{selectedMosque.contact}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => window.open(`tel:${selectedMosque.contact}`)}
                    className="rounded-xl text-blue-600 hover:bg-blue-50"
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <div className="voice-alert p-3 rounded-lg flex items-center gap-3 text-sm font-medium">
                <Volume2 className="w-5 h-5 flex-shrink-0" />
                📢 ভয়েস অ্যালার্ট: {alertTime} মিনিট পর {selectedMosque.nextJamaat} জামায়াত শুরু হবে
              </div>

              <div className="space-y-1">
                {selectedMosque.prayerTimes.map((prayer: any) => (
                  <div 
                    key={prayer.name}
                    className={`flex justify-between items-center p-3 transition-all ${
                      prayer.name === selectedMosque.nextJamaat 
                        ? 'bg-[#065f46] text-white rounded-lg shadow-sm my-2' 
                        : 'border-bottom border-[#f1f5f9]'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{prayer.name}</span>
                      {prayer.date && (
                        <span className={`text-[10px] ${prayer.name === selectedMosque.nextJamaat ? 'text-emerald-100' : 'text-[#64748b]'}`}>
                          {new Date(prayer.date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <strong className="font-bold block">{getLocalTimeFromMosqueTime(prayer.time, selectedMosque.timezone)}</strong>
                      {selectedMosque.timezone && selectedMosque.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone && (
                        <span className={`text-[9px] ${prayer.name === selectedMosque.nextJamaat ? 'text-emerald-200' : 'text-[#94a3b8]'}`}>
                          স্থানীয়: {prayer.time}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {selectedMosque.jummahTime && (
                  <div className="flex justify-between items-center p-3 border-t border-[#f1f5f9] mt-2 bg-emerald-50/50 rounded-lg border border-emerald-100">
                    <div className="flex flex-col">
                      <span className="font-bold text-[#065f46]">জুম্মা (শুক্রবার)</span>
                      {selectedMosque.khateeb && (
                        <span className="text-[10px] text-[#64748b]">খতিব: {selectedMosque.khateeb}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <strong className="font-bold text-[#065f46] block">{getLocalTimeFromMosqueTime(selectedMosque.jummahTime, selectedMosque.timezone)}</strong>
                      {selectedMosque.timezone && selectedMosque.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone && (
                        <span className="text-[9px] text-[#94a3b8]">স্থানীয়: {selectedMosque.jummahTime}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-6 border-t border-[#e2e8f0]">
                <p className="text-[11px] text-[#94a3b8] mb-3">সর্বশেষ আপডেট: আজ ২:৩০ PM (মুয়াজ্জিন দ্বারা)</p>
                <Button 
                  onClick={() => {
                    if (!user) {
                      toast.error("দয়া করে আগে লগইন করুন");
                      return;
                    }
                    setIsAdminMode(true);
                  }}
                  className="w-full bg-[#065f46] hover:bg-[#044e3a] text-white font-bold py-6 rounded-lg"
                >
                  জামায়াতের সময় আপডেট করুন
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#94a3b8]">
              <Mosque className="w-12 h-12 mb-4 opacity-20" />
              <p>মসজিদ নির্বাচন করুন</p>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col h-screen">
        {/* Detail Modal for Mobile */}
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="sm:max-w-[425px] w-[95vw] p-0 overflow-hidden rounded-3xl border-none max-h-[92vh] flex flex-col">
            {selectedMosque && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="relative aspect-video shrink-0">
                  {selectedMosque.imageUrl ? (
                    <img 
                      src={selectedMosque.imageUrl} 
                      alt={selectedMosque.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#065f46] flex items-center justify-center">
                      <Mosque className="w-16 h-16 text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
                    <Badge className="w-fit mb-2 bg-emerald-500 text-white border-none">
                      {selectedMosque.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </Badge>
                    <div className="flex justify-between items-end">
                      <div>
                        <h2 className="text-2xl font-bold text-white leading-tight">{selectedMosque.name}</h2>
                        <p className="text-white/70 text-xs mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {selectedMosque.address}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedMosque.location.lat},${selectedMosque.location.lng}`, '_blank')}
                        className="rounded-xl h-8 text-[10px] font-bold bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-md"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> ম্যাপ
                      </Button>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1 overflow-y-auto">
                  <div className="p-6 space-y-6 pb-20">
                    <div className="voice-alert p-4 rounded-2xl flex items-center gap-3 text-sm font-bold">
                      <Volume2 className="w-5 h-5 text-amber-600" />
                      <span>{selectedMosque.nextJamaat} জামায়াত: {selectedMosque.time}</span>
                    </div>

                    {selectedMosque.description && (
                      <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                        <div className="flex items-center gap-2 text-[#065f46]">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Info className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-bold uppercase tracking-wider">মসজিদ সম্পর্কে</h4>
                        </div>
                        <p className="text-sm text-[#475569] leading-relaxed">{selectedMosque.description}</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-2">
                        <Clock className="w-3 h-3" /> জামায়াতের সময়সূচী
                      </h4>
                      <div className="grid gap-2">
                        {selectedMosque.prayerTimes.map((prayer: any) => (
                          <div 
                            key={prayer.name}
                            className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                              prayer.name === selectedMosque.nextJamaat 
                                ? 'bg-[#065f46] text-white border-[#065f46] shadow-md' 
                                : 'bg-[#f8fafc] border-[#e2e8f0]'
                            }`}
                          >
                            <span className="font-bold text-sm">{prayer.name}</span>
                            <div className="text-right">
                              <span className="font-bold text-sm block">{getLocalTimeFromMosqueTime(prayer.time, selectedMosque.timezone)}</span>
                              {selectedMosque.timezone && selectedMosque.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone && (
                                <span className={`text-[9px] ${prayer.name === selectedMosque.nextJamaat ? 'text-emerald-200' : 'text-[#94a3b8]'}`}>
                                  স্থানীয়: {prayer.time}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedMosque.history && (
                      <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
                        <div className="flex items-center gap-2 text-amber-700">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                            <History className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-bold uppercase tracking-wider">ইতিহাস ও ঐতিহ্য</h4>
                        </div>
                        <p className="text-sm text-[#475569] leading-relaxed italic">{selectedMosque.history}</p>
                      </div>
                    )}

                    {selectedMosque.contact && (
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                            <Phone className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-blue-400 uppercase">যোগাযোগ</p>
                            <p className="text-sm font-bold text-blue-900">{selectedMosque.contact}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => window.open(`tel:${selectedMosque.contact}`)}
                          className="rounded-xl text-blue-600 hover:bg-blue-100"
                        >
                          <Phone className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                <div className="p-6 border-t border-[#e2e8f0] bg-white">
                  <Button 
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      setIsAdminMode(true);
                    }}
                    className="w-full bg-[#065f46] hover:bg-[#044e3a] text-white font-bold h-12 rounded-xl"
                  >
                    সময় আপডেট করুন
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <header className="bg-[#065f46] text-white py-2 px-4 md:px-6 flex items-center justify-between shadow-sm sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Mosque className="w-5 h-5 md:w-6 md:h-6" />
            <h1 className="font-bold text-base md:text-lg">মসজিদ কানেক্ট <span className="hidden md:inline">(Masjid Connect)</span></h1>
          </div>
          <div className="flex items-center gap-2 md:gap-6">
            <div className="hidden md:flex items-center gap-4">
              <button 
                onClick={() => setActiveTab('mosques')}
                className={`text-xs font-bold uppercase tracking-wider transition-colors hover:text-emerald-200 ${activeTab === 'mosques' ? 'text-white underline underline-offset-8' : 'text-emerald-100'}`}
              >
                মসজিদ
              </button>
              <button 
                onClick={() => setActiveTab('library')}
                className={`text-xs font-bold uppercase tracking-wider transition-colors hover:text-emerald-200 ${activeTab === 'library' ? 'text-white underline underline-offset-8' : 'text-emerald-100'}`}
              >
                Read Here
              </button>
              <button 
                onClick={() => setActiveTab('qibla')}
                className={`text-xs font-bold uppercase tracking-wider transition-colors hover:text-emerald-200 ${activeTab === 'qibla' ? 'text-white underline underline-offset-8' : 'text-emerald-100'}`}
              >
                কিবলা
              </button>
            </div>
            {user ? (
              <div className="flex items-center gap-2 md:gap-4">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-xs font-bold leading-none">{user.displayName}</span>
                  <span className="text-[10px] opacity-70 uppercase tracking-wider">{userRole}</span>
                </div>
                <button 
                  onClick={() => setActiveTab('profile')}
                  className="focus:outline-none"
                >
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random`} className="w-8 h-8 md:w-9 md:h-9 rounded-full border border-white/20" alt="" />
                </button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => auth.signOut()}
                  className="hidden md:flex hover:bg-white/10 text-white text-xs font-bold h-8 px-3 rounded-lg"
                >
                  লগআউট
                </Button>
                {userRole === 'admin' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsAdminMode(!isAdminMode)}
                    className="hidden md:flex border-white/20 hover:bg-white/10 text-white text-xs font-bold h-8 px-3 rounded-lg"
                  >
                    {isAdminMode ? 'ইউজার মোড' : 'এডমিন মোড'}
                  </Button>
                )}
              </div>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogin}
                className="hover:bg-white/10 text-white p-2"
              >
                <LogIn className="w-5 h-5" />
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#f8fafc]">
          {/* Mobile View: Tabs */}
          <div className="md:hidden flex-1 overflow-y-auto p-4 pb-24">
            {isOffline && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top duration-500">
                <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                  <CloudOff className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-amber-900 uppercase">অফলাইন মোড</p>
                  <p className="text-[9px] text-amber-700">ইন্টারনেট নেই। আগের সেভ করা তথ্য দেখানো হচ্ছে।</p>
                </div>
              </div>
            )}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsContent value="mosques" className="space-y-6 outline-none mt-0">
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h2 className="text-2xl font-black text-[#1e293b]">নিকটস্থ মসজিদ</h2>
                      <p className="text-xs text-[#64748b]">আপনার চারপাশের জামায়াতের সময়সূচী</p>
                    </div>
                    <div className="w-10 h-10 bg-white rounded-xl border border-[#e2e8f0] flex items-center justify-center shadow-sm">
                      <MapPin className="w-5 h-5 text-[#065f46]" />
                    </div>
                  </div>

                  {selectedMosque && (
                    <div className="voice-alert p-4 rounded-2xl flex items-center justify-between shadow-sm border-[#fef3c7]">
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setVoiceEnabled(!voiceEnabled)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${voiceEnabled ? 'bg-amber-100/50 text-amber-700 hover:bg-amber-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                        </Button>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold opacity-70">আসন্ন জামায়াত</p>
                          <p className="text-sm font-bold">{selectedMosque.nextJamaat} - {selectedMosque.time}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`${voiceEnabled ? 'bg-amber-200/50 text-amber-800 border-none' : 'bg-gray-200/50 text-gray-400 border-none'} text-[9px] font-bold px-2 py-1 rounded-lg transition-colors`}>
                            {voiceEnabled ? 'ভয়েস অ্যাক্টিভ' : 'ভয়েস মিউট'}
                          </Badge>
                          <Switch 
                            checked={voiceEnabled} 
                            onCheckedChange={setVoiceEnabled}
                            className="scale-75 origin-right data-[state=checked]:bg-amber-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-[#f8fafc]/50 p-2.5 rounded-2xl border border-[#e2e8f0] space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <MapPin className="w-3.5 h-3.5 text-[#065f46]" />
                        </div>
                        <select 
                          value={radiusFilter === 'all' ? 'all' : radiusFilter}
                          onChange={(e) => setRadiusFilter(e.target.value === 'all' ? 'all' : parseFloat(e.target.value))}
                          className="w-full h-9 pl-8 pr-2 bg-white border border-[#e2e8f0] rounded-xl text-[10px] font-bold text-[#1e293b] appearance-none focus:ring-1 focus:ring-[#065f46]/20 transition-all cursor-pointer"
                        >
                          <option value="all">সব দূরত্ব</option>
                          <option value="0.5">০.৫ কি.মি. (কাছে)</option>
                          <option value="1">১.০ কি.মি. (কাছে)</option>
                          <option value="2">২.০ কি.মি. (এলাকা)</option>
                          <option value="5">৫.০ কি.মি. (শহর)</option>
                        </select>
                      </div>

                      <div className="relative">
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <ArrowUpDown className="w-3.5 h-3.5 text-[#065f46]" />
                        </div>
                        <select 
                          value={sortBy} 
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="w-full h-9 pl-8 pr-2 bg-white border border-[#e2e8f0] rounded-xl text-[10px] font-bold text-[#1e293b] appearance-none focus:ring-1 focus:ring-[#065f46]/20 transition-all cursor-pointer"
                        >
                          <option value="newest">নতুন মসজিদ আগে</option>
                          <option value="distance">দূরত্ব অনুযায়ী</option>
                          <option value="time">সময় অনুযায়ী</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#065f46]" />
                        </div>
                        <select 
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as any)}
                          className="w-full h-9 pl-8 pr-2 bg-white border border-[#e2e8f0] rounded-xl text-[10px] font-bold text-[#1e293b] appearance-none focus:ring-1 focus:ring-[#065f46]/20 transition-all cursor-pointer"
                        >
                          <option value="active">সক্রিয় মসজিদ</option>
                          <option value="inactive">নিষ্ক্রিয় মসজিদ</option>
                          <option value="all">সব মসজিদ</option>
                        </select>
                      </div>

                      <div className="relative">
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Clock className="w-3.5 h-3.5 text-[#065f46]" />
                        </div>
                        <select 
                          value={prayerNameFilter}
                          onChange={(e) => setPrayerNameFilter(e.target.value)}
                          className="w-full h-9 pl-8 pr-2 bg-white border border-[#e2e8f0] rounded-xl text-[10px] font-bold text-[#1e293b] appearance-none focus:ring-1 focus:ring-[#065f46]/20 transition-all cursor-pointer"
                        >
                          <option value="all">সব নামাজ</option>
                          <option value="Fajr">ফজর</option>
                          <option value="Dhuhr">যোহর</option>
                          <option value="Asr">আসর</option>
                          <option value="Maghrib">মাগরিব</option>
                          <option value="Isha">এশা</option>
                        </select>
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Search className="w-3.5 h-3.5 text-[#94a3b8] group-focus-within:text-[#065f46] transition-colors" />
                      </div>
                      <Input 
                        value={timeSearchFilter}
                        onChange={(e) => setTimeSearchFilter(e.target.value)}
                        placeholder="নামাজের নির্দিষ্ট সময় খুঁজুন (উদা: ১:৩০)"
                        className="h-9 pl-9 rounded-xl border border-[#e2e8f0] bg-white text-[10px] font-bold focus-visible:ring-1 focus-visible:ring-[#065f46]/20"
                      />
                    </div>
                  </div>

                  {user ? (
                    <Button 
                      onClick={() => {
                        const newMosque: MosqueData = {
                          id: '',
                          name: '',
                          address: '',
                          active: true,
                          adminUid: user?.uid || '',
                          nextJamaat: 'Fajr',
                          time: '5:00 AM',
                          location: userLocation || { lat: 23.7, lng: 90.4 },
                          prayerTimes: [
                            { name: 'Fajr', time: '5:00 AM' },
                            { name: 'Dhuhr', time: '1:30 PM' },
                            { name: 'Asr', time: '4:30 PM' },
                            { name: 'Maghrib', time: '6:15 PM' },
                            { name: 'Isha', time: '8:00 PM' }
                          ]
                        };
                        setSelectedMosque(newMosque);
                        setIsAddingNew(true);
                        setIsAdminMode(true);
                      }}
                      className="w-full bg-[#065f46] text-white font-bold rounded-2xl py-4 flex items-center justify-center gap-2 shadow-md hover:bg-[#059669] transition-all"
                    >
                      <Mosque className="w-5 h-5" /> নতুন মসজিদ যোগ করুন
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleLogin}
                      variant="outline"
                      className="w-full border-dashed border-[#cbd5e1] text-[#64748b] font-bold rounded-2xl py-4 flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-5 h-5" /> লগইন করে মসজিদ যোগ করুন
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {filteredMosques.length > 0 ? (
                    filteredMosques.map((mosque) => (
                      <Card 
                        key={mosque.id} 
                        onClick={() => {
                          setSelectedMosque(mosque);
                          setIsDetailModalOpen(true);
                        }}
                        className={`bg-white border-[#e2e8f0] shadow-sm transition-all overflow-hidden rounded-2xl relative group active:scale-[0.98] ${selectedMosque?.id === mosque.id ? 'border-[#059669] ring-2 ring-[#059669]/10 shadow-md' : 'hover:border-[#cbd5e1]'} ${!mosque.active ? 'opacity-60 grayscale-[0.5]' : ''}`}
                      >
                        {!mosque.active && (
                          <Badge className="absolute top-3 right-3 bg-gray-200 text-gray-600 text-[9px] h-5 px-2 border-none font-bold">
                            নিষ্ক্রিয়
                          </Badge>
                        )}
                        <CardHeader className="pb-2 bg-gradient-to-r from-[#f8fafc] to-white border-b border-[#f1f5f9] p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 pr-3">
                              <div className="flex items-center gap-2 mb-1">
                                <CardTitle className="text-base font-bold text-[#1e293b] leading-tight truncate">{mosque.name}</CardTitle>
                                {mosque.active && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
                              </div>
                                <CardDescription className="text-[11px] flex items-center gap-1.5 text-[#64748b]">
                                  <MapPin className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" /> 
                                  <span className="truncate">{mosque.distance || '0km'} away • {mosque.address}</span>
                                </CardDescription>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge className="bg-emerald-500 text-white border-none font-black text-xs px-2.5 py-1 shadow-sm">
                                {mosque.time}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                                <Clock className="w-5 h-5 text-[#065f46]" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-wider leading-none mb-0.5">পরবর্তী জামায়াত</span>
                                <span className="text-sm font-bold text-[#1e293b]">{mosque.nextJamaat}</span>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[#065f46] font-bold h-9 px-0 rounded-xl text-xs flex items-center gap-1 hover:bg-transparent"
                            >
                              বিস্তারিত <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                          {mosque.jummahTime && (
                            <div className="flex items-center justify-between text-[11px] bg-emerald-50/30 px-3 py-2.5 rounded-xl border border-emerald-100/50">
                              <div className="flex items-center gap-2">
                                <Mosque className="w-3.5 h-3.5 text-[#059669]" />
                                <span className="text-[#065f46] font-bold">জুম্মা: {mosque.jummahTime}</span>
                              </div>
                              {mosque.khateeb && <span className="text-[#64748b] font-medium truncate max-w-[120px]">খতিব: {mosque.khateeb}</span>}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-white border border-dashed border-[#e2e8f0] rounded-2xl">
                      <MapPin className="w-8 h-8 text-[#94a3b8] mx-auto mb-3 opacity-20" />
                      <p className="text-sm text-[#64748b] font-medium">{radiusFilter} কি.মি. এর মধ্যে কোন মসজিদ পাওয়া যায়নি</p>
                      <Button 
                        variant="link" 
                        onClick={() => setRadiusFilter('all')}
                        className="text-[#065f46] text-xs font-bold"
                      >
                        সব মসজিদ দেখুন
                      </Button>
                      
                      {userRole === 'admin' && (
                        <Button 
                          onClick={seedSampleData}
                          className="mt-4 bg-[#065f46] text-white font-bold rounded-xl px-6"
                        >
                          নমুনা মসজিদ যোগ করুন
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="library" className="outline-none mt-0 pt-16 sm:pt-6">
                <Library userRole={userRole} />
              </TabsContent>

              <TabsContent value="qibla" className="outline-none mt-0 pt-16 sm:pt-6">
                <div className="flex flex-col gap-5 p-4 bg-white rounded-3xl border border-[#e2e8f0] shadow-sm">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h2 className="text-2xl font-black text-[#1e293b]">কিবলা</h2>
                      <p className="text-xs text-[#64748b]">আপনার বর্তমান অবস্থান থেকে কিবলার দিক</p>
                    </div>
                  </div>
                  <QiblaFinder />
                </div>
              </TabsContent>

              <TabsContent value="alerts" className="space-y-6">
                <Card className="bg-white border-[#e2e8f0] shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0] py-5">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#1e293b]">
                      <Bell className="w-5 h-5 text-[#065f46]" />
                      অ্যালার্ট সেটিংস
                    </CardTitle>
                    <CardDescription className="text-xs">
                      জামায়াতের নোটিফিকেশন কখন এবং কীভাবে পাবেন তা সেট করুন।
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-8">
                    {/* Section 1: Timing */}
                    <div className="space-y-5">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-[#065f46] rounded-full" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">নোটিফিকেশন সময়</h4>
                        </div>
                        <Clock className="w-3.5 h-3.5 text-[#94a3b8]" />
                      </div>
                      
                      <div className="bg-[#f8fafc] p-5 rounded-2xl border border-[#e2e8f0] space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#1e293b]">জামায়াতের কতক্ষণ আগে?</span>
                          <span className="text-lg font-bold text-[#065f46]">{alertTime} <span className="text-[10px] font-normal text-[#64748b]">মিনিট</span></span>
                        </div>
                        <Slider
                          value={[alertTime]}
                          onValueChange={(vals) => setAlertTime(vals[0])}
                          max={60}
                          min={1}
                          step={1}
                          className="py-2"
                        />
                      </div>
                      
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex bg-white p-1 rounded-xl border border-[#e2e8f0] gap-1">
                          {[5, 10, 15, 20].map((time) => (
                            <Button
                              key={time}
                              variant="ghost"
                              size="sm"
                              onClick={() => setAlertTime(time)}
                              className={`text-[10px] h-7 px-3 rounded-lg transition-all ${
                                alertTime === time 
                                  ? 'bg-[#065f46] text-white shadow-sm' 
                                  : 'text-[#64748b] hover:bg-emerald-50'
                              }`}
                            >
                              {time}মি.
                            </Button>
                          ))}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setAlertTime(5)}
                          className="text-[10px] h-8 text-[#64748b] hover:text-[#065f46] hover:bg-emerald-50 font-bold"
                        >
                          রিসেট
                        </Button>
                      </div>
                    </div>

                    {/* Section 2: Preferences */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-[#065f46] rounded-full" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">অ্যালার্ট পছন্দসমূহ</h4>
                        </div>
                        <Settings2 className="w-3.5 h-3.5 text-[#94a3b8]" />
                      </div>
                      
                      <div className="grid gap-3">
                        <div 
                          onClick={() => setFajrAlertEnabled(!fajrAlertEnabled)}
                          className={`group cursor-pointer flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${fajrAlertEnabled ? 'bg-white border-[#065f46]/30 shadow-md shadow-emerald-900/5' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${fajrAlertEnabled ? 'bg-emerald-100 text-[#065f46]' : 'bg-white text-[#94a3b8]'}`}>
                              <Bell className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#1e293b]">ফজর অ্যালার্ট</p>
                              <p className="text-[10px] text-[#64748b]">ভোরবেলা অ্যালার্ট পান</p>
                            </div>
                          </div>
                          <Switch checked={fajrAlertEnabled} onCheckedChange={setFajrAlertEnabled} />
                        </div>

                        <div 
                          onClick={() => setVoiceEnabled(!voiceEnabled)}
                          className={`group cursor-pointer flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${voiceEnabled ? 'bg-white border-[#065f46]/30 shadow-md shadow-emerald-900/5' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${voiceEnabled ? 'bg-emerald-100 text-[#065f46]' : 'bg-white text-[#94a3b8]'}`}>
                              <Volume2 className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#1e293b]">ভয়েস অ্যালার্ট</p>
                              <p className="text-[10px] text-[#64748b]">কথা বলে সময় জানিয়ে দিবে</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => { e.stopPropagation(); testVoiceAlert(); }}
                              className="h-8 text-[10px] font-bold text-[#065f46] hover:bg-emerald-50 px-2 rounded-lg"
                            >
                              টেস্ট
                            </Button>
                            <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
                          </div>
                        </div>

                        {voiceEnabled && (
                          <div className="p-5 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">ভয়েস ভাষা (Language)</Label>
                                <Globe className="w-3.5 h-3.5 text-[#94a3b8]" />
                              </div>
                              <div className="relative">
                                <select 
                                  value={speechLanguage}
                                  onChange={(e) => setSpeechLanguage(e.target.value)}
                                  className="w-full h-11 px-4 bg-white border border-[#e2e8f0] rounded-xl text-xs font-bold text-[#1e293b] focus:ring-2 focus:ring-[#065f46]/20 focus:border-[#065f46] outline-none appearance-none transition-all"
                                >
                                  <option value="bn-BD">বাংলা (Bangladesh)</option>
                                  <option value="en-US">English (United States)</option>
                                  <option value="en-GB">English (United Kingdom)</option>
                                  <option value="ar-SA">العربية (Saudi Arabia)</option>
                                  <option value="hi-IN">हिन्दी (India)</option>
                                  <option value="ur-PK">اردو (Pakistan)</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                  <ChevronRight className="w-4 h-4 text-[#94a3b8] rotate-90" />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">কথা বলার গতি (Speed)</Label>
                                <div className="flex items-center gap-1.5 bg-[#f1f5f9] px-2 py-0.5 rounded-lg">
                                  <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                                  <span className="text-[10px] font-bold text-[#065f46]">{speechRate}x</span>
                                </div>
                              </div>
                              <div className="px-1">
                                <Slider
                                  value={[speechRate]}
                                  onValueChange={(vals) => setSpeechRate(vals[0])}
                                  max={2.0}
                                  min={0.5}
                                  step={0.1}
                                  className="py-2"
                                />
                              </div>
                              <div className="flex justify-between text-[8px] font-bold text-[#94a3b8] uppercase tracking-widest px-1 pt-1">
                                <span>ধীর (Slow)</span>
                                <span>স্বাভাবিক (Normal)</span>
                                <span>দ্রুত (Fast)</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div 
                          onClick={() => setAlarmEnabled(!alarmEnabled)}
                          className={`group cursor-pointer flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${alarmEnabled ? 'bg-white border-[#065f46]/30 shadow-md shadow-emerald-900/5' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${alarmEnabled ? 'bg-emerald-100 text-[#065f46]' : 'bg-white text-[#94a3b8]'}`}>
                              <BellRing className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#1e293b]">অ্যালার্ম সাউন্ড</p>
                              <p className="text-[10px] text-[#64748b]">ঘন্টা বা অ্যালার্ম টোন বাজবে</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => { e.stopPropagation(); playNotification("অ্যালার্ম সাউন্ড টেস্ট হচ্ছে", true); }}
                              className="h-8 text-[10px] font-bold text-[#065f46] hover:bg-emerald-50 px-2 rounded-lg"
                            >
                              টেস্ট
                            </Button>
                            <Switch checked={alarmEnabled} onCheckedChange={setAlarmEnabled} />
                          </div>
                        </div>

                        <Button 
                          variant="outline" 
                          onClick={requestNotificationPermission}
                          className="w-full h-11 rounded-xl border-dashed border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-bold flex items-center justify-center gap-2"
                        >
                          <Bell className="w-4 h-4" /> সিস্টেম নোটিফিকেশন চালু করুন
                        </Button>
                      </div>
                    </div>

                    {/* Section 3: Custom Reminders */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-[#065f46] rounded-full" />
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">কাস্টম রিমাইন্ডার</h4>
                        </div>
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      </div>

                      <div className="p-5 bg-amber-50/30 rounded-2xl border border-amber-100/50 space-y-4">
                        <div className="grid grid-cols-1 sm:flex gap-2">
                          <select 
                            value={newReminderPrayer}
                            onChange={(e) => setNewReminderPrayer(e.target.value)}
                            className="flex-1 h-10 rounded-xl border-[#e2e8f0] bg-white text-xs font-bold px-3 focus:ring-amber-500 focus:border-amber-500 outline-none"
                          >
                            <option value="Fajr">ফজর</option>
                            <option value="Dhuhr">যোহর</option>
                            <option value="Asr">আসর</option>
                            <option value="Maghrib">মাগরিব</option>
                            <option value="Isha">এশা</option>
                            <option value="Tahajjud">তাহাজ্জুদ</option>
                          </select>
                          <div className="flex gap-2">
                            <Input 
                              type="time"
                              value={newReminderTime}
                              onChange={(e) => setNewReminderTime(e.target.value)}
                              className="flex-1 sm:w-32 h-10 rounded-xl border-[#e2e8f0] bg-white text-xs font-bold focus:ring-amber-500 focus:border-amber-500"
                            />
                            <Button 
                              onClick={addCustomReminder}
                              className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-10 px-6 rounded-xl shadow-sm shadow-amber-900/10"
                            >
                              যোগ
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {customReminders.length === 0 ? (
                            <p className="text-[10px] text-[#94a3b8] text-center py-2 italic">কোন কাস্টম রিমাইন্ডার নেই</p>
                          ) : (
                            customReminders.map((reminder) => (
                              <div key={reminder.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#e2e8f0] shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${reminder.enabled ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <Bell className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-[#1e293b]">{reminder.prayer}</p>
                                    <p className="text-[10px] text-[#64748b]">{reminder.time}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch 
                                    checked={reminder.enabled}
                                    onCheckedChange={() => toggleCustomReminder(reminder.id)}
                                  />
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => removeCustomReminder(reminder.id)}
                                    className="text-red-400 hover:text-red-600 p-0 h-auto"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="profile" className="outline-none">
                <Card className="bg-white border-[#e2e8f0] shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0] py-5">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#1e293b]">
                      <UserIcon className="w-5 h-5 text-[#065f46]" />
                      আপনার প্রোফাইল
                    </CardTitle>
                    <CardDescription className="text-xs">
                      আপনার নাম, ইমেইল এবং মোবাইল নম্বর আপডেট করুন।
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {user ? (
                      <form onSubmit={handleUpdateProfile} className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="profile-name" className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">আপনার নাম</Label>
                          <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                            <Input 
                              id="profile-name"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              className="pl-10 h-12 rounded-xl border-[#e2e8f0] focus:ring-[#065f46] focus:border-[#065f46]"
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="profile-email" className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">ইমেইল এড্রেস</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                            <Input 
                              id="profile-email"
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              className="pl-10 h-12 rounded-xl border-[#e2e8f0] focus:ring-[#065f46] focus:border-[#065f46]"
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="profile-phone" className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">মোবাইল নম্বর</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                            <Input 
                              id="profile-phone"
                              type="tel"
                              value={newPhone}
                              onChange={(e) => setNewPhone(e.target.value)}
                              placeholder="01XXXXXXXXX"
                              className="pl-10 h-12 rounded-xl border-[#e2e8f0] focus:ring-[#065f46] focus:border-[#065f46]"
                              required
                            />
                          </div>
                        </div>
                        <Button 
                          type="submit" 
                          disabled={isProfileLoading}
                          className="w-full bg-[#065f46] text-white font-bold h-12 rounded-xl shadow-lg shadow-[#065f46]/20"
                        >
                          {isProfileLoading ? "আপডেট হচ্ছে..." : "প্রোফাইল আপডেট করুন"}
                        </Button>
                      </form>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-[#64748b] mb-4">প্রোফাইল দেখতে দয়া করে লগইন করুন</p>
                        <Button onClick={handleLogin} className="bg-[#065f46] text-white font-bold rounded-xl px-8">
                          লগইন করুন
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {userRole === 'admin' && (
                <TabsContent value="dashboard" className="w-full outline-none">
                  <SuperAdminDashboard />
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Desktop View: Three Columns */}
          <div className="hidden md:flex flex-1 overflow-hidden">
            {/* Left Sidebar: Mosque List */}
            <div className="w-80 border-r border-[#e2e8f0] bg-white flex flex-col">
              <div className="p-4 border-b border-[#f1f5f9]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-[#64748b] uppercase tracking-wider">নিকটস্থ মসজিদসমূহ</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase">স্ট্যাটাস ও অবস্থান</Label>
                    <div className="space-y-2.5">
                       <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-[10px] font-bold text-[#065f46] appearance-none focus:ring-1 focus:ring-[#065f46]"
                      >
                        <option value="active">শুধুমাত্র সক্রিয় মসজিদ</option>
                        <option value="inactive">শুধুমাত্র নিষ্ক্রিয় মসজিদ</option>
                        <option value="all">সব মসজিদ</option>
                      </select>
                      
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-[#94a3b8] uppercase flex items-center gap-1 px-1">
                          <MapPin className="w-3 h-3" /> ব্যাসার্ধ ফিল্টার
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                          {[0.5, 1, 2, 5, 'all'].map((val) => (
                            <button
                              key={val}
                              onClick={() => setRadiusFilter(val === 'all' ? 'all' : val)}
                              className={`flex-1 min-w-[45px] px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${
                                radiusFilter === val 
                                  ? 'bg-[#065f46] text-white border-[#065f46] shadow-sm' 
                                  : 'text-[#64748b] bg-[#f8fafc] border-[#e2e8f0] hover:bg-white'
                              }`}
                            >
                              {val === 'all' ? 'সব' : `${val}km`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase">নামাজ ও সময়</Label>
                    <div className="flex gap-2">
                      <select 
                        value={prayerNameFilter}
                        onChange={(e) => setPrayerNameFilter(e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-[10px] font-bold text-[#065f46] appearance-none focus:ring-1 focus:ring-[#065f46]"
                      >
                        <option value="all">সব নামাজ</option>
                        <option value="Fajr">ফজর</option>
                        <option value="Dhuhr">যোহর</option>
                        <option value="Asr">আসর</option>
                        <option value="Maghrib">মাগরিব</option>
                        <option value="Isha">এশা</option>
                      </select>
                      <div className="flex-[1.5] relative">
                        <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
                        <Input 
                          value={timeSearchFilter}
                          onChange={(e) => setTimeSearchFilter(e.target.value)}
                          placeholder="সময় (উদা: 1:30)"
                          className="w-full pl-8 pr-2 py-2 h-9 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-[10px] font-bold focus:ring-[#065f46]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-[#64748b] uppercase">সর্টিং</Label>
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value as 'distance' | 'time')}
                      className="w-full px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-[10px] font-bold text-[#065f46] appearance-none focus:ring-1 focus:ring-[#065f46]"
                    >
                      <option value="distance">দূরত্ব অনুযায়ী</option>
                      <option value="time">সময় অনুযায়ী</option>
                    </select>
                  </div>
                </div>
                {userRole === 'admin' && (
                  <Button 
                    onClick={() => {
                      setSelectedMosque({
                        id: '',
                        name: '',
                        address: '',
                        nextJamaat: 'Fajr',
                        time: '5:30 AM',
                        location: userLocation || { lat: 23.7289, lng: 90.4126 },
                        active: true,
                        adminUid: user?.uid || '',
                        prayerTimes: [
                          { name: 'Fajr', time: '5:30 AM' },
                          { name: 'Dhuhr', time: '1:30 PM' },
                          { name: 'Asr', time: '4:45 PM' },
                          { name: 'Maghrib', time: '6:15 PM' },
                          { name: 'Isha', time: '8:00 PM' }
                        ],
                        timezone: 'Asia/Dhaka'
                      });
                      setIsAddingNew(true);
                      setIsAdminMode(true);
                    }}
                    className="w-full mt-4 bg-[#065f46] hover:bg-[#044e3a] text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 text-xs shadow-md"
                  >
                    <Plus className="w-4 h-4" /> নতুন মসজিদ যোগ করুন
                  </Button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredMosques.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-600 mb-1">কোনো মসজিদ পাওয়া যায়নি</h3>
                    <p className="text-xs text-gray-500 mb-4 line-relaxed">আপনার ফিল্টার বা সার্চ অনুযায়ী কোনো তথ্য পাওয়া যায়নি।</p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setRadiusFilter('all');
                        setSortBy('newest');
                        setStatusFilter('all');
                        setPrayerNameFilter('all');
                        setTimeSearchFilter('');
                      }}
                      className="text-xs font-bold rounded-xl border-[#e2e8f0]"
                    >
                      ফিল্টার রিসেট করুন
                    </Button>
                  </div>
                ) : (
                  filteredMosques.map(mosque => (
                    <Card 
                      key={mosque.id} 
                      onClick={() => setSelectedMosque(mosque)}
                      className={`cursor-pointer border-[#e2e8f0] transition-all relative overflow-hidden ${selectedMosque?.id === mosque.id ? 'border-[#065f46] ring-1 ring-[#065f46] bg-emerald-50/30' : 'hover:bg-[#f8fafc]'} ${!mosque.active ? 'opacity-60 grayscale-[0.5]' : ''}`}
                    >
                      {!mosque.active && (
                        <Badge className="absolute top-2 right-2 bg-gray-200 text-gray-600 text-[8px] h-4 px-1.5 border-none font-bold">
                          নিষ্ক্রিয়
                        </Badge>
                      )}
                      <CardContent className="p-3">
                        <h4 className="text-sm font-bold text-[#1e293b] truncate">{mosque.name}</h4>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-[#64748b]">{mosque.distance || '0km'} দুরে</span>
                          <span className="text-[10px] font-bold text-[#065f46]">আসন্ন: {mosque.nextJamaat}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Center: Map */}
            <div className="flex-1 relative bg-[#f1f5f9] map-pattern">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-64 h-64 rounded-full border-2 border-dashed border-[#065f46]/20 bg-[#065f46]/5 flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full bg-[#065f46]/10 border border-[#065f46]/20" />
                  <div className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10">
                    <div className="pulse-ring text-blue-500" />
                  </div>
                  <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <MapPin className="w-6 h-6 text-red-500 fill-red-500" />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur px-4 py-2 rounded-xl border border-[#e2e8f0] shadow-sm flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-[10px] font-bold text-[#1e293b]">আপনার অবস্থান</span>
                <div className="w-px h-3 bg-[#e2e8f0]" />
                <span className="text-[10px] text-[#64748b]">Geo-fencing: Active (500m)</span>
              </div>
            </div>

            {/* Right Sidebar: Mosque Details */}
            <div className="w-96 border-l border-[#e2e8f0] bg-white flex flex-col shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
              {selectedMosque ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-8 border-b border-[#f1f5f9] bg-gradient-to-b from-[#f8fafc] to-white">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-emerald-50 text-[#059669] border-emerald-100 font-bold text-[10px] px-2 py-0.5">
                        সক্রিয়
                      </Badge>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-black text-[#1e293b] leading-tight">{selectedMosque.name}</h2>
                    <div className="flex items-start gap-2 mt-2 text-[#64748b]">
                      <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="text-sm leading-relaxed">{selectedMosque.address}</p>
                    </div>
                    
                    <div className="mt-8 p-5 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4 shadow-sm">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-amber-600 border border-amber-100 shrink-0">
                        <Volume2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-amber-800 uppercase tracking-widest mb-0.5">ভয়েস অ্যালার্ট: {alertTime} মিনিট আগে</p>
                        <p className="text-sm text-amber-700 font-medium">{selectedMosque.nextJamaat} জামায়াত শুরু হবে {selectedMosque.time} মিনিটে</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-8 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">নামাজের সময়সূচী</h3>
                      <Clock className="w-4 h-4 text-[#94a3b8]" />
                    </div>
                    {selectedMosque.prayerTimes.map((prayer) => (
                      <div 
                        key={prayer.name}
                        className={`flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 ${selectedMosque.nextJamaat === prayer.name ? 'bg-[#065f46] border-[#065f46] text-white shadow-xl shadow-emerald-900/20 scale-[1.02]' : 'bg-[#f8fafc] border-[#e2e8f0] text-[#1e293b] hover:border-[#cbd5e1]'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${selectedMosque.nextJamaat === prayer.name ? 'bg-white animate-pulse' : 'bg-[#cbd5e1]'}`} />
                          <span className="font-bold text-lg">{prayer.name}</span>
                        </div>
                        <span className="font-black text-xl">{prayer.time}</span>
                      </div>
                    ))}
                    
                    {selectedMosque.jummahTime && (
                      <div className="mt-6 p-5 bg-emerald-50 border border-emerald-100 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Mosque className="w-5 h-5 text-[#059669]" />
                            <span className="font-bold text-[#065f46]">জুম্মা মোবারক</span>
                          </div>
                          <Badge className="bg-white text-[#059669] border-emerald-100 font-black text-sm px-3 py-1 shadow-sm">
                            {selectedMosque.jummahTime}
                          </Badge>
                        </div>
                        {selectedMosque.khateeb && (
                          <div className="flex items-center gap-2 text-xs text-[#059669] font-medium bg-white/50 p-2 rounded-lg">
                            <UserIcon className="w-3.5 h-3.5" />
                            <span>খতিব: {selectedMosque.khateeb}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-8 border-t border-[#f1f5f9] bg-[#f8fafc]">
                    {(userRole === 'admin' || (userRole === 'authority' && selectedMosque.adminUid === user?.uid)) && (
                      <Button 
                        onClick={() => setIsAdminMode(true)}
                        className="w-full bg-[#065f46] hover:bg-[#044e3a] text-white font-bold h-14 rounded-2xl shadow-lg shadow-emerald-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        সময় আপডেট করুন
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 bg-[#f8fafc] rounded-full flex items-center justify-center mb-6 border border-[#e2e8f0]">
                    <Mosque className="w-10 h-10 text-[#cbd5e1]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1e293b]">মসজিদ নির্বাচন করুন</h3>
                  <p className="text-sm text-[#64748b] mt-3 leading-relaxed max-w-[240px] mx-auto">বিস্তারিত সময়সূচী এবং অ্যালার্ট দেখতে বামদিকের তালিকা থেকে একটি মসজিদ বেছে নিন।</p>
                </div>
              )}
            </div>
          </div>
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8f0] pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-50">
          <div className="max-w-md mx-auto px-2 h-16 flex items-center justify-around">
            <button 
              onClick={() => setActiveTab('mosques')}
              className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'mosques' ? 'text-[#065f46]' : 'text-[#64748b]'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'mosques' ? 'bg-emerald-50' : 'bg-transparent'}`}>
                <Mosque className={`w-5 h-5 ${activeTab === 'mosques' ? 'fill-[#065f46]/10' : ''}`} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-tight">মসজিদ</span>
            </button>
            <button 
              onClick={() => setActiveTab('library')}
              className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'library' ? 'text-[#065f46]' : 'text-[#64748b]'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'library' ? 'bg-emerald-50' : 'bg-transparent'}`}>
                <BookOpen className={`w-5 h-5 ${activeTab === 'library' ? 'fill-[#065f46]/10' : ''}`} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-tight">Read Here</span>
            </button>
            <button 
              onClick={() => setActiveTab('qibla')}
              className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'qibla' ? 'text-[#065f46]' : 'text-[#64748b]'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'qibla' ? 'bg-emerald-50' : 'bg-transparent'}`}>
                <CompassIcon className={`w-5 h-5 ${activeTab === 'qibla' ? 'fill-[#065f46]/10' : ''}`} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-tight">কিবলা</span>
            </button>
            <button 
              onClick={() => setActiveTab('alerts')}
              className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'alerts' ? 'text-[#065f46]' : 'text-[#64748b]'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'alerts' ? 'bg-emerald-50' : 'bg-transparent'}`}>
                <Bell className={`w-5 h-5 ${activeTab === 'alerts' ? 'fill-[#065f46]/10' : ''}`} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-tight">অ্যালার্ট</span>
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'profile' ? 'text-[#065f46]' : 'text-[#64748b]'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'profile' ? 'bg-emerald-50' : 'bg-transparent'}`}>
                <UserIcon className={`w-5 h-5 ${activeTab === 'profile' ? 'fill-[#065f46]/10' : ''}`} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-tight">প্রোফাইল</span>
            </button>
            {userRole === 'admin' && (
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'dashboard' ? 'text-[#065f46]' : 'text-[#64748b]'}`}
              >
                <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-emerald-50' : 'bg-transparent'}`}>
                  <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'fill-[#065f46]/10' : ''}`} />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-tight">এডমিন</span>
              </button>
            )}
          </div>
        </nav>
      </div>

      <Toaster position="top-center" />
    </div>
  );
}

