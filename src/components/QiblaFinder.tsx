import React, { useState, useEffect } from 'react';
import { Compass, Navigation, Sparkles, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MECCA_LAT = 21.4225;
const MECCA_LNG = 39.8262;

export default function QiblaFinder() {
  const [heading, setHeading] = useState<number | null>(null);
  const [qiblaDirection, setQiblaDirection] = useState<number | null>(null);
  const [distanceToMecca, setDistanceToMecca] = useState<number | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isAligned, setIsAligned] = useState(false);

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    checkLocation();

    const handleOrientation = (event: DeviceOrientationEvent) => {
      // absolute alpha is more reliable for compass if available
      let compassHeading: number | undefined;
      
      if ((event as any).webkitCompassHeading !== undefined) {
        compassHeading = (event as any).webkitCompassHeading;
      } else if (event.absolute && event.alpha !== null) {
        compassHeading = 360 - event.alpha;
      } else if (event.alpha !== null) {
        // Fallback for non-absolute browsers
        compassHeading = 360 - event.alpha;
      }

      if (compassHeading !== undefined) {
        setPermissionStatus('granted');
        // Apply basic exponential smoothing (alpha = 0.2)
        setHeading(prev => {
          if (prev === null) return compassHeading!;
          const diff = compassHeading! - prev;
          const normalizedDiff = ((diff + 180) % 360 + 360) % 360 - 180;
          return (prev + normalizedDiff * 0.2 + 360) % 360;
        });
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('deviceorientationabsolute', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
    };
  }, []);

  const checkLocation = () => {
    setError(null);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ lat: latitude, lng: longitude });
          calculateQibla(latitude, longitude);
          const dist = calculateDistance(latitude, longitude, MECCA_LAT, MECCA_LNG);
          setDistanceToMecca(dist);
        },
        (err) => {
          if (err.code === 1) { // PERMISSION_DENIED
            setError("লোকেশন অ্যাক্সেস ব্লক করা। কিবলা খুঁজে পেতে ব্রাউজার থেকে লোকেশন পারমিশন দিন।");
          } else {
            setError("লোকেশন পাওয়া যায়নি। আপনার ডিভাইস লোকেশন সার্ভিস চালু আছে কি না পরীক্ষা করুন।");
          }
          toast.error("লোকেশন অ্যাক্সেস ত্রুটি");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setError("আপনার ব্রাউজারে জিওলোকেশন সাপোর্ট করে না।");
    }
  };

  // Check for alignment and trigger haptic feedback
  useEffect(() => {
    if (heading !== null && qiblaDirection !== null) {
      const diff = Math.abs(heading - qiblaDirection);
      const normalizedDiff = Math.min(diff, 360 - diff);
      const aligned = normalizedDiff < 5;
      
      if (aligned && !isAligned) {
        if ('vibrate' in navigator) {
          navigator.vibrate(50); // Short vibration when aligned
        }
      }
      setIsAligned(aligned);
    }
  }, [heading, qiblaDirection, isAligned]);

  const calculateQibla = (lat: number, lng: number) => {
    const phi1 = lat * (Math.PI / 180);
    const phi2 = MECCA_LAT * (Math.PI / 180);
    const deltalambda = (MECCA_LNG - lng) * (Math.PI / 180);

    const y = Math.sin(deltalambda);
    const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(deltalambda);
    let qibla = Math.atan2(y, x) * (180 / Math.PI);
    qibla = (qibla + 360) % 360;
    setQiblaDirection(qibla);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const requestPermission = async () => {
    if (isIOS && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setPermissionStatus('granted');
          window.addEventListener('deviceorientation', (event) => {
            const compassHeading = (event as any).webkitCompassHeading;
            if (compassHeading !== undefined) {
              setHeading(compassHeading);
            }
          });
        } else {
          setPermissionStatus('denied');
          toast.error("কম্পাস পারমিশন বাতিল করা হয়েছে");
        }
      } catch (err) {
        setPermissionStatus('denied');
        toast.error("কম্পাস পারমিশন পাওয়া যায়নি");
      }
    }
  };

  const rotation = heading !== null && qiblaDirection !== null ? (qiblaDirection - heading) : 0;

  return (
    <Card className="w-full max-w-md mx-auto overflow-hidden bg-white border-[#e2e8f0] shadow-sm rounded-2xl">
      <CardHeader className="bg-[#f8fafc] border-b border-[#e2e8f0] text-center py-6">
        <CardTitle className="text-xl font-bold flex items-center justify-center gap-2 text-[#1e293b]">
          <Compass className="w-5 h-5 text-[#065f46]" />
          কিবলা কম্পাস
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-8 py-12">
        {error ? (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="text-red-500 text-center p-5 bg-red-50 rounded-2xl border border-red-100 text-sm leading-relaxed">
              {error}
              {error.includes("ব্লক করা") && (
                <p className="mt-2 text-xs font-bold text-red-600">
                  Settings {" > "} Privacy {" > "} Location Services {" > "} Safari নিশ্চিত করুন।
                </p>
              )}
            </div>
            <Button 
              onClick={checkLocation}
              variant="outline"
              className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
            >
              আবার চেষ্টা করুন
            </Button>
          </div>
        ) : (
          <>
            {permissionStatus === 'denied' && isIOS ? (
              <div className="text-amber-600 text-center p-5 bg-amber-50 rounded-2xl border border-amber-100 text-sm leading-relaxed space-y-3">
                <p className="font-bold">কম্পাস কাজ করছে না?</p>
                <p className="text-xs">
                  যদি পারমিশন না আসে, তবে Settings {" > "} Safari {" > "} Motion {" & "} Orientation Access চালু করুন অথবা পেজটি রিফ্রেশ দিন।
                </p>
                <Button 
                  onClick={() => window.location.reload()}
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-amber-200 text-amber-700 hover:bg-amber-100/50"
                >
                  পেজ রিফ্রেশ করুন
                </Button>
              </div>
            ) : (
              <>
                <div className={`relative w-64 h-64 flex items-center justify-center transition-all duration-500 ${isAligned ? 'scale-110' : ''}`}>
                  {/* Perfect Match Glow */}
                  {isAligned && (
                    <div className="absolute inset-0 bg-[#059669]/10 rounded-full animate-pulse blur-2xl" />
                  )}

                  {/* Outer Compass Ring */}
                  <div 
                    className={`absolute inset-0 border-[6px] rounded-full transition-all duration-200 shadow-inner ${isAligned ? 'border-[#065f46] bg-[#065f46]/5' : 'border-[#f1f5f9]'}`}
                    style={{ transform: `rotate(${- (heading || 0)}deg)` }}
                  >
                    <div className={`absolute top-2 left-1/2 -translate-x-1/2 font-bold text-xs ${isAligned ? 'text-[#065f46]' : 'text-[#94a3b8]'}`}>N</div>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 font-bold text-[#94a3b8] text-xs">S</div>
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 font-bold text-[#94a3b8] text-xs">W</div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 font-bold text-[#94a3b8] text-xs">E</div>
                  </div>
    
                  {/* Qibla Indicator */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
                    style={{ transform: `rotate(${rotation}deg)` }}
                  >
                    <div className="relative flex flex-col items-center">
                      <div className={`w-1 h-24 bg-gradient-to-t from-transparent rounded-full absolute -top-12 transition-all duration-300 ${isAligned ? 'via-white to-white w-1.5' : 'via-[#059669] to-[#059669]'}`} />
                      <Navigation className={`w-12 h-12 transition-all duration-300 ${isAligned ? 'text-white fill-white scale-125' : 'text-[#065f46] fill-[#065f46]'} drop-shadow-md`} />
                      <div className={`mt-4 font-bold text-xs tracking-widest uppercase px-3 py-1 rounded-full border transition-all duration-300 ${isAligned ? 'bg-[#065f46] text-white border-white' : 'bg-[#ecfdf5] text-[#065f46] border-[#059669]/20'}`}>
                        {isAligned ? 'সঠিক দিকে' : 'কিবলা'}
                      </div>
                    </div>
                  </div>
    
                  {/* Center Point */}
                  <div className={`w-5 h-5 bg-white border-4 rounded-full z-10 shadow-md transition-all duration-300 ${isAligned ? 'border-white scale-110' : 'border-[#065f46]'}`} />
                </div>

                <div className="text-center space-y-4 w-full px-4">
                  {isAligned ? (
                    <div className="animate-bounce flex flex-col items-center gap-1">
                      <Sparkles className="w-6 h-6 text-amber-500 fill-amber-500" />
                      <span className="text-lg font-bold text-[#065f46]">আপনি কিবলার দিকে আছেন!</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center bg-[#f8fafc] p-4 rounded-2xl border border-[#e2e8f0]">
                      <div className="flex flex-col gap-1 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">আপনার রিডিং</span>
                        <p className="text-[#1e293b] font-bold text-lg">
                          {heading !== null ? `${Math.round(heading)}°` : "---"}
                        </p>
                      </div>
                      <div className="w-px h-8 bg-[#e2e8f0]" />
                      <div className="flex flex-col gap-1 text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#059669]">টার্গেট</span>
                        <p className="text-[#065f46] font-bold text-lg">
                          {qiblaDirection !== null ? `${Math.round(qiblaDirection)}°` : "---"}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-[#94a3b8]" />
                      <span className="text-[10px] text-[#64748b]">মক্কা থেকে:</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#1e293b]">
                      {distanceToMecca !== null ? `${Math.round(distanceToMecca).toLocaleString()} কি.মি.` : "---"}
                    </span>
                  </div>
                </div>
              </>
            )}

            {isIOS && heading === null && (
              <Button 
                onClick={requestPermission}
                className="bg-[#065f46] hover:bg-[#044e3a] text-white font-bold rounded-xl px-8 h-12 shadow-lg shadow-emerald-900/10"
              >
                কম্পাস চালু করুন
              </Button>
            )}

            <div className="text-[11px] text-[#64748b] text-center max-w-[250px] leading-relaxed bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0]">
              সঠিক ফলাফলের জন্য ফোনটি সমতল স্থানে রাখুন। চুম্বকীয় ক্ষেত্র কম্পাসের কাজে ব্যাঘাত ঘটাতে পারে।
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
