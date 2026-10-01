import React, { useState } from 'react';
import { bookChapters } from '../data/bookData';
import { ChevronLeft, ChevronRight, Download, Type, BookOpen } from 'lucide-react';

export const EBookReader: React.FC = () => {
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
      <div className="bg-[#463f37] border-b border-[#C5A059]/20 px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#C5A059]" />
          <h2 className="font-serif text-[#C5A059] font-bold text-sm sm:text-base tracking-wide">창업주 추모록 E-Book</h2>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Font Resizing */}
          <div className="flex items-center bg-[#2c2722] rounded-lg p-0.5 border border-[#C5A059]/15">
            <button
              onClick={() => adjustFontSize(-1)}
              className="px-2 py-0.5 text-xs text-gray-300 hover:text-[#C5A059] hover:bg-[#36302a] rounded transition-all font-mono"
              title="글꼴 축소"
            >
              A-
            </button>
            <div className="px-2 text-xs text-[#C5A059] font-mono flex items-center gap-1 border-x border-[#C5A059]/15">
              <Type className="w-3 h-3" />
              <span>{fontSize}px</span>
            </div>
            <button
              onClick={() => adjustFontSize(1)}
              className="px-2 py-0.5 text-xs text-gray-300 hover:text-[#C5A059] hover:bg-[#36302a] rounded transition-all font-mono"
              title="글꼴 확대"
            >
              A+
            </button>
          </div>
          {/* PDF Download */}
          <a
            href="/eBook.pdf"
            download="eBook.pdf"
            className="flex items-center gap-2 px-3.5 py-1.5 bg-[#C5A059] hover:bg-[#A68345] text-[#2c2722] border border-[#C5A059] rounded-lg text-sm sm:text-[13.5px] font-bold transition-all shadow-md active:scale-95"
            title="추모록 도서 PDF 다운받기"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">추모록 도서 PDF 다운받기</span>
          </a>
        </div>
      </div>

      {/* Chapter Tabs */}
      <div className="bg-[#36302a] px-3 py-1.5 border-b border-[#C5A059]/10 overflow-x-auto flex gap-1.5 scrollbar-hide flex-shrink-0">
        {bookChapters.map((ch, idx) => (
          <button
            key={ch.id}
            onClick={() => setActiveChapterIndex(idx)}
            className={`flex-shrink-0 px-2.5 py-1 text-xs rounded-lg transition-all duration-200 ${
              activeChapterIndex === idx
                ? 'bg-[#C5A059] text-[#2c2722] font-bold shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-[#463f37]'
            }`}
          >
            {ch.id}. {ch.title.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Book reading pane (Full height scrollable, comfortable reading style) */}
      <div className="flex-1 min-h-0 bg-[#F8FAFC] p-5 sm:p-7 md:p-8 overflow-y-auto select-text text-left shadow-inner">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <span className="inline-block text-[#C5A059] font-mono text-xs sm:text-sm font-bold tracking-widest border-b-2 border-[#C5A059]/40 pb-1 mb-2">
              {activeChapter.chapterNumber}
            </span>
            <h3 className="font-serif text-[#1e293b] font-bold text-xl sm:text-2xl mb-1 leading-snug">
              {activeChapter.title}
            </h3>
            <p className="text-gray-500 font-serif italic text-xs sm:text-sm">
              {activeChapter.subtitle}
            </p>
          </div>
          
          <div 
            style={{ fontSize: `${fontSize}px` }}
            className="text-slate-800 leading-relaxed font-normal whitespace-pre-wrap transition-all duration-150 text-justify border-t border-gray-200/80 pt-5"
          >
            {activeChapter.content}
          </div>
        </div>
      </div>

      {/* Reader Footer Controls */}
      <div className="bg-[#463f37] border-t border-[#C5A059]/20 px-4 sm:px-5 py-2.5 flex items-center justify-between flex-shrink-0">
        <button
          onClick={goPrev}
          disabled={activeChapterIndex === 0}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
            activeChapterIndex === 0
              ? 'text-gray-600 bg-transparent cursor-not-allowed opacity-50'
              : 'text-[#C5A059] hover:bg-[#36302a] border border-[#C5A059]/30 active:scale-95'
          }`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>이전 챕터</span>
        </button>
        
        <span className="text-xs text-gray-300 font-mono font-medium">
          {activeChapterIndex + 1} / {bookChapters.length}
        </span>

        <button
          onClick={goNext}
          disabled={activeChapterIndex === bookChapters.length - 1}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
            activeChapterIndex === bookChapters.length - 1
              ? 'text-gray-600 bg-transparent cursor-not-allowed opacity-50'
              : 'text-[#C5A059] hover:bg-[#36302a] border border-[#C5A059]/30 active:scale-95'
          }`}
        >
          <span>다음 챕터</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

