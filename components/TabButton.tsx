import React from 'react';

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm md:text-base font-medium rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-sky-50 dark:focus:ring-offset-slate-900
        ${
          isActive
            ? 'bg-sky-500 text-white shadow-md'
            : 'bg-white text-slate-600 hover:bg-sky-100 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-sky-300'
        }`}
    >
      {label}
    </button>
  );
};

export default TabButton;