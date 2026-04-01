// Cache for memory data
let memoryCache: {
  data: any[];
  timestamp: number;
  ttl: number;
} | null = null;

export function getMemoryCache() {
  if (memoryCache && Date.now() - memoryCache.timestamp < memoryCache.ttl) {
    return memoryCache.data;
  }
  return null;
}

export function setMemoryCache(data: any[], ttl: number = 60000) {
  memoryCache = {
    data,
    timestamp: Date.now(),
    ttl
  };
}

export function clearMemoryCache() {
  memoryCache = null;
}

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle utility
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}