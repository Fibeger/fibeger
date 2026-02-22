import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';
  className?: string;
}

const maxWidthMap = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

export default function PageContainer({ children, maxWidth = '4xl', className }: PageContainerProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className={cn('mx-auto px-4 py-6', maxWidthMap[maxWidth], className)}>
        {children}
      </div>
    </div>
  );
}
