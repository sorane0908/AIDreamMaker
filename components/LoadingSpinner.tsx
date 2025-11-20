import React from 'react';

const LoadingSpinner: React.FC<{ message?: string }> = ({ message = '魔法を紡いでいます...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white/50 rounded-lg backdrop-blur-sm">
      <div className="w-12 h-12 border-4 border-t-sky-500 border-r-sky-500 border-b-sky-500 border-l-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-lg text-slate-700 font-serif">{message}</p>
    </div>
  );
};

export default LoadingSpinner;