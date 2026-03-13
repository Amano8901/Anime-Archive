import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Folder, 
  Calendar, 
  Star, 
  ExternalLink, 
  Play, 
  Info,
  ChevronRight,
  Database,
  Archive,
  Menu,
  X,
  FileVideo,
  ArrowLeft,
  Download,
  Loader2,
  ArrowUp,
  CheckCircle2,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Check,
  Square,
  Pause,
  SkipForward,
  SkipBack,
  Tv,
  Settings,
  Subtitles,
  Languages,
  Plus
} from "lucide-react";
import { ANIME_DATA } from "./constants";
import { AnimeSeries } from "./types";

interface DirectoryItem {
  name: string;
  url: string;
  isDirectory: boolean;
}

interface DownloadTask {
  id: string;
  name: string;
  progress: number;
  controller: AbortController;
}

const isVideoFile = (name: string) => {
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.webm', '.mov'];
  return videoExtensions.some(ext => name.toLowerCase().endsWith(ext));
};

const VideoPreview = ({ url }: { url: string }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 10; // Try to skip intro
    }
  }, []);

  return (
    <div className="relative w-12 h-12 bg-black rounded-lg overflow-hidden flex items-center justify-center border border-white/10 shadow-inner">
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <Loader2 className="w-4 h-4 animate-spin text-netflix-red" />
        </div>
      )}
      {error ? (
        <FileVideo className="w-5 h-5 text-neutral-700" />
      ) : (
        <video
          ref={videoRef}
          src={url}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}
          onLoadedData={() => setLoading(false)}
          onError={() => setError(true)}
          muted
          playsInline
          preload="metadata"
        />
      )}
    </div>
  );
};

