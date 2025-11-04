export const QUOTA_CONSTANTS = {
  FREE_MESSAGES_PER_DAY: 540,
  RESET_HOUR: 0, // Reset at midnight
};

interface QuotaData {
  usedMessages: number;
  lastResetDate: string;
  paidMessages: number; // New: track paid messages separately
}

const QUOTA_STORAGE_KEY = 'ai_content_quota';

// Get current quota data from localStorage
const getQuotaData = (): QuotaData => {
  try {
    const stored = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return {
        usedMessages: data.usedMessages || 0,
        lastResetDate: data.lastResetDate || new Date().toDateString(),
        paidMessages: data.paidMessages || 0,
      };
    }
  } catch (error) {
    console.error('Error reading quota data:', error);
  }
  
  return {
    usedMessages: 0,
    lastResetDate: new Date().toDateString(),
    paidMessages: 0,
  };
};

// Save quota data to localStorage
const saveQuotaData = (data: QuotaData): void => {
  try {
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving quota data:', error);
  }
};

// Check if quota should be reset (daily reset)
const shouldResetQuota = (lastResetDate: string): boolean => {
  const today = new Date().toDateString();
  return lastResetDate !== today;
};

// Reset quota if needed
const resetQuotaIfNeeded = (): QuotaData => {
  const data = getQuotaData();
  
  if (shouldResetQuota(data.lastResetDate)) {
    const resetData: QuotaData = {
      usedMessages: 0,
      lastResetDate: new Date().toDateString(),
      paidMessages: data.paidMessages, // Keep paid messages
    };
    saveQuotaData(resetData);
    return resetData;
  }
  
  return data;
};

// Get remaining messages (free + paid)
export const getRemainingMessages = (): number => {
  const data = resetQuotaIfNeeded();
  const totalAvailable = QUOTA_CONSTANTS.FREE_MESSAGES_PER_DAY + data.paidMessages;
  return Math.max(0, totalAvailable - data.usedMessages);
};

// Check if quota is exceeded
export const isQuotaExceeded = (): boolean => {
  return getRemainingMessages() <= 0;
};

// Increment quota usage (prioritize free messages first)
export const incrementQuota = (): boolean => {
  if (isQuotaExceeded()) {
    return false;
  }
  
  const data = resetQuotaIfNeeded();
  
  // Use free messages first, then paid messages
  if (data.usedMessages < QUOTA_CONSTANTS.FREE_MESSAGES_PER_DAY) {
    // Still have free messages available
    data.usedMessages += 1;
  } else {
    // Free messages exhausted, use paid messages
    data.usedMessages += 1;
  }
  
  saveQuotaData(data);
  return true;
};

// Add paid messages to quota
export const addPaidMessages = (messages: number): void => {
  const data = resetQuotaIfNeeded();
  data.paidMessages += messages;
  saveQuotaData(data);
};

// Get time until quota resets
export const formatTimeUntilReset = (): string => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(QUOTA_CONSTANTS.RESET_HOUR, 0, 0, 0);
  
  const diff = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${hours}h ${minutes}m ${seconds}s`;
};

// Get quota breakdown for display
export const getQuotaBreakdown = () => {
  const data = resetQuotaIfNeeded();
  const freeRemaining = Math.max(0, QUOTA_CONSTANTS.FREE_MESSAGES_PER_DAY - data.usedMessages);
  const paidRemaining = Math.max(0, data.paidMessages - Math.max(0, data.usedMessages - QUOTA_CONSTANTS.FREE_MESSAGES_PER_DAY));
  
  return {
    freeRemaining,
    paidRemaining,
    totalRemaining: freeRemaining + paidRemaining,
    usedMessages: data.usedMessages,
    paidMessages: data.paidMessages,
  };
};