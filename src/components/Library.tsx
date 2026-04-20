import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, 
  Search, 
  Book, 
  Heart, 
  MessageSquare, 
  Info, 
  ChevronRight, 
  ArrowLeft, 
  Quote, 
  Bookmark, 
  Sparkles,
  RefreshCw,
  Plus,
  Play,
  Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';

interface LibraryProps {
  userRole: string | null;
}

type Module = 'quran' | 'hadith' | 'dua' | 'masala';

const HADITH_BOOKS = [
  { id: 'ben-bukhari', name: 'সহীহ বুখারী', desc: 'ইমাম বুখারী (রঃ)', icon: <Book className="w-5 h-5" /> },
  { id: 'ben-muslim', name: 'সহীহ মুসলিম', desc: 'ইমাম মুসলিম (রঃ)', icon: <Book className="w-5 h-5" /> },
  { id: 'ben-nasai', name: 'সুনানে আন-নাসায়ী', desc: 'ইমাম আন-নাসায়ী (রঃ)', icon: <Book className="w-5 h-5" /> },
  { id: 'ben-abudawood', name: 'সুনানে আবু দাউদ', desc: 'ইমাম আবু দাউদ (রঃ)', icon: <Book className="w-5 h-5" /> },
  { id: 'ben-tirmidhi', name: 'সুনানে তিরমিযী', desc: 'ইমাম তিরমিযী (রঃ)', icon: <Book className="w-5 h-5" /> },
  { id: 'ben-ibnemajah', name: 'সুনানে ইবনে মাজাহ', desc: 'ইমাম ইবনে মাজাহ (রঃ)', icon: <Book className="w-5 h-5" /> },
];