const VideoPlayer = ({ url: initialUrl, title, seriesTitle, onClose, explorerItems, onDownload }: { url: string, title: string, seriesTitle?: string, onClose: () => void, explorerItems?: DirectoryItem[], onDownload?: (url: string, name: string) => void }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");
  const [currentQuality, setCurrentQuality] = useState('Original');
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
  const [confirmDownload, setConfirmDownload] = useState<{ isOpen: boolean, onConfirm: () => void, title: string, message: string }>({
    isOpen: false,
    onConfirm: () => {},
    title: '',
    message: ''
  });
  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSettings) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          skip(10);
          break;
        case 'ArrowLeft':
          skip(-10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => Math.min(1, prev + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => Math.max(0, prev - 0.1));
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'KeyM':
          toggleMute();
          break;
      }
      handleMouseMove();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, showSettings]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  const subtitles = useMemo(() => {
    return explorerItems?.filter(item => !item.isDirectory && (item.name.endsWith('.vtt') || item.name.endsWith('.srt'))) || [];
  }, [explorerItems]);

  const qualities = useMemo(() => {
    const available = ['Original'];
    if (explorerItems) {
      if (explorerItems.some(i => i.name.toLowerCase().includes('1080p'))) available.push('1080p');
      if (explorerItems.some(i => i.name.toLowerCase().includes('720p'))) available.push('720p');
      if (explorerItems.some(i => i.name.toLowerCase().includes('480p'))) available.push('480p');
    }
    return available;
  }, [explorerItems]);

  const changeQuality = (quality: string) => {
    if (quality === currentQuality) return;
    
    let newUrl = initialUrl;
    if (quality !== 'Original' && explorerItems) {
      const match = explorerItems.find(i => !i.isDirectory && i.name.toLowerCase().includes(quality.toLowerCase()));
      if (match) newUrl = match.url;
    }

    const currentTimeVal = videoRef.current?.currentTime || 0;
    setUrl(newUrl);
    setCurrentQuality(quality);
    
    // Resume playback at same time
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTimeVal;
        if (isPlaying) videoRef.current.play();
      }
    }, 100);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleProgress = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      setProgress((current / dur) * 100);
      setCurrentTime(formatTime(current));
      if (!isNaN(dur)) setDuration(formatTime(dur));
    }
  };

  const downloadCurrent = () => {
    setConfirmDownload({
      isOpen: true,
      title: 'Confirm Download',
      message: `Are you sure you want to download "${title}"?`,
      onConfirm: () => {
        if (onDownload) {
          onDownload(url, title);
        } else {
          const link = document.createElement('a');
          link.href = url;
          link.download = title;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        setConfirmDownload(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const time = (Number(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = time;
      setProgress(Number(e.target.value));
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('video-container');
    if (container) {
      if (!document.fullscreenElement) {
        container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
      onClick={handleMouseMove}
      id="video-container"
    >
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full max-h-screen object-contain"
        onTimeUpdate={handleProgress}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
        playsInline
      >
        {selectedSubtitle && (
          <track 
            src={selectedSubtitle} 
            kind="subtitles" 
            srcLang="en" 
            label="English" 
            default 
          />
        )}
      </video>

      {/* Top Bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <button 
                onClick={downloadCurrent}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white active:scale-90"
                title="Download Episode"
              >
                <Download className="w-6 h-6" />
              </button>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white active:scale-90"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
                <div className="flex flex-col">
                  {seriesTitle && <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold leading-none mb-1">{seriesTitle}</span>}
                  <h3 className="text-lg font-bold text-white truncate max-w-md leading-none">{title}</h3>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-4"
          >
            {/* Progress Bar */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                <span>{currentTime}</span>
                <span>{duration}</span>
              </div>
              <div className="group relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={seek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div 
                  className="absolute top-0 left-0 h-full bg-netflix-red rounded-full"
                  style={{ width: `${progress}%` }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${progress}%`, marginLeft: '-8px' }}
                />
              </div>
            </div>

              <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button onClick={togglePlay} className="text-white hover:text-netflix-red transition-colors active:scale-90">
                  {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
                </button>
                <div className="flex items-center gap-4">
                  <button onClick={() => skip(-10)} className="text-white/70 hover:text-white transition-colors active:scale-90">
                    <RotateCcw className="w-6 h-6" />
                  </button>
                  <button onClick={() => skip(10)} className="text-white/70 hover:text-white transition-colors active:scale-90">
                    <RotateCw className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex items-center gap-3 group">
                  <button onClick={toggleMute} className="text-white hover:text-netflix-red transition-colors active:scale-90">
                    {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVolume(v);
                      if (videoRef.current) videoRef.current.volume = v;
                      setIsMuted(v === 0);
                    }}
                    className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-netflix-red"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`text-white hover:text-netflix-red transition-colors active:scale-90 ${showSettings ? 'text-netflix-red' : ''}`}
                >
                  <Settings className="w-6 h-6" />
                </button>
                
                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full right-0 mb-4 w-64 bg-black border border-white/10 rounded-2xl p-4 shadow-2xl z-50"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                            <Tv className="w-3 h-3" /> Quality
                          </div>
                          <div className="flex flex-col gap-1">
                            {qualities.map(q => (
                              <button 
                                key={q} 
                                onClick={() => changeQuality(q)}
                                className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${q === currentQuality ? 'bg-netflix-red text-white' : 'text-neutral-400 hover:bg-white/5'}`}
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                            <Subtitles className="w-3 h-3" /> Subtitles
                          </div>
                          <div className="flex flex-col gap-1">
                            <button 
                              onClick={() => setSelectedSubtitle(null)}
                              className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${!selectedSubtitle ? 'bg-netflix-red text-white' : 'text-neutral-400 hover:bg-white/5'}`}
                            >
                              None
                            </button>
                            {subtitles.map(sub => (
                              <button 
                                key={sub.url} 
                                onClick={() => setSelectedSubtitle(sub.url)}
                                className={`text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${selectedSubtitle === sub.url ? 'bg-netflix-red text-white' : 'text-neutral-400 hover:bg-white/5'}`}
                              >
                                {sub.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                            <Languages className="w-3 h-3" /> Audio
                          </div>
                          <div className="flex flex-col gap-1">
                            <button className="text-left px-3 py-2 rounded-lg text-xs bg-netflix-red text-white">Default</button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button onClick={toggleFullscreen} className="text-white hover:text-netflix-red transition-colors active:scale-90">
                  {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDownload.isOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-2">{confirmDownload.title}</h3>
              <p className="text-neutral-400 mb-8 leading-relaxed">{confirmDownload.message}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDownload(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 px-6 rounded-xl bg-neutral-800 text-white font-bold hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDownload.onConfirm}
                  className="flex-1 py-3 px-6 rounded-xl bg-netflix-red text-white font-bold hover:bg-netflix-red/80 transition-colors"
                >
                  Download
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // File Explorer State
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [explorerItems, setExplorerItems] = useState<DirectoryItem[]>([]);
  const [isLoadingExplorer, setIsLoadingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<AnimeSeries | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hoveredFileUrl, setHoveredFileUrl] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{ url: string, title: string, seriesTitle?: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [activeDownloads, setActiveDownloads] = useState<DownloadTask[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, onConfirm: () => void, title: string, message: string }>({
    isOpen: false,
    onConfirm: () => {},
    title: '',
    message: ''
  });

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleFileSelection = (url: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(url)) {
      newSelection.delete(url);
    } else {
      newSelection.add(url);
    }
    setSelectedFiles(newSelection);
    if (newSelection.size === 0) setIsSelectionMode(false);
  };

  const startDownload = async (url: string, name: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const controller = new AbortController();
    
    const newTask: DownloadTask = { id, name, progress: 0, controller };
    setActiveDownloads(prev => [...prev, newTask]);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Network response was not ok');
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported');

      const chunks = [];
      while(true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total) {
          const progress = Math.round((loaded / total) * 100);
          setActiveDownloads(prev => prev.map(t => t.id === id ? { ...t, progress } : t));
        }
      }

      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      setActiveDownloads(prev => prev.filter(t => t.id !== id));
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Download cancelled');
      } else {
        console.error('Download failed:', error);
      }
      setActiveDownloads(prev => prev.filter(t => t.id !== id));
    }
  };

  const cancelDownload = (id: string) => {
    const task = activeDownloads.find(t => t.id === id);
    if (task) {
      task.controller.abort();
      setActiveDownloads(prev => prev.filter(t => t.id !== id));
    }
  };

  const downloadFile = (url: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Download',
      message: `Are you sure you want to download "${name}"?`,
      onConfirm: () => {
        startDownload(url, name);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const downloadSelected = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Multiple Downloads',
      message: `Are you sure you want to download ${selectedFiles.size} selected files?`,
      onConfirm: () => {
        selectedFiles.forEach(url => {
          const item = explorerItems.find(i => i.url === url);
          if (item) {
            startDownload(item.url, item.name);
          }
        });
        setSelectedFiles(new Set());
        setIsSelectionMode(false);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    try {
      const url = new URL(currentPath);
      const host = url.hostname;
      const parts = url.pathname.split('/').filter(Boolean);
      let cumulativePath = url.origin;
      
      const crumbs = [{ name: host, url: url.origin + '/' }];
      
      parts.forEach((part) => {
        cumulativePath += '/' + part;
        crumbs.push({
          name: decodeURIComponent(part),
          url: cumulativePath + '/'
        });
      });
      
      return crumbs;
    } catch (e) {
      return [{ name: currentPath, url: currentPath }];
    }
  }, [currentPath]);

  const watchDailyPilot = async () => {
    // Seed random with date for "of the day" feel
    const today = new Date();
    const dateString = `${today.getFullYear()}${today.getMonth()}${today.getDate()}`;
    const seed = parseInt(dateString);
    
    // Simple seeded random
    const getSeededRandom = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    let attempts = 0;
    let found = false;
    
    while (attempts < 5 && !found) {
      const randomIndex = Math.floor(getSeededRandom(seed + attempts) * ANIME_DATA.length);
      const anime = ANIME_DATA[randomIndex];

      setIsLoadingExplorer(true);
      try {
        const response = await fetch(`/api/proxy-dir?url=${encodeURIComponent(anime.url)}`);
        const data = await response.json();
        if (data.items) {
          const firstVideo = data.items.find((item: DirectoryItem) => !item.isDirectory && isVideoFile(item.name));
          if (firstVideo) {
            setPlayingVideo({ url: firstVideo.url, title: "Daily Pilot", seriesTitle: anime.title });
            found = true;
          }
        }
      } catch (error) {
        console.error("Error fetching daily pilot:", error);
      }
      attempts++;
    }
    setIsLoadingExplorer(false);
  };

  const genres = useMemo(() => {
    const allGenres = ANIME_DATA.flatMap(a => a.genre || []);
    return Array.from(new Set(allGenres)).sort();
  }, []);

  const filteredAnime = useMemo(() => {
    return ANIME_DATA.filter(anime => {
      const matchesSearch = anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          anime.folderName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGenre = !selectedGenre || (anime.genre && anime.genre.includes(selectedGenre));
      return matchesSearch && matchesGenre;
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [searchQuery, selectedGenre]);

  const alphabetIndex = useMemo(() => {
    const letters = filteredAnime.map(a => a.title[0].toUpperCase());
    return Array.from(new Set(letters)).sort();
  }, [filteredAnime]);

  const scrollToLetter = (letter: string) => {
    const element = document.getElementById(`letter-${letter}`);
    if (element) {
      const offset = 100; // Account for sticky nav
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  const openExplorer = (anime: AnimeSeries) => {
    setSelectedAnime(anime);
    setExplorerOpen(true);
    fetchDirectory(anime.url);
    setHistory([]);
  };

  const fetchDirectory = async (url: string) => {
    setIsLoadingExplorer(true);
    setExplorerError(null);
    try {
      const response = await fetch(`/api/proxy-dir?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (response.ok && data.items) {
        setExplorerItems(data.items);
        setCurrentPath(url);
      } else {
        setExplorerError(data.error || "Failed to load directory content");
      }
    } catch (error: any) {
      console.error("Error fetching directory:", error);
      setExplorerError("Network error or server is unreachable");
    } finally {
      setIsLoadingExplorer(false);
    }
  };

  const navigateTo = (url: string) => {
    if (currentPath) {
      setHistory([...history, currentPath]);
    }
    fetchDirectory(url);
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(history.slice(0, -1));
      fetchDirectory(prev);
    } else {
      setExplorerOpen(false);
      setSelectedAnime(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-200 font-sans selection:bg-[#E50914]/30 selection:text-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 px-6 md:px-12 py-4 flex items-center justify-between ${isScrolled ? 'bg-black shadow-2xl' : 'bg-gradient-to-b from-black/80 to-transparent'}`}>
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={scrollToTop}>
            <Archive className="text-[#E50914] w-8 h-8 transition-transform group-hover:scale-110" />
            <div className="hidden sm:block">
              <h1 className="text-2xl font-black tracking-tighter text-[#E50914] uppercase leading-none">Kanzaki</h1>
              <p className="text-[8px] uppercase tracking-[0.3em] text-white/50 font-bold">Archive</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-300">
            <a href="#" className="hover:text-white transition-colors">Home</a>
            <a href="#" className="hover:text-white transition-colors">TV Shows</a>
            <a href="#" className="hover:text-white transition-colors">Movies</a>
            <a href="#" className="hover:text-white transition-colors">New & Popular</a>
            <a href="#" className="hover:text-white transition-colors">My List</a>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center bg-black/40 border border-white/20 rounded-sm px-3 py-1.5 focus-within:border-white transition-all">
            <Search className="w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Titles, people, genres"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-sm text-white focus:outline-none w-48 ml-2 placeholder:text-neutral-500"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsConnected(!isConnected)}
              className={`${isConnected ? 'text-green-500' : 'text-white'} hover:opacity-80 transition-all active:scale-95 flex items-center gap-2`}
            >
              {isConnected ? <CheckCircle2 className="w-5 h-5" /> : <Database className="w-5 h-5" />}
            </button>
            <div className="w-8 h-8 bg-[#E50914] rounded-sm flex items-center justify-center text-white font-bold text-xs">
              G
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-neutral-400 hover:text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black/95 pt-24 px-6 md:hidden overflow-y-auto custom-scrollbar"
          >
            <div className="flex flex-col gap-6">
              <input 
                type="text" 
                placeholder="Search archive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-xl py-4 px-6 w-full focus:outline-none focus:border-netflix-red transition-all"
              />
              <div className="flex flex-col gap-4 text-xl font-medium">
                <a href="#" onClick={() => setIsMenuOpen(false)}>Browse</a>
                <a href="#" onClick={() => setIsMenuOpen(false)}>Recent</a>
                <a href="#" onClick={() => setIsMenuOpen(false)}>Stats</a>
              </div>
              <button className="bg-netflix-red text-white py-4 rounded-xl font-bold">
                Connect Server
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10">
        {/* Billboard (Hero Section) */}
        <section className="relative h-[85vh] w-full overflow-hidden mb-12">
          <div className="absolute inset-0">
            <img 
              src="https://picsum.photos/seed/anime-epic/1920/1080" 
              alt="Featured" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 billboard-gradient" />
          </div>

          <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-12 max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-[#E50914] rounded-sm flex items-center justify-center text-[10px] font-bold">N</div>
                <span className="text-xs font-bold tracking-[0.3em] text-neutral-300 uppercase">Archive Original</span>
              </div>
              <h2 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-6 leading-none uppercase">
                KANZAKI <br />
                <span className="text-[#E50914]">CHRONICLES</span>
              </h2>
              <p className="text-lg text-white font-medium drop-shadow-lg mb-8 leading-relaxed max-w-xl">
                In a world where media is fragmented, one archive stands to unite them all. 
                Experience the ultimate collection of indexed series and movies.
              </p>
              <div className="flex items-center gap-4">
                <button 
                  onClick={watchDailyPilot}
                  className="flex items-center gap-3 bg-white text-black px-8 py-3 rounded-md font-bold hover:bg-white/80 transition-all active:scale-95 text-lg"
                >
                  <Play className="w-6 h-6 fill-current" />
                  Play
                </button>
                <button 
                  className="flex items-center gap-3 bg-neutral-500/50 text-white px-8 py-3 rounded-md font-bold hover:bg-neutral-500/40 transition-all active:scale-95 text-lg backdrop-blur-md"
                >
                  <Info className="w-6 h-6" />
                  More Info
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        <div className="px-6 md:px-12 -mt-32 relative z-20">
          {/* Filters */}
          <section className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              <button 
                onClick={() => setSelectedGenre(null)}
                className={`px-4 py-2 rounded-sm text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap active:scale-95 ${
                  !selectedGenre 
                    ? "bg-white text-black" 
                    : "bg-black/40 border border-white/20 text-neutral-400 hover:text-white"
                }`}
              >
                All Series
              </button>
              {genres.map(genre => (
                <button 
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-4 py-2 rounded-sm text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap active:scale-95 ${
                    selectedGenre === genre 
                      ? "bg-white text-black" 
                      : "bg-black/40 border border-white/20 text-neutral-400 hover:text-white"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              <span className="text-white">{filteredAnime.length}</span> titles available
            </div>
          </section>

          {/* Anime Grid Section */}
          <section className="mb-20">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Popular on Kanzaki</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredAnime.map((anime, index) => (
                <motion.div
                  key={anime.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => openExplorer(anime)}
                  className="group cursor-pointer"
                >
                  <div className="netflix-card relative bg-neutral-900 rounded-md overflow-hidden shadow-lg mb-2">
                    <div className="aspect-[2/3] relative overflow-hidden">
                      <img 
                        src={`https://picsum.photos/seed/${anime.imageSeed}/600/800`} 
                        alt={anime.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 netflix-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      <div className="absolute inset-0 p-4 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black">
                            <Play className="w-4 h-4 fill-current" />
                          </div>
                          <div className="w-8 h-8 rounded-full border border-white/50 flex items-center justify-center text-white">
                            <Plus className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[8px] font-bold text-green-500">
                          <span>98% Match</span>
                          <span className="px-1 border border-white/30 text-white rounded-[2px] text-[6px]">HD</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-neutral-400 group-hover:text-white transition-colors truncate px-1">{anime.title}</h4>
                </motion.div>
              ))}
            </div>
          </section>
        </div>

        {/* Empty State */}
        {filteredAnime.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-32 text-center"
          >
            <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-8 h-8 text-neutral-700" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No entries found</h3>
            <p className="text-neutral-500">Try adjusting your search or filter to find what you're looking for.</p>
            <button 
              onClick={() => {setSearchQuery(""); setSelectedGenre(null);}}
              className="mt-6 text-netflix-red font-bold hover:underline"
            >
              Clear all filters
            </button>
          </motion.div>
        )}
      </main>

      {/* File Explorer Modal */}
      <AnimatePresence>
        {explorerOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExplorerOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl h-[80vh] bg-black border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Explorer Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-neutral-900/50">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={goBack}
                    className="p-3 hover:bg-white/5 rounded-full transition-colors text-neutral-400 hover:text-white active:scale-90"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div className="flex items-center gap-4 min-w-0">
                    {selectedAnime && (
                      <div className="hidden sm:block w-12 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0">
                        <img 
                          src={`https://picsum.photos/seed/${selectedAnime.imageSeed}/100/150`} 
                          alt="" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-netflix-red">Browsing Series</span>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>
                      <h3 className="text-2xl font-black text-white leading-tight truncate tracking-tighter uppercase">
                        {selectedAnime?.title}
                      </h3>
                      <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-bold uppercase tracking-widest overflow-x-auto no-scrollbar whitespace-nowrap mt-1">
                        {breadcrumbs.map((crumb, idx) => (
                          <React.Fragment key={crumb.url}>
                            <button 
                              onClick={() => fetchDirectory(crumb.url)}
                              className="hover:text-white transition-colors py-1 active:scale-95"
                            >
                              {crumb.name}
                            </button>
                            {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 shrink-0 opacity-30" />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSelectionMode && selectedFiles.size > 0 && (
                    <button 
                      onClick={downloadSelected}
                      className="flex items-center gap-2 bg-[#E50914] text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-widest hover:bg-[#b20710] transition-all active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      Download ({selectedFiles.size})
                    </button>
                  )}
                  {explorerItems.some(i => !i.isDirectory) && (
                    <button 
                      onClick={() => {
                        setIsSelectionMode(!isSelectionMode);
                        if (isSelectionMode) setSelectedFiles(new Set());
                      }}
                      className={`px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-widest transition-all ${
                        isSelectionMode ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {isSelectionMode ? 'Cancel' : 'Select'}
                    </button>
                  )}
                  <button 
                    onClick={() => setExplorerOpen(false)}
                    className="p-3 hover:bg-white/5 rounded-full transition-colors text-neutral-400 hover:text-white active:scale-90"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Explorer Content */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isLoadingExplorer ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 text-neutral-500">
                    <Loader2 className="w-8 h-8 animate-spin text-netflix-red" />
                    <p className="text-sm font-medium animate-pulse">Fetching directory listing...</p>
                  </div>
                ) : explorerError ? (
                  <div className="h-full flex flex-col items-center justify-center gap-6 text-center px-4 py-12">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
                      <Archive className="w-10 h-10 text-red-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-white">Oops! Something went wrong</h3>
                      <p className="text-neutral-400 max-w-xs mx-auto">{explorerError}</p>
                    </div>
                    <button 
                      onClick={() => currentPath && fetchDirectory(currentPath)}
                      className="px-6 py-2 bg-netflix-red hover:bg-netflix-red/80 text-white rounded-full font-medium transition-all active:scale-95 flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Try Again
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {explorerItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                        <Database className="w-12 h-12 mb-4 opacity-20" />
                        <p>This directory is empty</p>
                      </div>
                    ) : (
                      explorerItems.map((item, idx) => (
                        <motion.div 
                          key={item.url}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className={`group flex items-center justify-between p-3 md:p-4 rounded-2xl transition-all cursor-pointer border ${
                            selectedFiles.has(item.url) 
                              ? 'bg-netflix-red/10 border-netflix-red/50' 
                              : 'hover:bg-white/5 border-transparent hover:border-white/5'
                          }`}
                          onMouseEnter={() => !item.isDirectory && isVideoFile(item.name) && setHoveredFileUrl(item.url)}
                          onMouseLeave={() => setHoveredFileUrl(null)}
                          onClick={() => {
                            if (isSelectionMode && !item.isDirectory) {
                              toggleFileSelection(item.url);
                            } else {
                              item.isDirectory ? navigateTo(item.url) : window.open(item.url, '_blank');
                            }
                          }}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            {isSelectionMode && !item.isDirectory && (
                              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                selectedFiles.has(item.url) ? 'bg-netflix-red border-netflix-red' : 'border-neutral-700'
                              }`}>
                                {selectedFiles.has(item.url) && <Check className="w-4 h-4 text-white" />}
                              </div>
                            )}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.isDirectory ? 'bg-netflix-red/10 text-netflix-red' : 'bg-blue-500/10 text-blue-500'}`}>
                              {item.isDirectory ? (
                                <Folder className="w-6 h-6" />
                              ) : (
                                hoveredFileUrl === item.url ? (
                                  <VideoPreview url={item.url} />
                                ) : (
                                  <FileVideo className="w-6 h-6" />
                                )
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm md:text-base font-medium text-neutral-200 group-hover:text-white transition-colors truncate pr-4">
                                {item.name}
                              </p>
                              <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
                                {item.isDirectory ? 'Directory' : 'Media File'}
                              </p>
                            </div>
                          </div>
                          <div className={`flex items-center gap-2 transition-opacity ${isSelectionMode ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}>
                            {item.isDirectory ? (
                              <ChevronRight className="w-6 h-6 text-neutral-500" />
                            ) : (
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadFile(item.url, item.name);
                                  }}
                                  className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-white transition-colors active:scale-90"
                                >
                                  <Download className="w-5 h-5" />
                                </button>
                                {isVideoFile(item.name) && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPlayingVideo({ url: item.url, title: item.name, seriesTitle: selectedAnime?.title });
                                    }}
                                    className="p-3 bg-netflix-red hover:bg-netflix-red/80 rounded-xl text-white transition-colors active:scale-90"
                                  >
                                    <Play className="w-5 h-5 fill-current" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Explorer Footer */}
              <div className="p-4 border-t border-white/5 bg-neutral-900/30 flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-neutral-600">
                <div className="flex items-center gap-4">
                  <span>Items: {explorerItems.length}</span>
                  <span>History: {history.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Server Connected</span>
                </div>
              </div>

              {/* Bulk Download Bar */}
              <AnimatePresence>
                {selectedFiles.size > 0 && (
                  <motion.div 
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                    className="absolute bottom-6 left-6 right-6 p-4 bg-netflix-red rounded-2xl flex items-center justify-between shadow-2xl z-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold leading-none">{selectedFiles.size} items selected</p>
                        <p className="text-white/70 text-xs">Ready for bulk download</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSelectedFiles(new Set())}
                        className="px-4 py-2 text-white/80 hover:text-white font-bold text-sm"
                      >
                        Deselect
                      </button>
                      <button 
                        onClick={downloadSelected}
                        className="bg-white text-netflix-red px-6 py-2 rounded-xl font-bold text-sm hover:bg-neutral-100 transition-colors flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download All
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Player Overlay */}
      <AnimatePresence>
        {playingVideo && (
          <VideoPlayer 
            url={playingVideo.url} 
            title={playingVideo.title} 
            seriesTitle={playingVideo.seriesTitle}
            onClose={() => setPlayingVideo(null)} 
            explorerItems={explorerItems}
            onDownload={startDownload}
          />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/40 py-12 px-6 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3 opacity-50 grayscale">
            <Archive className="text-white w-6 h-6" />
            <div>
              <h1 className="text-lg font-bold tracking-tighter text-white uppercase">Kanzaki</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">Media Storage</p>
            </div>
          </div>
          
          <div className="flex gap-8 text-sm font-medium text-neutral-500">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">API</a>
            <a href="#" className="hover:text-white transition-colors">Status</a>
          </div>

          <div className="text-xs text-neutral-600 font-mono">
            NODE_ID: KANZAKI_STORAGE_01 // LATENCY: 24MS
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-white/5 text-center text-[10px] uppercase tracking-widest text-neutral-700 font-bold">
          &copy; 2026 Kanzaki Archive. All rights reserved. Content served from storage.kanzaki.ru
        </div>
      </footer>

      {/* Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-[60] w-12 h-12 bg-netflix-red text-white rounded-full flex items-center justify-center shadow-2xl shadow-red-900/40 hover:bg-white hover:text-netflix-red transition-all border border-red-500/20 group"
          >
            <ArrowUp className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>
      {/* Download Manager */}
      <div className="fixed bottom-6 right-6 z-[400] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {activeDownloads.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="bg-neutral-900 border border-white/10 p-4 rounded-2xl shadow-2xl w-80 pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-medium text-white truncate pr-2">
                    {task.name}
                  </p>
                </div>
                <button
                  onClick={() => cancelDownload(task.id)}
                  className="p-2 hover:bg-white/5 rounded-lg text-neutral-500 hover:text-red-500 transition-colors"
                  title="Cancel Download"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-netflix-red"
                    initial={{ width: 0 }}
                    animate={{ width: `${task.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  <span>{task.progress}% Complete</span>
                  <span className="animate-pulse">Downloading...</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Global Confirmation Dialog */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-2">{confirmDialog.title}</h3>
              <p className="text-neutral-400 mb-8 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 px-6 rounded-xl bg-neutral-800 text-white font-bold hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDialog.onConfirm}
                  className="flex-1 py-3 px-6 rounded-xl bg-netflix-red text-white font-bold hover:bg-netflix-red/80 transition-colors"
                >
                  Download
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
