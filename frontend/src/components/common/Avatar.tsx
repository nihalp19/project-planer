import { getAvatarColor, getInitials } from '@/utils/avatarUtils';

interface AvatarProps {
  user: {
    _id?: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar = ({ user, size = 'md', className = '' }: AvatarProps) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const baseClasses = `${sizeClasses[size]} rounded-full flex items-center justify-center font-medium flex-shrink-0 ${className}`;

  // If user has avatar (Google login), show image
  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        className={`${baseClasses} object-cover`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Fallback: colored circle with initials
  const colorClass = getAvatarColor(user._id || user.email || user.name);
  const initials = getInitials(user.name);

  return (
    <div className={`${baseClasses} ${colorClass} text-white`}>
      {initials}
    </div>
  );
};

