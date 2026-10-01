import React, { useState } from 'react';
import { taskCardTypes } from '../data/cardData';
import { apiService } from '../api';
import { User, Building, Send, CheckCircle2, AlertCircle, Edit3, Phone, Mail } from 'lucide-react';

interface AssignmentFormProps {
  onSubmissionSuccess: () => void;
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const AssignmentForm: React.FC<AssignmentFormProps> = ({
  onSubmissionSuccess,
  addToast
}) => {
  // Form State
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-hyphen phone formatter (010-XXXX-XXXX)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    let formatted = raw;
    if (raw.length > 3 && raw.length <= 7) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    } else if (raw.length > 7) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    }
    setPhone(formatted);
  };

  const selectedCard = taskCardTypes[selectedCardIdx];

  // Handle answer change
  const handleAnswerChange = (questionId: number, text: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: text
    }));
  };

  // Validation helper
  const getCharCount = (qId: number) => {
    return (answers[qId] || '').length;
  };

  const isFormValid = () => {
    if (!name.trim() || !department.trim()) return false;
    
    // Both questions of the selected card must be filled
    return selectedCard.questions.every(q => {
      const text = answers[q.id] || '';
      return text.trim().length > 0;
    });
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      addToast('error', '성명, 부서 및 모든 성찰 문항을 작성해 주세요.');
      return;
    }

    // Check if answers are less than 250 chars and double check
    const hasShortAnswer = selectedCard.questions.some(q => {
      const len = getCharCount(q.id);
      return len < 250;
    });

    if (hasShortAnswer) {
      if (!confirm('250자 미만으로 작성된 답변이 있습니다. 그대로 제출하시겠습니까?')) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await apiService.addSubmission({
        name: name.trim(),
        department: department.trim(),
        phone: phone.trim(),
        email: email.trim(),
        cardType: selectedCard.title,
        questions: selectedCard.questions,
        answers: {
          [selectedCard.questions[0].id]: answers[selectedCard.questions[0].id] || '',
          [selectedCard.questions[1].id]: answers[selectedCard.questions[1].id] || '',
        }
      });

      if (response.isLocalStorageOnly) {
        addToast('info', '서버 연결 실패로 로컬 저장소(오프라인 모드)에 안전하게 임시 저장되었습니다.');
      } else {
        addToast('success', `${selectedCard.title} 사전과제가 정상적으로 제출 및 저장되었습니다.`);
      }

      // Reset answers only, preserve user credentials for speed
      setAnswers({});
      onSubmissionSuccess();
    } catch (err) {
      console.error(err);
      addToast('error', '과제 제출 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="flex flex-col h-full rounded-2xl overflow-hidden glass-panel border border-[#C5A059]/20 shadow-2xl text-left"
    >
      {/* Board Header */}
      <div className="bg-[#463f37] border-b border-[#C5A059]/20 px-4 sm:px-5 py-3 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-[#C5A059]" />
          <h2 className="font-serif text-[#C5A059] font-bold text-base sm:text-lg tracking-wide">선행 성찰 과제 수행</h2>
        </div>
        <div className="flex items-center gap-1.5 bg-[#2c2722] px-3 py-1.5 rounded-lg border border-[#C5A059]/20">
          <span className="text-xs text-gray-300">선택 유형:</span>
          <span 
            className="text-xs sm:text-sm font-bold font-mono px-1.5 py-0.5 rounded"
            style={{ color: selectedCard.themeColor }}
          >
            {selectedCard.typeCode} {selectedCard.title.split(' ')[1].replace(/[\[\]]/g, '')}
          </span>
        </div>
      </div>

      {/* Board Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 md:p-5 flex flex-col gap-4 custom-scrollbar">
        
        {/* Step 1. 인적 사항 등록 (성명, 부서, 휴대전화, 이메일) */}
        <div className="bg-[#36302a]/70 border border-[#C5A059]/15 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 shadow-md">
          <div className="flex items-center justify-between border-b border-[#C5A059]/10 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#C5A059] flex items-center justify-center text-[#2c2722] font-bold text-xs font-mono">1</div>
              <h3 className="font-serif text-[#C5A059] font-bold text-sm sm:text-base">학습자 인적 사항</h3>
            </div>
            <span className="text-[11px] text-gray-400">
              휴대전화로 교육 안내 및 문자메시지가 발송됩니다
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 성명 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm text-gray-200 font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#C5A059]" /> 성명 <span className="text-red-400 font-bold">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 홍길동"
                required
                className="bg-white text-[#1E293B] placeholder-gray-400 text-sm sm:text-base rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#C5A059] focus:border-[#C5A059] block w-full p-2.5 sm:p-3 outline-none transition-all"
              />
            </div>

            {/* 소속 부서 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm text-gray-200 font-semibold flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#C5A059]" /> 회사 / 소속 부서 <span className="text-red-400 font-bold">*</span>
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="예: 태광산업 / 전략기획팀"
                required
                className="bg-white text-[#1E293B] placeholder-gray-400 text-sm sm:text-base rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#C5A059] focus:border-[#C5A059] block w-full p-2.5 sm:p-3 outline-none transition-all"
              />
            </div>

            {/* 휴대전화 번호 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm text-gray-200 font-semibold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#C5A059]" /> 휴대전화 번호 <span className="text-amber-400 font-normal text-xs">(문자 수신용)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="010-0000-0000"
                maxLength={13}
                className="bg-white text-[#1E293B] placeholder-gray-400 text-sm sm:text-base rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#C5A059] focus:border-[#C5A059] block w-full p-2.5 sm:p-3 outline-none transition-all font-mono"
              />
            </div>

            {/* 이메일 주소 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm text-gray-200 font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#C5A059]" /> 이메일 주소 <span className="text-gray-400 font-normal text-xs">(선택)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@taekwang.com"
                className="bg-white text-[#1E293B] placeholder-gray-400 text-sm sm:text-base rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#C5A059] focus:border-[#C5A059] block w-full p-2.5 sm:p-3 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Step 2. 과제 카드 유형 선택 (1형 ~ 5형) */}
        <div className="bg-[#36302a]/70 border border-[#C5A059]/15 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 shadow-md">
          <div className="flex items-center justify-between border-b border-[#C5A059]/10 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#C5A059] flex items-center justify-center text-[#2c2722] font-bold text-xs font-mono">2</div>
              <h3 className="font-serif text-[#C5A059] font-bold text-sm sm:text-base">과제 유형 선택 (1형 ~ 5형)</h3>
            </div>
            <span className="text-xs text-gray-300 hidden sm:inline">희망하는 성찰 주제를 클릭하십시오.</span>
          </div>

          {/* 5-Card Selection Grid */}
          <div className="grid grid-cols-5 gap-2">
            {taskCardTypes.map((card, idx) => {
              const isSelected = selectedCardIdx === idx;
              return (
                <button
                  type="button"
                  key={card.id}
                  onClick={() => setSelectedCardIdx(idx)}
                  className={`p-2 sm:p-3 rounded-xl border text-center transition-all duration-200 flex flex-col items-center justify-between gap-1.5 min-h-[80px] sm:min-h-[90px] hover:scale-[1.02] cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#463f37] to-[#2c2722] text-white ring-1'
                      : 'bg-[#2c2722]/70 border-gray-700/50 text-gray-300 hover:text-white hover:bg-[#2c2722]'
                  }`}
                  style={{
                    borderColor: isSelected ? card.themeColor : undefined,
                    boxShadow: isSelected ? `0 0 14px ${card.themeColor}50` : undefined
                  }}
                >
                  <span 
                    className="font-mono text-xs sm:text-sm px-2 py-0.5 rounded font-bold"
                    style={{
                      backgroundColor: isSelected ? card.themeColor : '#2c2722',
                      color: isSelected ? (card.id === 1 || card.id === 5 ? '#2c2722' : '#ffffff') : '#94a3b8'
                    }}
                  >
                    {card.typeCode}
                  </span>
                  <span className="text-xs sm:text-sm font-bold truncate max-w-full">
                    {card.title.split(' ')[1].replace(/[\[\]]/g, '')}
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-400 truncate max-w-full hidden sm:block">
                    {card.category.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="bg-[#2c2722]/60 rounded-xl p-2.5 sm:p-3 border border-[#C5A059]/15">
            <p className="text-xs sm:text-sm text-[#C5A059] italic font-serif leading-relaxed text-center sm:text-left">
              &quot;{selectedCard.summary}&quot;
            </p>
          </div>
        </div>

        {/* Step 3. 성찰문항 작성 */}
        <div className="bg-[#36302a]/70 border border-[#C5A059]/15 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3.5 shadow-md">
          <div className="flex items-center gap-2 border-b border-[#C5A059]/10 pb-2">
            <div className="w-5 h-5 rounded-full bg-[#C5A059] flex items-center justify-center text-[#2c2722] font-bold text-xs font-mono">3</div>
            <h3 className="font-serif text-[#C5A059] font-bold text-sm sm:text-base">
              성찰 답변 작성 <span className="font-sans text-xs sm:text-sm text-gray-300 font-normal">({selectedCard.title})</span>
            </h3>
          </div>

          <div className="flex flex-col gap-5">
            {selectedCard.questions.map((q, idx) => {
              const count = getCharCount(q.id);
              const isTargetMet = count >= 250;
              return (
                <div key={q.id} className="flex flex-col gap-2">
                  <div className="text-sm sm:text-base font-semibold text-white leading-snug flex items-start gap-1.5 font-serif">
                    <span className="text-[#C5A059] flex-shrink-0 font-bold">[문항 {idx + 1}]</span>
                    <span>{q.question}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-300 italic px-1">💡 {q.description}</p>
                  
                  {/* Clean White reading/writing box with Dark text for usability */}
                  <div className="relative">
                    <textarea
                      rows={5}
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      placeholder="여기에 생각하신 성찰 내용을 차분히 서술하여 주십시오. (250자 이상 권장)"
                      required
                      className="bg-[#F8FAFC] text-[#1E293B] placeholder-slate-400 text-sm sm:text-base rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#C5A059] focus:border-[#C5A059] block w-full p-3.5 sm:p-4 outline-none resize-none transition-all leading-relaxed shadow-inner"
                    />
                    
                    {/* Status Indicator inside textarea corner */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/95 px-2.5 py-1 rounded-full shadow border border-gray-200 pointer-events-none">
                      <span className="font-mono text-xs text-slate-700 font-semibold">
                        {count} / 250자
                      </span>
                      {isTargetMet ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                  
                  {/* Validation text helper */}
                  <div className="flex justify-end px-1">
                    {isTargetMet ? (
                      <span className="text-xs sm:text-sm text-emerald-400 font-medium">✓ 권장 분량 충족 ({count}자)</span>
                    ) : (
                      <span className="text-xs sm:text-sm text-amber-400 font-medium">250자 이상 작성을 권장합니다. (현재 {count}자)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Board Fixed Footer Action */}
      <div className="bg-[#463f37] border-t border-[#C5A059]/20 p-3 sm:p-4 flex-shrink-0">
        <button
          type="submit"
          disabled={isSubmitting || !isFormValid()}
          className={`w-full py-3.5 px-6 rounded-xl font-serif font-bold text-sm sm:text-base tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all duration-200 ${
            isFormValid() && !isSubmitting
              ? 'bg-[#C5A059] hover:bg-[#A68345] text-[#2c2722] hover:shadow-[#C5A059]/30 active:scale-[0.99] cursor-pointer'
              : 'bg-gray-700/80 text-gray-400 cursor-not-allowed border border-gray-700'
          }`}
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? '사전과제 제출 중...' : `${selectedCard.title} 사전과제 제출 완료하기`}
        </button>
      </div>

    </form>
  );
};

