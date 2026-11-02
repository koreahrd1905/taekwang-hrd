import React, { useState, useEffect } from 'react';
import { X, GitBranch, Key, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface GitHubConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const GitHubConfigModal: React.FC<GitHubConfigModalProps> = ({
  isOpen,
  onClose,
  addToast
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{
    isConfigured: boolean;
    repo: string;
    filePath: string;
    tokenMasked: string;
  } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/github/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setTokenInput('');
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      addToast('error', 'GitHub Personal Access Token을 입력해 주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/github/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubToken: tokenInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');

      addToast('success', 'GitHub 실시간 자동 저장(Push) 설정이 완료되었습니다!');
      fetchStatus();
      setTokenInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.';
      addToast('error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#36302a] border border-[#C5A059]/40 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden text-left">
        
        {/* Header */}
        <div className="bg-[#2c2722] px-5 py-4 border-b border-[#C5A059]/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#C5A059]/20 rounded-lg text-[#C5A059]">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#C5A059]">GitHub 실시간 자동 저장(Push) 설정</h3>
              <p className="text-[11px] text-gray-400">과제 제출 시 GitHub 저장소에 실시간으로 커밋 및 보존합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#463f37] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          
          {/* Current Status Box */}
          <div className="bg-[#2c2722] border border-[#C5A059]/20 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 font-medium">연동 상태:</span>
              {status?.isConfigured ? (
                <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 실시간 자동 Push 활성화됨
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                  <AlertTriangle className="w-3.5 h-3.5" /> 토큰 미등록 (비활성)
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400">저장소 대상:</span>
              <span className="text-gray-200 font-mono font-medium">{status?.repo || 'koreahrd1905/taekwang-hrd'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400">저장 대상 파일:</span>
              <span className="text-gray-200 font-mono font-medium">{status?.filePath || 'server/data/submissions.json'}</span>
            </div>
            {status?.isConfigured && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-400">현재 등록 토큰:</span>
                <span className="text-gray-300 font-mono font-medium">{status.tokenMasked}</span>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-gray-300 font-semibold mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#C5A059]" /> GitHub Personal Access Token (PAT)
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="ghp_... 형식의 토큰을 입력하세요"
                className="w-full bg-[#2c2722] border border-gray-700 focus:border-[#C5A059] rounded-lg px-3 py-2 text-white font-mono placeholder-gray-500 text-xs focus:outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                * GitHub ➔ [Settings] ➔ [Developer Settings] ➔ [Personal access tokens]에서 <code className="text-[#C5A059]">repo</code> 권한이 포함된 토큰을 생성하여 입력해 주세요.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg bg-[#2c2722] hover:bg-[#463f37] text-gray-300 font-semibold transition-colors"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-1.5 rounded-lg bg-[#C5A059] hover:bg-[#b08d48] text-[#2c2722] font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>설정 저장하기</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};
