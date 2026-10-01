// @ts-ignore
import html2pdf from 'html2pdf.js';
import type { Submission } from '../data/cardData';
import { TAEKWANG_LOGO_BASE64, HEUNGKUK_LOGO_BASE64 } from '../assets/logos';

export const generateSubmissionPDF = (submission: Submission) => {
  // Create an offscreen container to render the PDF content
  const element = document.createElement('div');
  element.className = 'pdf-container';
  element.style.padding = '40px';
  element.style.backgroundColor = '#ffffff';
  element.style.color = '#1e293b';
  element.style.fontFamily = '"Noto Sans KR", sans-serif';
  element.style.fontSize = '14px';
  element.style.lineHeight = '1.7';

  // Construct HTML content matching the official report layout wireframe
  element.innerHTML = `
    <div style="border: 2px solid #C5A059; padding: 30px; position: relative; background-color: #ffffff;">
      <!-- Watermark/Header Logo -->
      <div style="text-align: center; margin-bottom: 5px;">
        <span style="font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: #8C6A3C; letter-spacing: 4px;">TAEKWANG</span>
      </div>
      
      <h1 style="text-align: center; font-size: 22px; font-weight: 700; color: #2c2722; margin-top: 5px; margin-bottom: 25px; font-family: 'Noto Serif KR', serif; border-bottom: 2px double #C5A059; padding-bottom: 15px;">
        태광그룹 창업주 추모록 선행학습 결과 보고서
      </h1>
      
      <!-- User Info Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
        <tbody>
          <tr>
            <th style="width: 15%; border: 1px solid #d1d5db; background-color: #f8fafc; padding: 9px 10px; text-align: center; font-weight: 600; color: #475569;">성 명</th>
            <td style="width: 35%; border: 1px solid #d1d5db; padding: 9px 10px; color: #1e293b;">${submission.name}</td>
            <th style="width: 15%; border: 1px solid #d1d5db; background-color: #f8fafc; padding: 9px 10px; text-align: center; font-weight: 600; color: #475569;">소 속</th>
            <td style="width: 35%; border: 1px solid #d1d5db; padding: 9px 10px; color: #1e293b;">${submission.department}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #d1d5db; background-color: #f8fafc; padding: 9px 10px; text-align: center; font-weight: 600; color: #475569;">수행 유형</th>
            <td style="border: 1px solid #d1d5db; padding: 9px 10px; color: #1e293b; font-weight: 600;">${submission.cardType || '과제 카드'}</td>
            <th style="border: 1px solid #d1d5db; background-color: #f8fafc; padding: 9px 10px; text-align: center; font-weight: 600; color: #475569;">휴대전화</th>
            <td style="border: 1px solid #d1d5db; padding: 9px 10px; color: #1e293b; font-family: monospace;">${submission.phone || '-'}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #d1d5db; background-color: #f8fafc; padding: 9px 10px; text-align: center; font-weight: 600; color: #475569;">제출 일시</th>
            <td style="border: 1px solid #d1d5db; padding: 9px 10px; color: #64748b;">${submission.submittedAt}</td>
            <th style="border: 1px solid #d1d5db; background-color: #f8fafc; padding: 9px 10px; text-align: center; font-weight: 600; color: #475569;">이메일</th>
            <td style="border: 1px solid #d1d5db; padding: 9px 10px; color: #64748b;">${submission.email || '-'}</td>
          </tr>
        </tbody>
      </table>
      
      <!-- Reflections Area -->
      <div style="margin-bottom: 30px;">
        ${submission.questions.map((q, idx) => {
          const answer = submission.answers[q.id] || '';
          return `
            <div style="margin-bottom: 25px; page-break-inside: avoid;">
              <div style="font-weight: 700; font-size: 14px; color: #1e293b; margin-bottom: 8px; font-family: 'Noto Serif KR', serif; display: flex;">
                <span style="color: #C5A059; margin-right: 5px;">[문항 ${idx + 1}]</span> 
                <span>${q.question}</span>
              </div>
              <div style="border-left: 3px solid #C5A059; padding-left: 15px; margin-left: 5px; color: #334155; font-size: 13.5px; white-space: pre-wrap; line-height: 1.8; text-align: justify; background-color: #fdfbf7; padding-top: 12px; padding-bottom: 12px; padding-right: 12px;">${answer}</div>
            </div>
          `;
        }).join('')}
      </div>
      
      <!-- Footer Certification with Dual CI Logos inside Gold Border -->
      <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
        
        <!-- Dual Logos: 태광 & 흥국 CI (하단 골드라인 안쪽) -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 30px; margin-bottom: 15px;">
          <img src="${TAEKWANG_LOGO_BASE64}" alt="태광그룹" style="height: 32px; max-width: 170px; object-fit: contain;" />
          <div style="width: 1px; height: 26px; background-color: #cbd5e1;"></div>
          <img src="${HEUNGKUK_LOGO_BASE64}" alt="흥국금융그룹" style="height: 30px; max-width: 180px; object-fit: contain;" />
        </div>

        <div style="font-size: 13px; font-weight: bold; color: #463f37; font-family: 'Noto Serif KR', serif; letter-spacing: 1px;">
          태광그룹 인재개발원 | 창업주 추모록 선행학습 인증 리포트
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 4px; font-family: 'Playfair Display', serif; letter-spacing: 2px;">
          OFFICIAL PRE-LEARNING REPORT
        </div>
      </div>
    </div>
  `;

  // Define configuration options for html2pdf
  const opt = {
    margin: [10, 10, 10, 10],
    filename: submission.fileName || `${submission.department.replace(/\s+/g, '')}_${submission.name.replace(/\s+/g, '')}_${submission.cardType ? submission.cardType.split(' ')[0] : '선행과제'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  } as any;

  // Convert elements and save PDF
  html2pdf().set(opt).from(element).save();
};
