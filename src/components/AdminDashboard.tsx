import React, { useState, useEffect } from 'react';
import type { Submission } from '../data/cardData';
import { apiService } from '../api';
import { generateSubmissionPDF } from '../utils/pdfGenerator';
import { exportSubmissionsToCSV } from '../utils/csvExporter';
import { SMSModal } from './SMSModal';
import { 
  Users, 
  Briefcase, 
  FileText, 
  Clock, 
  Search, 
  Trash2, 
  Download, 
  Database, 
  Wifi, 
  WifiOff,
  RefreshCw,
  MessageSquare,
  Phone,
  Mail
} from 'lucide-react';

interface AdminDashboardProps {
  submissions: Submission[];
  isOffline: boolean;
  refreshData: () => void;
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  submissions,
  isOffline,
  refreshData,
  addToast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);

  // Clear selections when submissions list changes and the selected submission is deleted
  useEffect(() => {
    if (selectedSubId && !submissions.some(s => s.id === selectedSubId)) {
      setSelectedSubId(null);
    }
  }, [submissions, selectedSubId]);

  // Statistics Calculations
  const totalSubmissions = submissions.length;
  
  const uniqueDepartments = Array.from(
    new Set(submissions.map(s => s.department.trim()))
  ).filter(Boolean).length;

  const averageChars = totalSubmissions > 0
    ? Math.round(
        submissions.reduce((acc, sub) => {
          const charSum = Object.values(sub.answers).reduce((sum, ans) => sum + ans.length, 0);
          return acc + charSum;
        }, 0) / totalSubmissions
      )
    : 0;

  const latestTime = totalSubmissions > 0
    ? submissions.reduce((latest, current) => {
        return new Date(current.submittedAt) > new Date(latest.submittedAt) ? current : latest;
      }).submittedAt
    : '-';

  // Search & Filter Submissions
  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = 
      sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      typeFilter === 'ALL' || 
      (sub.cardType && sub.cardType.includes(typeFilter));

    return matchesSearch && matchesFilter;
  });

  const selectedSubmission = submissions.find(s => s.id === selectedSubId) || null;

  // Handlers
  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation(); // prevent row click trigger
    if (!confirm(`${name} 임직원의 과제 제출 내역을 삭제하시겠습니까?`)) return;

    try {
      await apiService.deleteSubmission(id);
      addToast('success', '제출 내역이 성공적으로 삭제되었습니다.');
      refreshData();
    } catch (err) {
      console.error(err);
      addToast('error', '삭제 처리 중 오류가 발생했습니다.');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('경고: 모든 제출 내역이 초기화되며 복구할 수 없습니다. 계속하시겠습니까?')) return;
    
    try {
      await apiService.clearAllSubmissions();
      addToast('success', '모든 제출 데이터가 성공적으로 초기화되었습니다.');
      refreshData();
    } catch (err) {
      console.error(err);
      addToast('error', '초기화 처리 중 오류가 발생했습니다.');
    }
  };

  const handleCSVExport = () => {
    if (filteredSubmissions.length === 0) {
      addToast('info', '내보낼 데이터가 존재하지 않습니다.');
      return;
    }
    exportSubmissionsToCSV(filteredSubmissions);
    addToast('success', 'CSV 내보내기가 완료되었습니다.');
  };

  const handlePDFDownload = (e: React.MouseEvent, sub: Submission) => {
    e.stopPropagation(); // prevent row click trigger
    try {
      generateSubmissionPDF(sub);
      addToast('success', `${sub.name} 님의 PDF 보고서가 생성되었습니다.`);
    } catch (err) {
      console.error(err);
      addToast('error', 'PDF 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      
      {/* Network Status & Refresh Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#463f37]/50 border border-[#C5A059]/15 rounded-xl px-5 py-3 glass-panel">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">시스템 연동 상태:</span>
          {isOffline ? (
            <span className="flex items-center gap-1 bg-red-950 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-bold">
              <WifiOff className="w-3.5 h-3.5" /> 로컬 단독 (오프라인)
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
              <Wifi className="w-3.5 h-3.5" /> Express 서버 연동 중
            </span>
          )}
        </div>
        <button
          onClick={refreshData}
          className="flex items-center justify-center gap-1 px-3 py-1.5 bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/30 rounded-lg text-xs font-semibold hover:bg-[#C5A059]/20 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>데이터 새로고침</span>
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: 총 제출자 수 */}
        <div className="rounded-2xl p-5 bg-[#463f37] border border-[#C5A059]/10 shadow-xl flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium">총 제출자 수</span>
            <span className="text-2xl font-bold text-white font-mono">{totalSubmissions} <span className="text-xs font-sans font-normal text-gray-400">명</span></span>
          </div>
          <div className="p-3 rounded-xl bg-[#C5A059]/10 text-[#C5A059]">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Stat 2: 독립 참가 부서 수 */}
        <div className="rounded-2xl p-5 bg-[#463f37] border border-[#C5A059]/10 shadow-xl flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium">독립 참가 부서 수</span>
            <span className="text-2xl font-bold text-white font-mono">{uniqueDepartments} <span className="text-xs font-sans font-normal text-gray-400">개</span></span>
          </div>
          <div className="p-3 rounded-xl bg-[#C5A059]/10 text-[#C5A059]">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>

        {/* Stat 3: 인당 평균 글자 수 */}
        <div className="rounded-2xl p-5 bg-[#463f37] border border-[#C5A059]/10 shadow-xl flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium">인당 평균 성찰 글자수</span>
            <span className="text-2xl font-bold text-white font-mono">{averageChars} <span className="text-xs font-sans font-normal text-gray-400">자</span></span>
          </div>
          <div className="p-3 rounded-xl bg-[#C5A059]/10 text-[#C5A059]">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Stat 4: 최근 제출 시점 */}
        <div className="rounded-2xl p-5 bg-[#463f37] border border-[#C5A059]/10 shadow-xl flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium">최근 제출 시점</span>
            <span className="text-sm font-bold text-white truncate max-w-[150px] md:max-w-none">{latestTime}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#C5A059]/10 text-[#C5A059]">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="rounded-2xl glass-panel border border-[#C5A059]/15 shadow-2xl overflow-hidden">
        {/* Panel Header & Filters */}
        <div className="bg-[#463f37] border-b border-[#C5A059]/15 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#C5A059]" />
            <h3 className="font-serif text-[#C5A059] font-bold text-md">임직원 과제 수신 대시보드</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="이름, 부서명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#2c2722] text-xs text-gray-200 placeholder-gray-500 rounded-lg pl-8 pr-3 py-2 w-44 focus:ring-1 focus:ring-[#C5A059] focus:outline-none border border-gray-700/50"
              />
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
            </div>

            {/* Filter Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#2c2722] text-xs text-gray-200 rounded-lg px-3 py-2 border border-gray-700/50 focus:outline-none cursor-pointer"
            >
              <option value="ALL">전체 유형</option>
              <option value="1형">1형 [사업보국]</option>
              <option value="2형">2형 [인재제일]</option>
              <option value="3형">3형 [도전경영]</option>
              <option value="4형">4형 [정직신용]</option>
              <option value="5형">5형 [상생나눔]</option>
            </select>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsSMSModalOpen(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#C5A059] to-[#d8b56f] hover:from-[#b08d48] hover:to-[#C5A059] text-[#2c2722] text-xs font-bold px-3 py-2 rounded-lg shadow-md hover:shadow-[#C5A059]/20 transition-all cursor-pointer"
                title="학습자 휴대전화 번호로 문자메시지 발송"
              >
                <MessageSquare className="w-3.5 h-3.5" /> 문자메시지 발송
              </button>
              <button
                onClick={handleCSVExport}
                className="flex items-center gap-1 bg-[#36302a] hover:bg-[#463f37] border border-[#C5A059]/30 text-[#C5A059] text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> CSV 내보내기
              </button>
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 bg-red-950/70 border border-red-500/20 text-red-400 hover:bg-red-900/60 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> 전체 초기화
              </button>
            </div>
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs uppercase bg-[#36302a]/80 text-[#C5A059] border-b border-[#C5A059]/10">
              <tr>
                <th scope="col" className="px-5 py-3">성명</th>
                <th scope="col" className="px-5 py-3 font-serif">회사/소속부서</th>
                <th scope="col" className="px-5 py-3 font-serif">연락처 (휴대전화/이메일)</th>
                <th scope="col" className="px-5 py-3 font-serif">과제 수행 유형</th>
                <th scope="col" className="px-5 py-3 font-serif hidden md:table-cell">산출 파일명</th>
                <th scope="col" className="px-5 py-3 font-serif">제출 일시</th>
                <th scope="col" className="px-5 py-3 text-center">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 font-serif">
                    제출된 사전과제 결과물이 존재하지 않습니다.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => {
                  const isSelected = selectedSubId === sub.id;
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => setSelectedSubId(sub.id)}
                      className={`cursor-pointer transition-colors border-gray-800/40 hover:bg-[#463f37]/35 ${
                        isSelected ? 'bg-[#C5A059]/10 hover:bg-[#C5A059]/15' : 'odd:bg-[#2c2722]/10 even:bg-[#2c2722]/30'
                      }`}
                    >
                      <td className="px-5 py-4 font-bold text-white whitespace-nowrap">{sub.name}</td>
                      <td className="px-5 py-4">{sub.department}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {sub.phone ? (
                            <span className="font-mono text-gray-200 flex items-center gap-1.5 font-semibold">
                              <Phone className="w-3 h-3 text-[#C5A059]" /> {sub.phone}
                            </span>
                          ) : (
                            <span className="text-gray-500 italic text-[11px]">전화번호 미등록</span>
                          )}
                          {sub.email && (
                            <span className="text-gray-400 flex items-center gap-1.5 text-[11px] truncate max-w-[170px]" title={sub.email}>
                              <Mail className="w-3 h-3 text-gray-400" /> {sub.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-block text-xs px-2 py-0.5 rounded bg-[#2c2722] border border-gray-700 text-gray-300">
                          {sub.cardType}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-gray-400 hidden md:table-cell truncate max-w-[180px]" title={sub.fileName}>
                        {sub.fileName}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">{sub.submittedAt}</td>
                      <td className="px-5 py-4 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handlePDFDownload(e, sub)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-[#2c2722] text-xs font-bold rounded border border-gray-300 shadow-sm transition-all cursor-pointer"
                          title="공식 PDF 보고서 발행"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, sub.id, sub.name)}
                          className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-[#2c2722] transition-all cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Panel Footer: Dual CI Brand Logos inside Gold Border */}
        <div className="bg-[#2c2722]/90 border-t border-[#C5A059]/15 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="text-[#C5A059] font-bold font-serif">태광그룹 인재개발원</span>
            <span className="text-gray-600 hidden sm:inline">•</span>
            <span className="text-gray-400 text-[11px] hidden sm:inline">임직원 과제 수신 관리 및 PDF 보고서 발행 시스템</span>
          </div>

          <div className="flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-gray-300 shadow-sm">
            <img src="/logos/taekwang-logo.png" alt="태광그룹" className="h-5 sm:h-5.5 object-contain" />
            <div className="w-[1px] h-3.5 bg-gray-300"></div>
            <img src="/logos/heungkuk-logo.png" alt="흥국금융그룹" className="h-4.5 sm:h-5 object-contain" />
          </div>
        </div>
      </div>

      {/* Selected Submission Detail Viewer */}
      <div className="rounded-2xl glass-panel border border-[#C5A059]/15 shadow-2xl p-5">
        <h3 className="font-serif text-[#C5A059] font-bold text-sm border-b border-[#C5A059]/15 pb-2.5 mb-4 flex items-center justify-between">
          <span>▼ 임직원 상세 답변 실시간 모니터링</span>
          {selectedSubmission && (
            <span className="text-xs text-gray-400 font-sans font-normal">
              {selectedSubmission.department} — <strong className="text-white">{selectedSubmission.name}</strong> ({selectedSubmission.cardType})
              {selectedSubmission.phone && <span className="ml-2 font-mono text-amber-300">📞 {selectedSubmission.phone}</span>}
            </span>
          )}
        </h3>

        {!selectedSubmission ? (
          <div className="py-16 text-center text-gray-500 font-serif">
            위의 대시보드 테이블 행을 클릭하여 해당 임직원이 작성한 상세 성찰문 답변을 아래에서 심층 열람하십시오.
          </div>
        ) : (
          <div className="flex flex-col gap-4 animate-fade-in">
            {selectedSubmission.questions.map((q, idx) => {
              const answer = selectedSubmission.answers[q.id] || '';
              return (
                <div key={q.id} className="bg-[#2c2722]/50 border border-gray-700/20 rounded-xl p-4 flex flex-col gap-2">
                  <div className="text-sm font-semibold text-[#C5A059] leading-snug flex items-start gap-1 font-serif">
                    <span>Q{idx + 1}.</span>
                    <span>{q.question}</span>
                  </div>
                  {/* Clean White readonly text viewer to protect reader's sight */}
                  <div className="bg-[#F8FAFC] text-[#1E293B] font-normal leading-relaxed text-sm rounded-xl p-4 whitespace-pre-wrap border border-gray-200">
                    {answer}
                  </div>
                  <div className="text-right text-[10px] text-gray-400 font-mono">
                    공백 포함 글자수: {answer.length} 자
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SMS Modal Popup */}
      <SMSModal
        isOpen={isSMSModalOpen}
        onClose={() => setIsSMSModalOpen(false)}
        submissions={submissions}
        addToast={addToast}
      />

    </div>
  );
};
