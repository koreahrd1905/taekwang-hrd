import React, { useState } from 'react';
import { bookChapters } from '../data/bookData';
import { ChevronLeft, ChevronRight, Download, Type, BookOpen, Edit3 } from 'lucide-react';

interface EBookReaderProps {
  onSwitchToAssignment?: () => void;
}

export const EBookReader: React.FC<EBookReaderProps> = ({ onSwitchToAssignment }) => {
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [fontSize, setFontSize] = useState(16); // default font size is 16px

  const activeChapter = bookChapters[activeChapterIndex];

  // Adjust font size (min: 13px, max: 24px)
  const adjustFontSize = (amount: number) => {
    setFontSize(prev => Math.min(Math.max(prev + amount, 13), 24));
  };

  // Handle next/prev
  const goPrev = () => {
    if (activeChapterIndex > 0) {
      setActiveChapterIndex(prev => prev - 1);
    }
  };

  const goNext = () => {
    if (activeChapterIndex < bookChapters.length - 1) {
      setActiveChapterIndex(prev => prev + 1);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden glass-panel border border-[#C5A059]/20 shadow-2xl">
      {/* Reader Header */}
      <div className="bg-[#463f37] border-b border-[#C5A059]/20 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-[#C5A059] flex-shrink-0" />
          <h2 className="font-serif text-[#C5A059] font-bold text-xs sm:text-base tracking-wide truncate">
            창업주 추모록 E-Book
          </h2>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Font Resizing */}
          <div className="flex items-center bg-[#2c2722] rounded-lg p-0.5 border border-[#C5A059]/15">
            <button
              onClick={() => adjustFontSize(-1)}
              className="px-1.5 sm:px-2 py-0.5 text-xs text-gray-300 hover:text-[#C5A059] hover:bg-[#36302a] rounded transition-all font-mono active:scale-95"
              title="글꼴 축소"
              aria-label="글꼴 축소"
            >
              A-
            </button>
            <div className="px-1.5 sm:px-2 text-[11px] sm:text-xs text-[#C5A059] font-mono flex items-center gap-0.5 sm:gap-1 border-x border-[#C5A059]/15">
              <Type className="w-3 h-3 hidden sm:inline" />
              <span>{fontSize}px</span>
            </div>
            <button
              onClick={() => adjustFontSize(1)}
              className="px-1.5 sm:px-2 py-0.5 text-xs text-gray-300 hover:text-[#C5A059] hover:bg-[#36302a] rounded transition-all font-mono active:scale-95"
              title="글꼴 확대"
              aria-label="글꼴 확대"
            >
              A+
            </button>
          </div>
          {/* PDF Download */}
          <a
            href="/eBook.pdf"
            download="eBook.pdf"
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-[#C5A059] hover:bg-[#A68345] text-[#2c2722] border border-[#C5A059] rounded-lg text-xs sm:text-[13.5px] font-bold transition-all shadow-md active:scale-95"
            title="추모록 도서 PDF 다운받기"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="hidden sm:inline">추모록 도서 PDF 다운받기</span>
            <span className="inline sm:hidden">PDF</span>
          </a>
        </div>
      </div>

      {/* Chapter Tabs */}
      <div className="bg-[#36302a] px-2.5 sm:px-3 py-1.5 border-b border-[#C5A059]/10 overflow-x-auto flex gap-1.5 scrollbar-hide flex-shrink-0 touch-pan-x">
        {bookChapters.map((ch, idx) => (
          <button
            key={ch.id}
            onClick={() => setActiveChapterIndex(idx)}
            className={`flex-shrink-0 px-2.5 sm:px-3 py-1 text-xs rounded-lg transition-all duration-200 active:scale-95 ${
              activeChapterIndex === idx
                ? 'bg-[#C5A059] text-[#2c2722] font-bold shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-[#463f37]'
            }`}
          >
            {ch.id}. {ch.tabTitle || ch.title}
          </button>
        ))}
      </div>

      {/* Book reading pane (Full height scrollable, comfortable reading style) */}
      <div className="flex-1 min-h-0 bg-[#F8FAFC] p-4 sm:p-7 md:p-8 overflow-y-auto select-text text-left shadow-inner touch-pan-y">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-4 sm:mb-6">
            <span className="inline-block text-[#C5A059] font-mono text-xs sm:text-sm font-bold tracking-widest border-b-2 border-[#C5A059]/40 pb-1 mb-1.5 sm:mb-2">
              {activeChapter.chapterNumber}
            </span>
            <h3 className="font-serif text-[#1e293b] font-bold text-lg sm:text-2xl mb-1 leading-snug">
              {activeChapter.title}
            </h3>
            <p className="text-gray-500 font-serif italic text-xs sm:text-sm">
              {activeChapter.subtitle}
            </p>
          </div>
          
          <div 
            style={{ fontSize: `${fontSize}px` }}
            className="text-slate-800 leading-relaxed font-normal whitespace-pre-wrap transition-all duration-150 text-justify border-t border-gray-200/80 pt-4 sm:pt-5"
          >
            {activeChapter.content}
          </div>

          {/* Mobile Bottom Action: Switch to Assignment */}
          {onSwitchToAssignment && (
            <div className="mt-8 pt-5 border-t border-gray-200 lg:hidden">
              <button
                type="button"
                onClick={onSwitchToAssignment}
                className="w-full py-3 px-4 bg-[#2c2722] hover:bg-[#36302a] text-[#C5A059] border border-[#C5A059]/50 rounded-xl font-serif font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
              >
                <Edit3 className="w-4 h-4 text-[#C5A059]" />
                <span>선행 성찰과제 작성하러 가기 ➔</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reader Footer Controls */}
      <div className="bg-[#463f37] border-t border-[#C5A059]/20 px-3 sm:px-5 py-2.5 flex items-center justify-between flex-shrink-0">
        <button
          onClick={goPrev}
          disabled={activeChapterIndex === 0}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 ${
            activeChapterIndex === 0
              ? 'text-gray-600 bg-transparent cursor-not-allowed opacity-40'
              : 'text-[#C5A059] hover:bg-[#36302a] border border-[#C5A059]/30 active:scale-95'
          }`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>이전<span className="hidden sm:inline"> 챕터</span></span>
        </button>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-300 font-mono font-medium">
            {activeChapterIndex + 1} / {bookChapters.length}
          </span>
          {onSwitchToAssignment && (
            <button
              onClick={onSwitchToAssignment}
              className="lg:hidden text-[11px] text-[#C5A059] bg-[#2c2722] px-2 py-1 rounded-md border border-[#C5A059]/30 font-serif font-semibold"
            >
              과제작성 ➔
            </button>
          )}
        </div>

        <button
          onClick={goNext}
          disabled={activeChapterIndex === bookChapters.length - 1}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 ${
            activeChapterIndex === bookChapters.length - 1
              ? 'text-gray-600 bg-transparent cursor-not-allowed opacity-40'
              : 'text-[#C5A059] hover:bg-[#36302a] border border-[#C5A059]/30 active:scale-95'
          }`}
        >
          <span>다음<span className="hidden sm:inline"> 챕터</span></span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

