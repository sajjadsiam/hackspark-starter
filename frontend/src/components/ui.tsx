'use client';

export function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="skeleton h-4 w-3/4 rounded-lg" />
      <div className="skeleton h-3 w-1/2 rounded-lg" />
      <div className="skeleton h-3 w-full rounded-lg" />
      <div className="skeleton h-8 w-24 rounded-lg mt-4" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 glass rounded-xl">
      <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-2 w-1/2 rounded" />
      </div>
    </div>
  );
}

interface CategoryBadgeProps {
  category: string;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const cls = `badge-${category.toLowerCase()}`;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls || 'badge-default'}`}>
      {category}
    </span>
  );
}

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="glass rounded-2xl p-8 text-center space-y-4">
      <div className="text-4xl">⚠️</div>
      <p className="text-red-400 font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-all"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
}

export function EmptyState({ title, description, icon = '📭' }: EmptyStateProps) {
  return (
    <div className="glass rounded-2xl p-12 text-center space-y-3">
      <div className="text-5xl">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-200">{title}</h3>
      {description && <p className="text-gray-500 text-sm">{description}</p>}
    </div>
  );
}
