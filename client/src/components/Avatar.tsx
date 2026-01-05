import React from 'react';
import { SOCKET_URL } from '../services/api';

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
      // If SOCKET_URL is '/', we don't want '//path' (which is protocol-relative URL to domain 'path')
      const base = SOCKET_URL === '/' ? '' : SOCKET_URL;
      src = `${base}${srcPath}`;
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
