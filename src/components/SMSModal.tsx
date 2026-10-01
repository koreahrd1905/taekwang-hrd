import React, { useState, useEffect, useMemo } from 'react';
import type { Submission } from '../data/cardData';
import { apiService } from '../api';
import { 
  X, 
  Send, 
  Users, 
  Phone, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Loader2,
  ShieldCheck,
  CheckSquare,
  Square,
  Settings,
  Key,
  Lock
} from 'lucide-react';

interface SMSModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: Submission[];
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const SMSModal: React.FC<SMSModalProps> = ({
  isOpen,
  onClose,
  submissions,
  addToast
}) => {
  const [sendMode, setSendMode] = useState<'ALL' | 'SELECT'>('ALL');
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [messageText, setMessageText] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState<{
    isConfigured: boolean;
    senderPhone: string;
    apiKeyMasked: string;
  } | null>(null);

  // Solapi Configuration Form State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiSecretInput, setApiSecretInput] = useState('');
  const [senderPhoneInput, setSenderPhoneInput] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Save Config Handler
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim() || !apiSecretInput.trim() || !senderPhoneInput.trim()) {
      addToast('error', 'API Key, Secret, 발신번호를 모두 입력해 주세요.');
      return;
    }
    setIsSavingConfig(true);
    try {
      const res = await apiService.saveSMSConfig({
        apiKey: apiKeyInput.trim(),
        apiSecret: apiSecretInput.trim(),
        senderPhone: senderPhoneInput.trim()
      });
      if (res.success && res.status) {
        setSmsStatus(res.status);
        setIsConfigOpen(false);
        addToast('success', 'Solapi 운영 모드가 성공적으로 활성화되었습니다!');
      } else {
        addToast('error', res.error || '설정 저장에 실패했습니다.');
      }
    } catch {
      addToast('error', '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Filter submissions that have a valid phone number (10+ digits)
  const validSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const clean = (s.phone || '').replace(/[^0-9]/g, '');
      return clean.length >= 10;
    });
  }, [submissions]);

  // Invalid or missing phone numbers count
  const missingPhoneCount = submissions.length - validSubmissions.length;

  // Initialize selectedSubIds with all valid submissions when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSubIds(validSubmissions.map(s => s.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Toggle single learner selection
  const handleToggleSelect = (id: string) => {
    setSelectedSubIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Toggle all learners selection
  const handleToggleSelectAll = () => {
    if (selectedSubIds.length === validSubmissions.length) {
      setSelectedSubIds([]);
    } else {
      setSelectedSubIds(validSubmissions.map(s => s.id));
    }
  };

  // Load SMS API configuration status when modal opens
  useEffect(() => {
    if (isOpen) {
      apiService.getSMSStatus().then(status => setSmsStatus(status));
    }
  }, [isOpen]);

  // Calculate byte length (Korean characters count as 2 bytes in Korean SMS standard)
  const calculateBytes = (str: string) => {
    let bytes = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      bytes += code > 127 ? 2 : 1;
    }
    return bytes;
  };

  const byteLength = calculateBytes(messageText);
  const isLMS = byteLength > 90; // Over 90 bytes becomes LMS

  // Preset Message Templates
  const templates = [
    {
      title: '과제 제출 접수 완료',
      text: '[태광 창업주 경영철학]\n선행학습 성찰 과제가 정상적으로 접수되었습니다. 성실한 참여에 감사드립니다.'
    },
    {
      title: '피드백 확인 요청',
      text: '[태광 경영철학 포털]\n제출하신 사전과제에 대한 검토가 완료되었습니다. 관리자 시스템에서 피드백을 확인해 주세요.'
    },
    {
      title: '본 교육 참석 안내',
      text: '[태광 인재개발원]\n사전학습 수료를 축하드립니다. 본 교육 일정 및 장소를 사내 메일로 확인해 주시기 바랍니다.'
    }
  ];

  if (!isOpen) return null;

  // Target recipients depending on sendMode
  const targetRecipients = sendMode === 'ALL'
    ? validSubmissions.map(s => ({ name: s.name, phone: s.phone || '' }))
    : validSubmissions
        .filter(s => selectedSubIds.includes(s.id))
        .map(s => ({ name: s.name, phone: s.phone || '' }));

  // Handle Send SMS
  const handleSend = async () => {
    if (!messageText.trim()) {
      addToast('error', '발송할 문자메시지 내용을 입력해 주세요.');
      return;
    }

    if (targetRecipients.length === 0) {
      addToast('error', '발송 가능한 유효한 수신자(휴대전화 번호)를 1명 이상 선택해 주세요.');
      return;
    }

    const confirmMsg = sendMode === 'ALL'
      ? `전화번호가 등록된 전체 ${targetRecipients.length}명에게 문자메시지를 발송하시겠습니까?`
      : targetRecipients.length === 1
        ? `${targetRecipients[0].name} (${targetRecipients[0].phone}) 님에게 문자메시지를 발송하시겠습니까?`
        : `선택하신 ${targetRecipients.length}명에게 문자메시지를 발송하시겠습니까?`;

    if (!confirm(confirmMsg)) return;

    setIsSending(true);
    try {
      const result = await apiService.sendSMS({
        recipients: targetRecipients,
        text: messageText.trim()
      });

      if (result.success) {
        if (result.simulation) {
          addToast('info', `[시뮬레이션 모드] ${result.totalCount}건 가상 발송 성공! (실제 키 입력 시 실제 전송됨)`);
        } else {
          addToast('success', `Solapi v4를 통해 ${result.successCount || result.totalCount}건의 문자가 성공적으로 발송되었습니다.`);
        }
        onClose();
      } else {
        addToast('error', result.error || '문자 발송에 실패했습니다.');
      }
    } catch (err: unknown) {
      console.error(err);
      addToast('error', '발송 중 네트워크 또는 시스템 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in text-left">
      <div 
        className="relative w-full max-w-2xl bg-[#2c2722] border border-[#C5A059]/40 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#36302a] px-5 py-4 border-b border-[#C5A059]/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-[#C5A059] font-bold text-base sm:text-lg">
                문자메시지 발송 <span className="text-xs font-sans font-normal text-gray-400">(CoolSMS / Solapi v4)</span>
              </h2>
              <p className="text-xs text-gray-400">
                학습자 인적사항에 등록된 휴대전화 번호로 안내 문자를 발송합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 custom-scrollbar">

          {/* API Key Status Notice Box */}
          <div className="bg-[#1e1b17] border border-[#C5A059]/30 rounded-xl p-3.5 flex flex-col gap-3 text-xs shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#C5A059] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold text-[#C5A059]">Solapi 연동 상태:</span>
                    {smsStatus?.isConfigured ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 운영 모드 활성화됨 ({smsStatus.apiKeyMasked})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> 시뮬레이션 모드 (API 키 등록 필요)
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-[11px] leading-relaxed">
                    발신번호: <strong className="text-gray-200">{smsStatus?.senderPhone || '010-0000-0000'}</strong> | Solapi v4 REST API(HMAC-SHA256)
                  </p>
                </div>
              </div>

              {/* Toggle Config Button */}
              <button
                type="button"
                onClick={() => setIsConfigOpen(prev => !prev)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#36302a] hover:bg-[#463f37] border border-[#C5A059]/40 text-[#C5A059] text-[11px] font-bold rounded-lg transition-all cursor-pointer flex-shrink-0"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{isConfigOpen ? '설정 닫기' : 'API 키 입력/설정'}</span>
              </button>
            </div>

            {/* Inline Config Form when toggled */}
            {isConfigOpen && (
              <form 
                onSubmit={handleSaveConfig}
                className="bg-[#2a241e] border border-[#C5A059]/40 rounded-xl p-3.5 flex flex-col gap-3 animate-fade-in text-gray-200"
              >
                <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-2">
                  <span className="font-bold text-[#C5A059] flex items-center gap-1.5 text-xs">
                    <Key className="w-3.5 h-3.5" /> Solapi(CoolSMS) 운영 연동 정보 입력
                  </span>
                  <span className="text-[11px] text-gray-400">
                    입력 즉시 실제 운영 모드로 가동됩니다
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-gray-300 font-semibold flex items-center gap-1">
                      <Key className="w-3 h-3 text-[#C5A059]" /> API KEY <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="NCSXXXXXXXXXXXXX"
                      required
                      className="bg-white text-[#1E293B] text-xs rounded-lg p-2 border border-gray-300 focus:ring-1 focus:ring-[#C5A059] outline-none font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-gray-300 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3 text-[#C5A059]" /> API SECRET <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      value={apiSecretInput}
                      onChange={(e) => setApiSecretInput(e.target.value)}
                      placeholder="Secret Key 입력"
                      required
                      className="bg-white text-[#1E293B] text-xs rounded-lg p-2 border border-gray-300 focus:ring-1 focus:ring-[#C5A059] outline-none font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-gray-300 font-semibold flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#C5A059]" /> 등록된 발신번호 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={senderPhoneInput}
                      onChange={(e) => setSenderPhoneInput(e.target.value)}
                      placeholder="01012345678 또는 021234567"
                      required
                      className="bg-white text-[#1E293B] text-xs rounded-lg p-2 border border-gray-300 focus:ring-1 focus:ring-[#C5A059] outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-gray-400">
                    ※ Solapi 콘솔에서 발급받은 API 키와 인증 등록된 발신번호를 입력하세요.
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfigOpen(false)}
                      className="px-3 py-1.5 bg-[#36302a] text-gray-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingConfig}
                      className="px-4 py-1.5 bg-[#C5A059] hover:bg-[#b08d48] text-[#2c2722] rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {isSavingConfig ? '저장 중...' : '운영 모드로 적용'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Step 1. 발송 대상 선택 (전체 보내기 vs 선택해서 보내기) */}
          <div className="bg-[#36302a]/60 border border-gray-700/60 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#C5A059] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> 발송 대상 선택
              </label>
              <span className="text-xs text-gray-400">
                유효 연락처 <strong className="text-white">{validSubmissions.length}</strong>명 / 전체 {submissions.length}명
              </span>
            </div>

            {/* Segmented Control Buttons */}
            <div className="grid grid-cols-2 gap-2 bg-[#231f1a] p-1.5 rounded-xl border border-gray-800">
              <button
                type="button"
                onClick={() => setSendMode('ALL')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  sendMode === 'ALL'
                    ? 'bg-[#C5A059] text-[#2c2722] shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" /> 전체 보내기 ({validSubmissions.length}명)
              </button>
              <button
                type="button"
                onClick={() => setSendMode('SELECT')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  sendMode === 'SELECT'
                    ? 'bg-[#C5A059] text-[#2c2722] shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <CheckSquare className="w-4 h-4" /> 선택해서 보내기 (체크박스)
              </button>
            </div>

            {/* Selection Mode Details */}
            {sendMode === 'ALL' ? (
              <div className="bg-[#2c2722] rounded-lg p-3 border border-gray-800 text-xs text-gray-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-[#C5A059] flex-shrink-0 mt-0.5" />
                <div>
                  휴대전화 번호가 등록된 모든 학습자 <strong>{validSubmissions.length}명</strong>에게 동일한 메시지가 일괄 발송됩니다.
                  {missingPhoneCount > 0 && (
                    <span className="text-amber-400 block mt-0.5">
                      (※ 연락처가 미입력된 {missingPhoneCount}명은 발송 대상에서 자동 제외됩니다.)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {/* Checkbox Toolbar: Select All / Deselect All */}
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="flex items-center gap-1.5 text-xs text-[#C5A059] hover:text-[#e4c483] font-semibold transition-all cursor-pointer"
                  >
                    {selectedSubIds.length === validSubmissions.length ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5" /> 전체 해제
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5" /> 전체 선택 ({validSubmissions.length}명)
                      </>
                    )}
                  </button>
                  <span className="text-xs text-gray-300 font-mono">
                    <strong className="text-[#C5A059]">{selectedSubIds.length}</strong> / {validSubmissions.length}명 선택됨
                  </span>
                </div>

                {validSubmissions.length === 0 ? (
                  <div className="text-xs text-amber-400 bg-amber-950/40 p-2.5 rounded-lg border border-amber-500/20">
                    전화번호가 등록된 학습자가 없습니다. 먼저 학습자 화면에서 연락처를 포함하여 과제를 제출해 주세요.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 p-2 bg-[#231f1a] rounded-xl border border-gray-800">
                    {validSubmissions.map(sub => {
                      const isChecked = selectedSubIds.includes(sub.id);
                      return (
                        <label
                          key={sub.id}
                          className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-[#C5A059]/15 border-[#C5A059]/40 text-white shadow-sm'
                              : 'bg-[#2c2722]/70 border-gray-800/80 text-gray-400 hover:bg-[#2c2722] hover:text-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelect(sub.id)}
                              className="w-4 h-4 rounded text-[#C5A059] focus:ring-[#C5A059] accent-[#C5A059] cursor-pointer"
                            />
                            <span className="font-bold text-xs sm:text-sm text-white whitespace-nowrap">
                              {sub.name}
                            </span>
                            <span className="text-xs text-gray-400 truncate max-w-[140px] sm:max-w-[200px]">
                              {sub.department}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-mono text-xs font-semibold text-amber-300 bg-black/30 px-2 py-0.5 rounded border border-amber-500/20">
                              {sub.phone}
                            </span>
                            <span className="text-[10px] hidden sm:inline-block px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                              {sub.cardType?.split(' ')[0] || '과제'}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2. 추천 메시지 템플릿 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" /> 추천 템플릿 (클릭 시 자동 입력):
            </span>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMessageText(tpl.text)}
                  className="px-2.5 py-1.5 bg-[#36302a] hover:bg-[#463f37] border border-[#C5A059]/20 hover:border-[#C5A059]/40 text-xs rounded-lg text-gray-300 hover:text-white transition-all cursor-pointer"
                >
                  {tpl.title}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3. 메시지 본문 작성 영역 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200">
                메시지 내용 작성
              </label>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  isLMS ? 'bg-purple-950 text-purple-300 border border-purple-500/30' : 'bg-blue-950 text-blue-300 border border-blue-500/30'
                }`}>
                  {isLMS ? 'LMS (장문)' : 'SMS (단문)'}
                </span>
                <span className={byteLength > 2000 ? 'text-red-400 font-bold' : 'text-gray-400'}>
                  {byteLength} / {isLMS ? '2000 Byte' : '90 Byte'}
                </span>
              </div>
            </div>

            <textarea
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="학습자들에게 전송할 문자메시지 내용을 입력하세요..."
              className="bg-white text-[#1E293B] placeholder-gray-400 text-sm rounded-xl p-3.5 border border-gray-300 focus:ring-2 focus:ring-[#C5A059] focus:outline-none resize-none leading-relaxed transition-all shadow-inner"
            />
          </div>

          {/* Preview of Recipients */}
          <div className="bg-[#231f1a] rounded-xl p-3 border border-gray-800 text-xs flex items-center justify-between">
            <span className="text-gray-400">최종 발송 수신처:</span>
            {targetRecipients.length === 0 ? (
              <span className="text-red-400 font-semibold">
                선택된 수신자 없음 (체크박스를 선택해 주세요)
              </span>
            ) : (
              <span className="font-bold text-[#C5A059] font-mono">
                총 {targetRecipients.length}명
                {sendMode === 'SELECT' && (
                  <span className="font-sans font-normal text-gray-300 ml-1.5">
                    ({targetRecipients.slice(0, 2).map(r => r.name).join(', ')}
                    {targetRecipients.length > 2 ? ` 외 ${targetRecipients.length - 2}명` : ''})
                  </span>
                )}
              </span>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-[#36302a] px-5 py-3.5 border-t border-[#C5A059]/20 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          >
            취소
          </button>
          
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || targetRecipients.length === 0 || !messageText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#C5A059] to-[#d8b56f] hover:from-[#b08d48] hover:to-[#C5A059] text-[#2c2722] text-xs sm:text-sm font-bold rounded-xl shadow-lg hover:shadow-[#C5A059]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>발송 중...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>문자 발송하기 ({targetRecipients.length}건)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
