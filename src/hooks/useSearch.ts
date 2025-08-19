import { useState, useCallback } from 'react';
import { SearchResult } from '../types';

export const useSearch = () => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 검색 실행
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 검색 시작:', query);

      // Nominatim API를 사용한 지오코딩
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=kr,jp,cn,us,gb,fr,de,it,es,ca,au`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WebGIS-Application/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`검색 요청 실패: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📋 검색 결과:', data);
      
      setSearchResults(data);
    } catch (error) {
      console.error('❌ 검색 오류:', error);
      setError(`검색 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 검색 결과 초기화
  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
    setError(null);
  }, []);

  return {
    searchResults,
    isLoading,
    error,
    performSearch,
    clearSearchResults
  };
};
