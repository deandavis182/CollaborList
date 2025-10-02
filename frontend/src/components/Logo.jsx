import React from 'react';

const Logo = ({ size = 'md', showText = true }) => {
  const sizes = {
    sm: { icon: 24, text: 'text-xl' },
    md: { icon: 32, text: 'text-2xl' },
    lg: { icon: 48, text: 'text-4xl' }
  };

  const currentSize = sizes[size] || sizes.md;

  return (
    <div className="flex items-center gap-2">
      {/* Logo Icon - Overlapping squares representing collaboration */}
      <div className="relative" style={{ width: currentSize.icon, height: currentSize.icon }}>
        <div
          className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg transform rotate-6 opacity-80"
          style={{ width: currentSize.icon * 0.75, height: currentSize.icon * 0.75 }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg transform -rotate-3"
          style={{ width: currentSize.icon * 0.75, height: currentSize.icon * 0.75, left: currentSize.icon * 0.25, top: currentSize.icon * 0.25 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            width={currentSize.icon * 0.5}
            height={currentSize.icon * 0.5}
            viewBox="0 0 24 24"
            fill="none"
            className="text-white z-10"
          >
            <path d="M9 11H7a1 1 0 100 2h2a1 1 0 100-2zM17 11h-2a1 1 0 100 2h2a1 1 0 100-2zM13 11h-2a1 1 0 100 2h2a1 1 0 100-2z" fill="currentColor"/>
            <path d="M21 6a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1h16a1 1 0 001-1V6zM5 7h14v10H5V7z" fill="currentColor"/>
          </svg>
        </div>
      </div>

      {showText && (
        <div className={`font-bold ${currentSize.text}`}>
          <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Collabor
          </span>
          <span className="text-gray-800">List</span>
        </div>
      )}
    </div>
  );
};

export default Logo;