export default function Library({ userRole }: LibraryProps) {
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const modules = [
    { id: 'quran' as Module, name: 'আল-কুরআন', desc: 'তেলাওয়াত ও তাফসির', icon: <BookOpen className="w-6 h-6" />, color: 'bg-emerald-100 text-emerald-700' },
    { id: 'hadith' as Module, name: 'হাদিস', desc: 'সিহাহ সিত্তাহ সংকলন', icon: <Quote className="w-6 h-6" />, color: 'bg-blue-100 text-blue-700' },
    { id: 'dua' as Module, name: 'দোয়া ও জিকির', desc: 'দৈনন্দিন জীবনের আমল', icon: <Sparkles className="w-6 h-6" />, color: 'bg-amber-100 text-amber-700' },
    { id: 'masala' as Module, name: 'মাসয়ালা-মাসায়েল', desc: 'প্রয়োজনীয় ফেকাহ সমাধান', icon: <MessageSquare className="w-6 h-6" />, color: 'bg-purple-100 text-purple-700' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f5f0] pb-20 sm:pb-8">
      {/* Header */}
      {!activeModule ? (
        <header className="p-6 pt-12 text-center space-y-2">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block p-3 bg-white rounded-2xl shadow-sm border border-[#e2e8f0] mb-4"
          >
            <BookOpen className="w-8 h-8 text-[#065f46]" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-4xl font-serif font-black text-[#1e293b]"
          >
            Read Here
          </motion.h1>
          <p className="text-base text-[#64748b] font-serif italic max-w-xs mx-auto">
            ইসলামিক জ্ঞান ও আমলের এক পূর্ণাঙ্গ ভাণ্ডার
          </p>
        </header>
      ) : (
        <header className="px-6 py-4 flex items-center gap-4 bg-white border-b border-[#e2e8f0] sticky top-0 z-20">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setActiveModule(null);
              setSearchQuery('');
            }}
            className="p-2 h-10 w-10 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-serif font-bold text-[#1e293b]">
            {modules.find(m => m.id === activeModule)?.name}
          </h2>
        </header>
      )}

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {!activeModule ? (
            <motion.div 
              key="grid"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {modules.map((m) => (
                <Card 
                  key={m.id}
                  onClick={() => setActiveModule(m.id)}
                  className="bg-white border-[#e2e8f0] shadow-sm hover:shadow-md h-full transition-all cursor-pointer group active:scale-[0.98] rounded-3xl overflow-hidden"
                >
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${m.color}`}>
                      {m.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-serif font-bold text-[#1e293b]">{m.name}</h3>
                      <p className="text-xs text-[#64748b] mt-1">{m.desc}</p>
                    </div>
                    <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-5 h-5 text-[#94a3b8]" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {activeModule === 'quran' && <QuranModule />}
              {activeModule === 'hadith' && <HadithModule />}
              {activeModule === 'dua' && <DuaModule />}
              {activeModule === 'masala' && <MasalaModule userRole={userRole} />}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Quran Module ---
function QuranModule() {
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<any>(null);
  const [verses, setVerses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recitationMode, setRecitationMode] = useState(false);
  const [searchVerse, setSearchVerse] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const playRecitation = (verseKey: string, verseId: number) => {
    if (playingId === verseId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const url = `https://verses.quran.com/Mishary/mp3/${verseKey.split(':')[0].padStart(3, '0')}${verseKey.split(':')[1].padStart(3, '0')}.mp3`;
    
    audioRef.current = new Audio(url);
    audioRef.current.play();
    setPlayingId(verseId);
    
    audioRef.current.onended = () => {
      setPlayingId(null);
    };
  };

  useEffect(() => {
    const cachedChapters = localStorage.getItem('mc_quran_chapters');
    if (cachedChapters) {
      setChapters(JSON.parse(cachedChapters));
    }

    fetch('https://api.quran.com/api/v4/chapters?language=bn')
      .then(res => res.json())
      .then(data => {
        const chaptersData = data.chapters || [];
        setChapters(chaptersData);
        localStorage.setItem('mc_quran_chapters', JSON.stringify(chaptersData));
      })
      .catch(err => {
        if (!cachedChapters) {
          toast.error("অধ্যায় তালিকা লোড করা সম্ভব হয়নি। অফলাইনে থাকার সম্ভাবনা রয়েছে।");
        }
      });
  }, []);

  const handleSearch = async (query: string) => {
    setSearchVerse(query);
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`https://api.quran.com/api/v4/search?q=${encodeURIComponent(query)}&size=20&language=bn`);
      const data = await res.json();
      setSearchResults(data.search.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (selectedChapter) {
      setIsLoading(true);
      setSearchVerse('');
      setSearchResults([]);

      const cacheKey = `mc_quran_verses_${selectedChapter.id}`;
      const cachedVerses = localStorage.getItem(cacheKey);
      
      if (cachedVerses) {
        setVerses(JSON.parse(cachedVerses));
        setIsLoading(false);
      }

      fetch(`https://api.quran.com/api/v4/verses/by_chapter/${selectedChapter.id}?language=bn&translations=161&fields=text_uthmani&per_page=300`)
        .then(res => res.json())
        .then(data => {
          const verseData = data.verses || [];
          setVerses(verseData);
          localStorage.setItem(cacheKey, JSON.stringify(verseData));
          setIsLoading(false);
        })
        .catch(err => {
          if (cachedVerses) {
            toast.info("অফলাইন মোড: পূর্বের সেভ করা আয়াতগুলো দেখানো হচ্ছে।");
          } else {
            toast.error("আয়াত লোড করা সম্ভব হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।");
          }
          setIsLoading(false);
        });
    }
  }, [selectedChapter]);

  const filteredVerses = verses.filter(v => 
    searchVerse === '' || v.verse_number.toString() === searchVerse
  );

  return (
    <div className="space-y-6">
      {!selectedChapter ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <Input 
              placeholder="সুরা খুঁজুন..." 
              className="pl-10 rounded-2xl border-[#e2e8f0]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {chapters.map(ch => (
              <Button
                key={ch.id}
                variant="outline"
                onClick={() => setSelectedChapter(ch)}
                className="h-16 rounded-2xl border-[#e2e8f0] bg-white hover:bg-emerald-50 hover:border-emerald-200 justify-start px-4 gap-4 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  {ch.id}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[#1e293b]">{ch.name_simple}</p>
                  <p className="text-[10px] text-[#64748b]">{ch.translated_name.name} • {ch.verses_count} আয়াত</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-arabic text-emerald-800">{ch.name_arabic}</p>
                </div>
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-[#e2e8f0]">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedChapter(null)}
                className="text-xs h-8 px-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> সুরা তালিকা
              </Button>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100">
                {selectedChapter.name_simple}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={recitationMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRecitationMode(true)}
                className={`h-8 rounded-xl text-[10px] font-bold ${recitationMode ? 'bg-[#065f46]' : ''}`}
              >
                তেলাওয়াত মোড
              </Button>
              <Button 
                variant={!recitationMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRecitationMode(false)}
                className={`h-8 rounded-xl text-[10px] font-bold ${!recitationMode ? 'bg-[#065f46]' : ''}`}
              >
                অনুবাদ মোড
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <Input 
              value={searchVerse}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="আয়াত নম্বর বা শব্দ দিয়ে সার্চ করুন..." 
              className="pl-10 rounded-2xl border-[#e2e8f0]"
            />
          </div>

          <div className="space-y-8 pb-12">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-sm font-serif italic text-[#64748b]">অনুসন্ধান করা হচ্ছে...</p>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((result, i) => (
                <div key={i} className="space-y-4 p-6 bg-white rounded-3xl border border-[#e2e8f0] shadow-sm">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-50 text-emerald-700 border-none">আয়াত {result.verse_key}</Badge>
                  </div>
                  <p className="text-2xl font-arabic text-[#1e293b] leading-loose text-right" style={{ direction: 'rtl' }}>
                    {result.text.replace(/<[^>]*>?/gm, '')}
                  </p>
                  <div className="p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100 italic">
                    <p className="text-sm text-[#475569] leading-relaxed font-serif" dangerouslySetInnerHTML={{ __html: result.translations?.[0]?.text }} />
                  </div>
                </div>
              ))
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-sm font-serif italic text-[#64748b]">কুরআনের নূর লোড হচ্ছে...</p>
              </div>
            ) : filteredVerses.map(v => (
              <div key={v.id} className={`space-y-6 ${recitationMode ? 'text-center' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs ring-1 ring-emerald-100">
                    {v.verse_number}
                  </div>
                  <div className="h-[1px] flex-1 mx-4 bg-[#e2e8f0]" />
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => playRecitation(v.verse_key, v.id)}
                      className={`h-8 w-8 p-0 rounded-full ${playingId === v.id ? 'bg-emerald-100 text-emerald-700' : 'text-[#94a3b8]'}`}
                    >
                      {playingId === v.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </Button>
                  </div>
                </div>
                
                <p className="text-4xl font-arabic text-[#1e293b] leading-[2.2] text-right" style={{ direction: 'rtl' }}>
                  {v.text_uthmani}
                </p>

                {!recitationMode && (
                  <div className="space-y-3 pl-5 border-l-4 border-emerald-500/20 italic">
                    <p className="text-lg text-[#334155] leading-relaxed font-serif">
                      {v.translations?.[0]?.text.replace(/<[^>]*>?/gm, '')}
                    </p>
                    <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-bold">
                      [ অনুবাদ: {v.translations?.[0]?.resource_name || 'Al-Quran Complex'} ]
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Hadith Module ---
function HadithModule() {
  const [activeBook, setActiveBook] = useState<string | null>(null);
  const [hadiths, setHadiths] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'books' | 'subjects'>('books');
  
  const subjects = [
    { name: 'ঈমান (Faith)', icon: '📖' },
    { name: 'সালাত (Prayer)', icon: '📿' },
    { name: 'যাকাত (Zakat)', icon: '💰' },
    { name: 'রোজা (Fasting)', icon: '🌙' },
    { name: 'হজ্জ (Hajj)', icon: '🕋' },
    { name: 'চরিত্র (Manners)', icon: '🤝' },
    { name: 'জ্ঞান (Knowledge)', icon: '🎓' },
  ];

  useEffect(() => {
    if (activeBook) {
      setIsLoading(true);
      fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${activeBook}.json`)
        .then(res => res.json())
        .then(data => {
          setHadiths(data.hadiths || []);
          setIsLoading(false);
        })
        .catch(err => {
          console.error(err);
          setIsLoading(false);
          toast.error("হাদিস লোড করা সম্ভব হয়নি");
        });
    }
  }, [activeBook]);

  const filteredHadiths = hadiths.filter(h => 
    searchQuery === '' || h.text.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 50);

  return (
    <div className="space-y-6">
      {!activeBook && (
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl h-11 bg-white border border-[#e2e8f0] p-1">
            <TabsTrigger value="books" className="rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">গ্রন্থ তালিকা</TabsTrigger>
            <TabsTrigger value="subjects" className="rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">বিষয় ভিত্তিক</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
        <Input 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="হাদিস বা বিষয় দিয়ে কুঁজুন..." 
          className="pl-10 rounded-2xl border-[#e2e8f0]"
        />
      </div>

      {!activeBook ? (
        activeView === 'books' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HADITH_BOOKS.map(book => (
              <Card 
                key={book.id}
                onClick={() => setActiveBook(book.id)}
                className="bg-white border-[#e2e8f0] shadow-sm hover:shadow-md transition-all cursor-pointer rounded-2xl"
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                    {book.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#1e293b]">{book.name}</h4>
                    <p className="text-[10px] text-[#64748b]">{book.desc}</p>
                  </div>
                  <ChevronRight className="ml-auto w-4 h-4 text-[#94a3b8]" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {subjects.map(sub => (
              <Card 
                key={sub.name}
                className="bg-white border-[#e2e8f0] shadow-sm hover:shadow-md transition-all cursor-pointer rounded-2xl border-b-4 border-b-blue-100 active:scale-95"
                onClick={() => {
                  setSearchQuery(sub.name.split(' (')[0]);
                  setActiveView('books');
                  toast.info(`${sub.name} সম্পর্কিত হাদিস লোড করার জন্য একটি গ্রন্থ নির্বাচন করুন।`);
                }}
              >
                <CardContent className="p-6 flex flex-col items-center gap-2">
                  <span className="text-2xl">{sub.icon}</span>
                  <span className="text-[11px] font-bold text-[#1e293b]">{sub.name}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-[#e2e8f0]">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setActiveBook(null);
                setHadiths([]);
              }}
              className="text-xs text-[#065f46] font-bold"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> গ্রন্থ তালিকা
            </Button>
            <Badge className="bg-blue-50 text-blue-700 border-none">
              {HADITH_BOOKS.find(b => b.id === activeBook)?.name}
            </Badge>
          </div>

          <div className="space-y-4 pb-12">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-sm font-serif italic text-[#64748b]">হাদিসের ভাণ্ডার লোড হচ্ছে...</p>
              </div>
            ) : filteredHadiths.length === 0 ? (
              <div className="text-center py-20">
                <Info className="w-12 h-12 text-blue-200 mx-auto mb-4" />
                <p className="text-sm text-[#64748b] italic">কোন হাদিস পাওয়া যায়নি</p>
              </div>
            ) : filteredHadiths.map((h, i) => (
              <Card key={i} className="bg-white border-[#e2e8f0] shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-blue-50/30 border-b border-blue-50 p-4">
                  <span className="text-[10px] font-bold text-blue-700 uppercase">হাদিস নং. {h.hadithnumber || i + 1}</span>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <p className="text-sm text-[#334155] leading-relaxed font-serif">
                    {h.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Dua Module ---
function DuaModule() {
  const categories = [
    { id: 'daily', title: 'দৈনন্দিন দোয়া', icon: '☀️' },
    { id: 'salat', title: 'নামাজ ও জিকির', icon: '📿' },
    { id: 'distress', title: 'বিপদ ও মুসিবত', icon: '⛈️' },
    { id: 'eating', title: 'খাবার ও পানীয়', icon: '🍽️' },
    { id: 'family', title: 'পরিবার ও সন্তান', icon: '🏠' },
    { id: 'protection', title: 'সুরক্ষা ও নিরাপত্তা', icon: '🛡️' },
  ];

  const [activeCategory, setActiveCategory] = useState('daily');
  const [searchQuery, setSearchQuery] = useState('');

  const allDuas = [
    { category: 'daily', arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ', bengali: 'সমস্ত প্রশংসা আল্লাহর জন্য, যিনি আমাদের মৃত্যুর (ঘুম) পর জীবিত করলেন এবং তাঁর দিকেই আমাদের ফিরে যেতে হবে।', ref: 'বুখারী: ৬৩১২', importance: 'ঘুম থেকে ওঠার দোয়া' },
    { category: 'daily', arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', bengali: 'হে আল্লাহ! আপনার নামেই আমি মৃত্যুবরণ করি (ঘুমাই) এবং আপনার নামেই জীবিত হই (জাগি)।', ref: 'বুখারী: ৬৩১২', importance: 'ঘুমানোর দোয়া' },
    { category: 'daily', arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ', bengali: 'হে আল্লাহ! আপনার অনুগ্রহে আমরা সকালে উপনীত হয়েছি এবং আপনার অনুগ্রহে আমরা সন্ধ্যায় উপনীত হয়েছি। আপনার নামেই আমরা জীবিত হই এবং আপনার নামেই আমরা মৃত্যুবরণ করি। আর আপনার দিকেই সবকিছুর প্রত্যাগমন।', ref: 'তিরমিযী: ৩৩৯১', importance: 'সকাল বেলার দোয়া' },
    { category: 'salat', arabic: 'اللَّهُمَّ أَنْتَ السَّلامُ وَمِنْكَ السَّلامُ تَبَارَكْتَ يَا ذَا الْجَلالِ وَالإِكْرَامِ', bengali: 'হে আল্লাহ! আপনিই শান্তিদাতা এবং আপনার থেকেই শান্তি আসে। হে মহিমময় ও মহানুভব! আপনি বরকতময়।', ref: 'মুসলিম: ১৩৩৪', importance: 'সালাম ফেরানোর পর দোয়া' },
    { category: 'salat', arabic: 'سُبْحَانَ رَبِّيَ الْعَظِيمِ', bengali: 'আমার মহান প্রতিপালকের পবিত্রতা ঘোষণা করছি।', ref: 'মুসলিম: ৭৭২', importance: 'রুকুর তাসবীহ' },
    { category: 'salat', arabic: 'سُبْحَانَ رَبِّيَ الأَعْلَى', bengali: 'আমার সর্বোচ্চ প্রতিপালকের পবিত্রতা ঘোষণা করছি।', ref: 'মুসলিম: ৭৭২', importance: 'সেজদার তাসবীহ' },
    { category: 'distress', arabic: 'لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ', bengali: 'আপনি ছাড়া আর কোনো উপাস্য নেই, আপনি পবিত্র। নিশ্চয়ই আমি অপরাধীদের অন্তর্ভুক্ত।', ref: 'সূরা আম্বিয়া: ৮৭', importance: 'বিপদ মুক্তির দোয়া (ইউনুস আ.)' },
    { category: 'distress', arabic: 'حَسْبُنَا اللَّهُ وَনִعْمَ الْوَكِيلُ', bengali: 'আল্লাহই আমাদের জন্য যথেষ্ট এবং তিনি কতই না চমৎকার কর্মবিধায়ক।', ref: 'সুরা আল-ইমরান: ১৭৩', importance: 'অসহায়ত্বের সময় দোয়া' },
    { category: 'distress', arabic: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ', bengali: 'হে চিরঞ্জীব! হে চিরন্তন! আমি আপনার রহমতের উসিলায় সাহায্য প্রার্থনা করছি।', ref: 'তিরমিযী: ৩৫২৪', importance: 'সংকট উত্তরণের দোয়া' },
    { category: 'eating', arabic: 'بِسْمِ اللَّهِ', bengali: 'আল্লাহর নামে (শুরু করছি)।', ref: 'বুখারী: ৫৩৭৬', importance: 'খাওয়ার আগের দোয়া' },
    { category: 'eating', arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ', bengali: 'সমস্ত প্রশংসা আল্লাহর জন্য, যিনি আমাদের আহার করিয়েছেন, পান করিয়েছেন এবং মুসলিম বানিয়েছেন।', ref: 'আবু দাউদ: ৩৮৫০', importance: 'খাওয়ার পরের দোয়া' },
    { category: 'family', arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا', bengali: 'হে আমাদের প্রতিপালক! আমাদের স্ত্রীদের ও সন্তানদের আমাদের জন্য চোখের শীতলতা স্বরূপ বানিয়ে দিন এবং আমাদের খোদাভীরুদের নেতা বানিয়ে দিন।', ref: 'সূরা ফুরকান: ৭৪', importance: 'নেক সন্তানের দোয়া' },
    { category: 'family', arabic: 'رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا', bengali: 'হে আমার রব! তাদের উভয়ের প্রতি দয়া করুন যেভাবে তারা আমাকে শৈশবে লালন-পালন করেছেন।', ref: 'সূরা বনী ইসরাঈল: ২৪', importance: 'পিতা-মাতার জন্য দোয়া' },
    { category: 'protection', arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ', bengali: 'আল্লাহর নামে, যাঁর নামের বরকতে আসমান ও জমিনের কোনো কিছুই কোনো ক্ষতি করতে পারে না। তিনি সর্বশ্রোতা ও সর্বজ্ঞ।', ref: 'আবু দাউদ: ৫০৮৮', importance: 'ক্ষতি থেকে সুরক্ষার দোয়া' },
  ];

  const filteredDuas = allDuas.filter(dua => 
    dua.category === activeCategory && 
    (searchQuery === '' || dua.bengali.includes(searchQuery) || dua.importance.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
        <Input 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="দোয়া বা আমল খুঁজুন..." 
          className="pl-10 rounded-2xl border-[#e2e8f0] bg-white"
        />
      </div>

      <ScrollArea className="w-full whitespace-nowrap pb-2">
        <div className="flex gap-3">
          {categories.map(c => (
            <Button 
              key={c.id}
              variant={activeCategory === c.id ? 'default' : 'outline'}
              onClick={() => setActiveCategory(c.id)}
              className={`rounded-2xl border-[#e2e8f0] px-4 py-6 flex flex-col items-center gap-1 transition-all ${activeCategory === c.id ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white text-[#1e293b]'}`}
            >
              <span className="text-xl">{c.icon}</span>
              <span className="text-[10px] font-bold">{c.title}</span>
            </Button>
          ))}
        </div>
      </ScrollArea>

      <div className="space-y-4 pb-12">
        {filteredDuas.map((dua, i) => (
          <Card key={i} className="bg-white border-[#e2e8f0] shadow-sm rounded-3xl overflow-hidden group">
            <CardHeader className="bg-amber-50/30 py-3 px-6">
              <Badge variant="ghost" className="text-[10px] p-0 font-bold text-amber-700 uppercase">{dua.importance}</Badge>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <p className="text-3xl font-arabic text-[#1e293b] leading-[2] text-center" style={{ direction: 'rtl' }}>{dua.arabic}</p>
              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50 italic text-sm text-[#475569]">
                <p className="font-serif">{dua.bengali}</p>
                <p className="mt-4 text-[9px] font-bold text-amber-700 uppercase">[ সূত্র: {dua.ref} ]</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- Masala Module ---
function MasalaModule({ userRole }: { userRole: string | null }) {
  const [masayel, setMasayel] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCat, setNewCat] = useState('ওযু ও পবিত্রতা');

  const categories = ['all', 'ওযু ও পবিত্রতা', 'সালাত (নামাজ)', 'রোজা ও রমজান', 'যাকাত ও সাদাকাহ', 'বিয়ে ও পরিবার', 'পারিবারিক ও সামাজিক', 'অন্যান্য'];

  useEffect(() => {
    const q = query(collection(db, 'masayel'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMasayel(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleAddMasala = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion || !newAnswer) return;
    try {
      await addDoc(collection(db, 'masayel'), {
        question: newQuestion,
        answer: newAnswer,
        category: newCat,
        createdAt: serverTimestamp()
      });
      setNewQuestion(''); setNewAnswer(''); setShowAddForm(false);
      toast.success('সফল হয়েছে');
    } catch (e) { toast.error('ভুল হয়েছে'); }
  };

  const seedMasayel = async () => {
    if (userRole !== 'admin') return;
    const samples = [
      { category: 'ওযু ও পবিত্রতা', question: 'ওযুর ফরজ কয়টি?', answer: 'ওযুর ফরজ ৪টি। ১. সমস্ত মুখ ধৌত করাঁ। ২. দুই হাত কনুইসহ ধৌত করা। ৩. মাথার এক চতুর্থাংশ মাসেহ করা। ৪. দুই পা টাখনুসহ ধৌত করা।' },
      { category: 'সালাত (নামাজ)', question: 'নামাজের ওয়াজিব কয়টি?', answer: 'নামাজের ওয়াজিব ১৪টি।' },
      { category: 'সালাত (নামাজ)', question: 'বিতর নামাজ কি?', answer: 'বিতর নামাজ পড়া ওয়াজিব।' },
      { category: 'রোজা ও রমজান', question: 'রোজা ভঙ্গের কারণ কি?', answer: 'স্বেচ্ছায় পানাহার করা, স্ত্রী সহবাস ইত্যাদি।' },
    ];
    for (const s of samples) {
      await addDoc(collection(db, 'masayel'), { ...s, createdAt: serverTimestamp() });
    }
    toast.success('নমুনা তথ্য যোগ হয়েছে');
  };

  const filteredMasayel = masayel.filter(m => activeCategory === 'all' || m.category === activeCategory);

  return (
    <div className="space-y-6">
      <ScrollArea className="w-full whitespace-nowrap pb-2">
        <div className="flex gap-2">
          {categories.map(cat => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-xl text-[10px] font-bold ${activeCategory === cat ? 'bg-purple-700' : ''}`}
            >
              {cat === 'all' ? 'সব' : cat}
            </Button>
          ))}
        </div>
      </ScrollArea>

      {userRole === 'admin' && (
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-purple-700 h-12 rounded-xl text-white font-bold">
            {showAddForm ? 'বন্ধ' : 'যোগ'}
          </Button>
          <Button variant="outline" onClick={seedMasayel} className="h-12 border-purple-200 text-purple-700 font-bold rounded-xl">
            নমুনা ডেটা
          </Button>
        </div>
      )}

      {showAddForm && (
        <Card className="p-6 space-y-4">
          <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className="w-full h-11 rounded-xl border p-2 text-sm">
            {categories.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="প্রশ্ন..." />
          <textarea value={newAnswer} onChange={(e) => setNewAnswer(e.target.value)} placeholder="উত্তর..." className="w-full h-24 border rounded-xl p-2 text-sm" />
          <Button onClick={handleAddMasala} className="w-full bg-purple-700 text-white font-bold h-11 rounded-xl">সংরক্ষণ</Button>
        </Card>
      )}

      <div className="space-y-4 pb-12">
        {filteredMasayel.map((m) => (
          <Card key={m.id} className="bg-white border-[#e2e8f0] shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="pb-3 p-6 text-lg font-serif font-bold text-[#1e293b]">{m.question}</CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="p-4 bg-[#f8fafc] rounded-2xl border border-[#f1f5f9] text-sm text-[#475569]">{m.answer}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
