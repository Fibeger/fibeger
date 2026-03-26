import { cn } from '@/lib/utils';
import { CSSProperties } from 'react';

interface UserAvatarProps {
  src?: string | null;
  username: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  themeColor?: string | null;
  style?: CSSProperties;
}

const sizeMap = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
  '2xl': 'w-32 h-32 text-4xl sm:w-40 sm:h-40',
};

export default function UserAvatar({ src, username, size = 'md', className, themeColor, style }: UserAvatarProps) {
  const sizeClass = sizeMap[size];

  if (src) {
    return (
      <img
        src={src}
        alt={username}
        className={cn('rounded-full object-cover flex-shrink-0', sizeClass, className)}
        style={style}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white',
        sizeClass,
        className
      )}
      style={{ backgroundColor: themeColor || '#5865f2', ...style }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
