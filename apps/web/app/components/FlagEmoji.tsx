'use client';

import { useEffect, useRef } from 'react';
import twemoji from 'twemoji';

interface FlagEmojiProps {
  countryCode: string | null;
  className?: string;
  title?: string;
}

export default function FlagEmoji({ countryCode, className = '', title = '' }: FlagEmojiProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  const getCountryFlag = (code: string | null): string => {
    if (!code || code.trim() === '') return '';
    
    const upperCode = code.toUpperCase().trim();
    
    // Validate 2-letter country code
    if (upperCode.length !== 2 || !/^[A-Z]{2}$/.test(upperCode)) {
      return '🏳️'; // Neutral flag fallback
    }
    
    try {
      // Convert country code to flag emoji using regional indicator symbols
      const codePoints = upperCode.split('').map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch (error) {
      console.error('Error converting country code to flag:', code, error);
      return '🏳️';
    }
  };

  useEffect(() => {
    if (containerRef.current && countryCode) {
      // Parse emoji and convert to Twemoji images
      twemoji.parse(containerRef.current, {
        folder: 'svg',
        ext: '.svg',
        base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
      });
    }
  }, [countryCode]);

  const flag = getCountryFlag(countryCode);

  if (!flag) return null;

  return (
    <span 
      ref={containerRef}
      className={className}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {flag}
    </span>
  );
}
