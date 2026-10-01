import type { Submission } from './data/cardData';

const LOCAL_STORAGE_KEY = 'taekwang_prelearning_submissions';
const API_BASE = '/api/submissions';

// Helper to get local data
const getLocalStorageData = (): Submission[] => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('LocalStorage read error:', err);
    return [];
  }
};

// Helper to set local data
const setLocalStorageData = (data: Submission[]): void => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('LocalStorage write error:', err);
  }
};

export interface APIResponse<T> {
  data: T;
  isLocalStorageOnly: boolean;
}

export const apiService = {
  /**
   * Fetch all submissions
   */
  async getSubmissions(): Promise<APIResponse<Submission[]>> {
    try {
      const response = await fetch(API_BASE, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Server response error');
      
      const serverData = await response.json();
      
      // Keep local storage in sync with server data
      setLocalStorageData(serverData);
      
      return { data: serverData, isLocalStorageOnly: false };
    } catch (error) {
      console.warn('Backend server is offline, falling back to LocalStorage.', error);
      const localData = getLocalStorageData();
      return { data: localData, isLocalStorageOnly: true };
    }
  },

  /**
   * Add a new submission
   */
  async addSubmission(
    submission: Omit<Submission, 'id' | 'submittedAt' | 'fileName'>
  ): Promise<APIResponse<Submission>> {
    // Generate timestamps & identifiers
    const id = 'sub_' + Math.random().toString(36).substr(2, 9);
    
    // Formatting date as YYYY-MM-DD HH:MM:SS
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const submittedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    // Formatting filename: 부서_성명_유형.pdf
    const cleanDept = submission.department.replace(/\s+/g, '');
    const cleanName = submission.name.replace(/\s+/g, '');
    const typeLabel = submission.cardType ? submission.cardType.split(' ')[0] : '선행과제';
    const fileName = `${cleanDept}_${cleanName}_${typeLabel}.pdf`;

    const fullSubmission: Submission = {
      ...submission,
      id,
      submittedAt,
      fileName
    };

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullSubmission)
      });

      if (!response.ok) throw new Error('Server response error');

      const serverData = await response.json();
      
      // Update local storage
      const localList = getLocalStorageData();
      localList.unshift(serverData);
      setLocalStorageData(localList);

      return { data: serverData, isLocalStorageOnly: false };
    } catch (error) {
      console.warn('Backend server offline during submission. Saving to LocalStorage.', error);
      
      const localList = getLocalStorageData();
      localList.unshift(fullSubmission);
      setLocalStorageData(localList);

      return { data: fullSubmission, isLocalStorageOnly: true };
    }
  },

  /**
   * Delete a submission
   */
  async deleteSubmission(id: string): Promise<APIResponse<boolean>> {
    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Server response error');

      // Update local storage
      const localList = getLocalStorageData().filter(item => item.id !== id);
      setLocalStorageData(localList);

      return { data: true, isLocalStorageOnly: false };
    } catch (error) {
      console.warn('Backend server offline during delete. Updating LocalStorage.', error);
      
      const localList = getLocalStorageData().filter(item => item.id !== id);
      setLocalStorageData(localList);

      return { data: true, isLocalStorageOnly: true };
    }
  },

  /**
   * Clear all submissions
   */
  async clearAllSubmissions(): Promise<APIResponse<boolean>> {
    try {
      const response = await fetch(API_BASE, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Server response error');

      setLocalStorageData([]);
      return { data: true, isLocalStorageOnly: false };
    } catch (error) {
      console.warn('Backend server offline during clear. Emptying LocalStorage.', error);
      setLocalStorageData([]);
      return { data: true, isLocalStorageOnly: true };
    }
  },

  /**
   * Check SMS Service Configuration Status
   */
  async getSMSStatus(): Promise<{ isConfigured: boolean; senderPhone: string; apiKeyMasked: string }> {
    try {
      const res = await fetch('/api/sms/status');
      if (!res.ok) throw new Error('SMS status check failed');
      return await res.json();
    } catch {
      return { isConfigured: false, senderPhone: '미설정', apiKeyMasked: '오프라인' };
    }
  },

  /**
   * Save SMS Configuration (API Key, Secret, Sender Phone)
   */
  async saveSMSConfig(config: { apiKey: string; apiSecret: string; senderPhone: string }): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    status?: { isConfigured: boolean; senderPhone: string; apiKeyMasked: string };
  }> {
    try {
      const res = await fetch('/api/sms/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '설정 저장에 실패했습니다.');
      return data;
    } catch (err: unknown) {
      console.error('Save SMS Config Error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : '설정 저장 중 오류가 발생했습니다.'
      };
    }
  },

  /**
   * Send SMS / LMS via Solapi REST API
   */
  async sendSMS(payload: {
    recipients: { name: string; phone: string }[];
    text: string;
  }): Promise<{
    success: boolean;
    simulation?: boolean;
    totalCount?: number;
    successCount?: number;
    failedCount?: number;
    sender?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '문자 발송에 실패했습니다.');
      }
      return data;
    } catch (err: unknown) {
      console.error('SMS Send API Error:', err);
      const errorMsg = err instanceof Error ? err.message : '문자 발송 중 오류가 발생했습니다.';
      return {
        success: false,
        error: errorMsg
      };
    }
  }
};
