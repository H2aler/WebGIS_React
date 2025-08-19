import React from 'react';
import { Theme } from '../../types';
import './ThemeToggle.css';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      title={theme === 'light' ? '다크모드로 전환' : '라이트모드로 전환'}
      aria-label={theme === 'light' ? '다크모드로 전환' : '라이트모드로 전환'}
    >
      <span className="theme-icon">
        {theme === 'light' ? '🌙' : '☀️'}
      </span>
    </button>
  );
};
