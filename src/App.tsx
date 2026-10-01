import { useState, useEffect } from 'react';
import { EBookReader } from './components/EBookReader';
import { AssignmentForm } from './components/AssignmentForm';
import { AdminDashboard } from './components/AdminDashboard';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { apiService } from './api';
import type { Submission } from './data/cardData';
import { BookOpen, ShieldAlert, HelpCircle } from 'lucide-react';
import { TAEKWANG_LOGO_BASE64 } from './assets/logos';

function App() {
  const [activeTab, setActiveTab] = useState<'learner' | 'admin'>('learner');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showGuide, setShowGuide] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Toast Helper
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = 'toast_' + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  };

  // Fetch Submissions Data
  const fetchData = async () => {
    try {
      const response = await apiService.getSubmissions();
      setSubmissions(response.data);
      setIsOffline(response.isLocalStorageOnly);
    } catch (err) {
      console.error('Failed to load data:', err);
      setIsOffline(true);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen lg:h-screen bg-[#2c2722] text-[#F8FAFC] font-sans flex flex-col lg:overflow-hidden transition-all duration-300">
      
      {/* Global Header (Full Width, Compact & Premium) */}
      <header className="bg-[#36302a] border-b border-[#C5A059]/20 sticky top-0 z-40 shadow-md flex-shrink-0">
        <div className="w-full px-4 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 sm:h-[38px] flex items-center justify-center flex-shrink-0">
              <img src={TAEKWANG_LOGO_BASE64} alt="태광그룹" className="h-full w-auto object-contain" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-bold text-base sm:text-lg text-[#C5A059] tracking-wide leading-tight">
                  창업주 경영철학 선행학습 플랫폼
                </h1>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 font-medium line-clamp-1">
                태광그룹 경영철학 및 핵심가치 내재화 과정 | Pre-Learning Portal
              </p>
            </div>
          </div>

          {/* Navigation & Controls */}
          <div className="flex items-center gap-3 justify-end">
            <nav className="flex items-center bg-[#2c2722] p-1 rounded-xl border border-[#C5A059]/15 shadow-inner">
              <button
                onClick={() => setActiveTab('learner')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  activeTab === 'learner'
                    ? 'bg-[#C5A059] text-[#2c2722] shadow'
                    : 'text-gray-400 hover:text-white hover:bg-[#36302a]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>📖 학습자 화면</span>
              </button>
              <button
                onClick={() => {
                  if (activeTab === 'admin') return;
                  if (!isAdminAuthenticated) {
                    const pwd = window.prompt('관리자 비밀번호를 입력해주세요:');
                    if (pwd === 'hrd1905') {
                      setIsAdminAuthenticated(true);
                      setActiveTab('admin');
                    } else if (pwd !== null) {
                      alert('비밀번호가 일치하지 않습니다.');
                    }
                  } else {
                    setActiveTab('admin');
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 relative ${
                  activeTab === 'admin'
                    ? 'bg-[#C5A059] text-[#2c2722] shadow'
                    : 'text-gray-400 hover:text-white hover:bg-[#36302a]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>🛡️ 관리자 모니터링</span>
                {submissions.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-500 font-mono text-[9px] font-bold text-white ring-1 ring-[#2c2722] animate-pulse">
                    {submissions.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area (Full Width, Viewport Fit) */}
      <main className="flex-1 min-h-0 w-full px-3 sm:px-4 lg:px-6 py-3 flex flex-col">
        
        {/* Learner View: 2-Column Full Screen Bento Layout */}
        {activeTab === 'learner' && (
          <div className="flex-1 min-h-0 flex flex-col gap-2.5 animate-fade-in">
            
            {/* Slim Smart Guide Strip */}
            {showGuide && (
              <div className="bg-[#463f37]/95 border border-[#C5A059]/30 rounded-xl px-4 sm:px-5 py-2.5 text-left flex items-center justify-between gap-3 shadow-lg glass-panel flex-shrink-0 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg sm:text-xl flex-shrink-0 select-none">💡</span>
                  <div className="text-sm sm:text-[14.5px] text-gray-200 leading-relaxed font-sans">
                    <strong className="text-[#C5A059] font-serif font-bold text-sm sm:text-base mr-2">[선행학습 가이드]</strong>
                    좌측 <strong className="text-white font-medium">E-Book은 요약 내용</strong>입니다. 배포된 <strong className="text-amber-200 font-semibold">&quot;나무는 숲과함께 자라야한다&quot;</strong>를 정독한 후, 우측 <strong className="text-white font-medium">성찰과제 카드(1~5형)</strong>를 선택하여 성찰문을 작성 및 제출해 주십시오.
                  </div>
                </div>
                <button
                  onClick={() => setShowGuide(false)}
                  className="text-gray-400 hover:text-gray-200 text-sm px-2 py-1 rounded hover:bg-[#2c2722]/60 flex-shrink-0 transition-colors"
                  title="가이드 접기"
                >
                  ✕
                </button>
              </div>
            )}

            {!showGuide && (
              <div className="flex justify-end flex-shrink-0">
                <button
                  onClick={() => setShowGuide(true)}
                  className="text-[11px] text-[#C5A059] hover:underline flex items-center gap-1 py-0.5 px-2 bg-[#463f37]/60 rounded-md border border-[#C5A059]/20"
                >
                  <HelpCircle className="w-3 h-3" /> 학습 가이드 보기
                </button>
              </div>
            )}

            {/* Left & Right Full-Height Board Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-5 items-stretch flex-1 min-h-0 w-full">
              
              {/* Left Board: E-Book Reader */}
              <div className="h-[620px] lg:h-full min-h-0 flex flex-col">
                <EBookReader />
              </div>

              {/* Right Board: Assignment Form */}
              <div className="h-[620px] lg:h-full min-h-0 flex flex-col">
                <AssignmentForm onSubmissionSuccess={fetchData} addToast={addToast} />
              </div>

            </div>
          </div>
        )}

        {/* Admin View: Full Width Scrollable Dashboard */}
        {activeTab === 'admin' && (
          <div className="flex-1 min-h-0 overflow-y-auto animate-fade-in pr-1">
            <AdminDashboard
              submissions={submissions}
              isOffline={isOffline}
              refreshData={fetchData}
              addToast={addToast}
            />
          </div>
        )}

      </main>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} setToasts={setToasts} />

      {/* Slim Global Footer */}
      <footer className="bg-[#2c2722] border-t border-[#36302a] py-1.5 px-4 text-center text-[10px] text-gray-500 font-mono flex-shrink-0 flex items-center justify-between">
        <span className="text-left">&copy; 2026 TAEKWANG GROUP. All Rights Reserved.</span>
        <span className="hidden sm:inline">창업주 경영철학 선행학습 시스템 v1.1</span>
      </footer>

    </div>
  );
}

export default App;
