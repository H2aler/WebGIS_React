import React from 'react';
import { Favorite } from '../../types';
import { FavoriteButton } from './FavoriteButton';
import './FavoritesList.css';

interface FavoritesListProps {
  favorites: Favorite[];
  onFavoriteClick: (lat: number, lon: number) => void;
  onFavoriteRemove: (id: string) => void;
  onClearAll: () => void;
}

export const FavoritesList: React.FC<FavoritesListProps> = ({
  favorites,
  onFavoriteClick,
  onFavoriteRemove,
  onClearAll
}) => {
  if (favorites.length === 0) {
    return (
      <div className="favorites-list empty">
        <div className="empty-state">
          <span className="empty-icon">⭐</span>
          <p>즐겨찾기된 위치가 없습니다.</p>
          <p className="empty-hint">검색 결과에서 ⭐ 버튼을 클릭하여 즐겨찾기에 추가하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="favorites-list">
      <div className="favorites-header">
        <h3>즐겨찾기 ({favorites.length})</h3>
        <button
          className="clear-all-button"
          onClick={onClearAll}
          title="모든 즐겨찾기 삭제"
        >
          🗑️ 전체 삭제
        </button>
      </div>
      
      <div className="favorites-items">
        {favorites.map((favorite) => (
          <div
            key={favorite.id}
            className="favorite-item"
            onClick={() => onFavoriteClick(favorite.lat, favorite.lon)}
          >
            <div className="favorite-content">
              <div className="favorite-name">{favorite.name}</div>
              <div className="favorite-coordinates">
                {favorite.lat.toFixed(4)}, {favorite.lon.toFixed(4)}
              </div>
              <div className="favorite-time">
                {new Date(favorite.addedAt).toLocaleDateString()}
              </div>
            </div>
            <div className="favorite-actions">
              <FavoriteButton
                isFavorite={true}
                onToggle={() => onFavoriteRemove(favorite.id)}
                size="small"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
