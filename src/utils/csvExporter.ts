import type { Submission } from '../data/cardData';

export const exportSubmissionsToCSV = (submissions: Submission[]) => {
  if (!submissions || submissions.length === 0) return;

  // Define CSV headers
  const headers = [
    '성명',
    '회사/소속부서',
    '휴대전화',
    '이메일',
    '과제 수행 유형',
    '산출 파일명',
    '제출 일시',
    '문항 1 답변',
    '문항 2 답변'
  ];

  // Map rows
  const rows = submissions.map(sub => {
    // Fetch answers in order
    const qIds = sub.questions.map(q => q.id);
    const ans1 = sub.answers[qIds[0]] || '';
    const ans2 = sub.answers[qIds[1]] || '';

    // Escape quotes for CSV safety
    const escapeCSV = (val: string) => {
      if (val === null || val === undefined) return '';
      const formatted = val.toString().replace(/"/g, '""');
      return formatted.includes(',') || formatted.includes('"') || formatted.includes('\n')
        ? `"${formatted}"`
        : formatted;
    };

    return [
      escapeCSV(sub.name),
      escapeCSV(sub.department),
      escapeCSV(sub.phone || ''),
      escapeCSV(sub.email || ''),
      escapeCSV(sub.cardType || ''),
      escapeCSV(sub.fileName),
      escapeCSV(sub.submittedAt),
      escapeCSV(ans1),
      escapeCSV(ans2)
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\r\n');

  // Prefix with UTF-8 BOM (\uFEFF) to prevent Korean character corruption in Excel
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Trigger file download
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate descriptive filename with current date
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `창업주경영철학_선행학습제출현황_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
