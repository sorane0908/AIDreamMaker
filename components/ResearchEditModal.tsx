import React, { useState, useEffect } from 'react';
import type { ResearchResult } from '../types';

interface ResearchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newText: string) => void;
  researchResult: ResearchResult | null;
  topicName: string;
}

const ResearchEditModal: React.FC<ResearchEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  researchResult,
  topicName,
}) => {
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    if (researchResult) {
      setEditedText(researchResult.text);
    }
  }, [researchResult]);

  if (!isOpen || !researchResult) {
    return null;
  }

  const handleSave = () => {
    onSave(editedText);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col dark:bg-slate-800 dark:border dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b dark:border-slate-700">
          <h2 className="text-xl font-bold text-sky-800 font-serif dark:text-sky-400">リサーチ結果の確認・編集</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">トピック: {topicName}</p>
        </header>
        <main className="p-6 overflow-y-auto flex-grow">
          <p className="text-sm text-slate-600 mb-4 dark:text-slate-300">
            AIが物語を生成する際に使用する情報です。不要な部分を削除したり、内容を修正したりすることで、トークンを節約し、より意図に沿った物語を生成できます。
          </p>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full h-72 p-3 bg-slate-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-400 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400"
            aria-label="リサーチ結果編集エリア"
          />
          {researchResult.sources.length > 0 && (
            <div className="mt-4">
              <h3 className="text-md font-bold text-slate-700 dark:text-slate-300">情報源</h3>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm max-h-32 overflow-y-auto bg-slate-50 p-2 rounded-md dark:bg-slate-700 dark:text-slate-300">
                {researchResult.sources.map((source, index) => (
                  <li key={index}>
                    <a
                      href={source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:underline dark:text-sky-400"
                      title={source.uri}
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>
        <footer className="p-4 border-t flex justify-end gap-2 bg-slate-50/50 rounded-b-lg dark:bg-slate-900/50 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
          >
            保存して閉じる
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ResearchEditModal;