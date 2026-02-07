import React from 'react';

type Props = {
  srcPath?: string | null;
  username?: string;
  size?: number; // px
  className?: string;
};

export const Avatar: React.FC<Props> = ({ srcPath, username = '', size = 40, className = '' }) => {
  let src = null;
  if (srcPath) {
    if (srcPath.startsWith('http') || srcPath.startsWith('data:')) {
      src = srcPath;
    } else {
      // Assuming srcPath is relative to public folder or we just use it as is
      src = srcPath;
    }
  }

  const initial = String(username || '').charAt(0).toUpperCase();
  const style = { width: size, height: size } as React.CSSProperties;

  return src ? (
    <img src={src} alt="avatar" style={style} className={`rounded-full object-cover border ${className}`} />
  ) : (
    <div style={style} className={`rounded-full bg-gray-200 flex items-center justify-center text-sm text-gray-600 ${className}`}>{initial}</div>
  );
};

export default Avatar;
