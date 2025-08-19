import React from 'react';
import './FavoriteButton.css';

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  size?: 'small' | 'medium' | 'large';
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  isFavorite,
  onToggle,
  size = 'medium'
}) => {
  return (
    <button
      className={`favorite-button ${size} ${isFavorite ? 'favorited' : ''}`}
      onClick={onToggle}
      aria-label={isFavorite ? '즐겨찾기에서 제거' : '즐겨찾기에 추가'}
      title={isFavorite ? '즐겨찾기에서 제거' : '즐겨찾기에 추가'}
    >
      {isFavorite ? '★' : '☆'}
    </button>
  );
};
