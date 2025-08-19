import { useState, useEffect, useCallback } from 'react';
import { Favorite } from '../types';

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  // 로컬 스토리지에서 즐겨찾기 로드
  useEffect(() => {
    const savedFavorites = localStorage.getItem('webgis-favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (error) {
        console.error('즐겨찾기 로드 오류:', error);
        setFavorites([]);
      }
    }
  }, []);

  // 즐겨찾기 저장
  const saveFavorites = useCallback((newFavorites: Favorite[]) => {
    localStorage.setItem('webgis-favorites', JSON.stringify(newFavorites));
  }, []);

  // 즐겨찾기 추가
  const addFavorite = useCallback((name: string, lat: number, lon: number) => {
    const newFavorite: Favorite = {
      id: Date.now().toString(),
      name,
      lat,
      lon,
      addedAt: new Date().toISOString()
    };

    const updatedFavorites = [...favorites, newFavorite];
    setFavorites(updatedFavorites);
    saveFavorites(updatedFavorites);
  }, [favorites, saveFavorites]);

  // 즐겨찾기 삭제
  const removeFavorite = useCallback((id: string) => {
    const updatedFavorites = favorites.filter(fav => fav.id !== id);
    setFavorites(updatedFavorites);
    saveFavorites(updatedFavorites);
  }, [favorites, saveFavorites]);

  // 즐겨찾기 확인
  const isFavorite = useCallback((lat: number, lon: number) => {
    return favorites.some(fav => 
      Math.abs(fav.lat - lat) < 0.001 && Math.abs(fav.lon - lon) < 0.001
    );
  }, [favorites]);

  // 즐겨찾기 토글
  const toggleFavorite = useCallback((name: string, lat: number, lon: number) => {
    const existing = favorites.find(fav => 
      Math.abs(fav.lat - lat) < 0.001 && Math.abs(fav.lon - lon) < 0.001
    );

    if (existing) {
      removeFavorite(existing.id);
    } else {
      addFavorite(name, lat, lon);
    }
  }, [favorites, addFavorite, removeFavorite]);

  // 모든 즐겨찾기 삭제
  const clearFavorites = useCallback(() => {
    setFavorites([]);
    saveFavorites([]);
  }, [saveFavorites]);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    clearFavorites
  };
};
