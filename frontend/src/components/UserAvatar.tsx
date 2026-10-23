import { useState } from 'react';

type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  label?: string;
};

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'NX';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function UserAvatar({ name, avatarUrl, className = '', label }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const accessibleProps = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const };

  if (avatarUrl && !failed) {
    return (
      <span className={`avatar avatar-image ${className}`.trim()} {...accessibleProps}>
        <img src={avatarUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
      </span>
    );
  }

  return (
    <span className={`avatar ${className}`.trim()} {...accessibleProps}>
      {initials(name)}
    </span>
  );
}
