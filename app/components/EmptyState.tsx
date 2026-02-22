import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-20">
      {icon && <div className="text-6xl mb-4">{icon}</div>}
      <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      {description && (
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} className="app-btn-primary">
          {action.label}
        </Button>
      )}
    </div>
  );
}
