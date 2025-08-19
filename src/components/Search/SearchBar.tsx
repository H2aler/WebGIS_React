import React, { useState, useCallback, useEffect, useRef } from 'react';
import { SearchResult } from '../../types';
import './SearchBar.css';

interface SearchBarProps {
  onLocationSelect: (lat: number, lon: number, name: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onLocationSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // 검색 실행
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error('검색에 실패했습니다.');
      }

      const data = await response.json();
      setResults(data);
      setShowResults(true);
      setSelectedIndex(-1);
    } catch (err) {
      setError('검색 중 오류가 발생했습니다.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 검색어 변경 시 디바운스
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
      setShowResults(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  // 검색 버튼 클릭
  const handleSearch = useCallback(() => {
    if (query.trim()) {
      performSearch(query);
    }
  }, [query, performSearch]);

  // 검색 결과 클릭
  const handleResultClick = useCallback((result: SearchResult) => {
    onLocationSelect(parseFloat(result.lat), parseFloat(result.lon), result.display_name);
    setQuery(result.display_name.split(',')[0]);
    clearSearchResults();
    setSelectedIndex(-1);
  }, [onLocationSelect]);

  // 검색 결과 초기화
  const clearSearchResults = useCallback(() => {
    setResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
  }, []);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showResults) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        } else if (query.trim()) {
          handleSearch();
        }
        break;
      case 'Escape':
        clearSearchResults();
        break;
    }
  }, [showResults, results, selectedIndex, query, handleResultClick, handleSearch, clearSearchResults]);

  // 외부 클릭 시 결과 숨기기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        clearSearchResults();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSearchResults]);

  return (
    <div className="search-container" ref={resultsRef}>
      <div className="search-input-container">
        <input
          type="text"
          className="search-input"
          placeholder="도시나 나라를 검색하세요..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true);
            }
          }}
        />
        <button
          className="search-button"
          onClick={handleSearch}
          disabled={isLoading}
          title="검색"
        >
          {isLoading ? '⏳' : '🔍'}
        </button>
      </div>

      {/* 검색 결과 */}
      {showResults && (
        <div className="search-results">
          {error && (
            <div className="search-error">
              {error}
            </div>
          )}
          
          {results.length === 0 && !isLoading && !error && (
            <div className="no-results">
              검색 결과가 없습니다.
            </div>
          )}
          
          {results.map((result, index) => {
            const name = result.display_name.split(',')[0];
            const details = result.display_name.split(',').slice(1, 3).join(',');
            
            return (
              <div
                key={index}
                className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleResultClick(result)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="result-content">
                  <div className="result-name">{name}</div>
                  <div className="result-details">{details}</div>
                </div>
                <div className="result-actions">
                  <button
                    className="favorite-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // 즐겨찾기 추가 로직
                    }}
                    title="즐겨찾기 추가"
                  >
                    ⭐
                  </button>
                  <button
                    className="measure-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // 측정 시작 로직
                    }}
                    title="거리 측정 시작"
                  >
                    📏
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
