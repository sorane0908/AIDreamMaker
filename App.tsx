import React, { useState, useId, useRef, useEffect } from 'react';
import { Tab } from './constants';
import TabButton from './components/TabButton';
import LoadingSpinner from './components/LoadingSpinner';
import ResearchEditModal from './components/ResearchEditModal';
import { SparklesIcon, DownloadIcon, UploadIcon, KeyIcon, ChevronDoubleDownIcon, PencilIcon, TrashIcon, XMarkIcon, Bars3Icon } from './components/icons';
import { researchWithGoogle, continueStory, rewriteStory, fleshOutCharacter, suggestNextDevelopments } from './services/geminiService';
import type { Character, ResearchResult, ExportedSettings, StoryLength, StoryGenerationResult, StoryModel, AppState } from './types';

const APP_STATE_STORAGE_KEY = 'yume-novel-maker-state';
const defaultCharacter: Character = { id: 'initial', name: '', gender: '', age: '', ability: '', personality: '', isOriginal: true, freeText: '' };

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Settings);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // User-managed API Key State
  const [apiKey, setApiKey] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');


  // Settings State
  const [storyDirection, setStoryDirection] = useState('');
  const [storyLength, setStoryLength] = useState<StoryLength>('normal');
  const [characters, setCharacters] = useState<Character[]>([defaultCharacter]);
  const [prologue, setPrologue] = useState('');
  const [selectedModel, setSelectedModel] = useState<StoryModel>('gemini-2.5-flash');
  const [historyLookbackCount, setHistoryLookbackCount] = useState<number>(4);
  const [thinkingBudget, setThinkingBudget] = useState<number>(0);

  const [researchSourceTopic, setResearchSourceTopic] = useState('');
  const [researchSourceResult, setResearchSourceResult] = useState<ResearchResult | null>(null);

  const [researchCharacterTopic1, setResearchCharacterTopic1] = useState('');
  const [researchCharacterResult1, setResearchCharacterResult1] = useState<ResearchResult | null>(null);
  const [researchCharacterTopic2, setResearchCharacterTopic2] = useState('');
  const [researchCharacterResult2, setResearchCharacterResult2] = useState<ResearchResult | null>(null);
  
  const [researching, setResearching] = useState<'source' | 'character1' | 'character2' | null>(null);
  const [editingResearchType, setEditingResearchType] = useState<'source' | 'character1' | 'character2' | null>(null);


  // Story State
  const [storyHistory, setStoryHistory] = useState<string[]>([]);
  const [userDirective, setUserDirective] = useState('');
  const [isEditingLastSegment, setIsEditingLastSegment] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Delete/Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMultiDeleteMode, setIsMultiDeleteMode] = useState(false);
  const [multiDeleteStartIndex, setMultiDeleteStartIndex] = useState<number | null>(null);


  // UI State
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);


  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);

  // Load state from localStorage on initial mount
  useEffect(() => {
    // API Key
    const storedApiKey = localStorage.getItem('gemini-api-key');
    if (storedApiKey) {
        setApiKey(storedApiKey);
        setTempApiKey(storedApiKey);
    }

    // App State
    const savedStateJSON = localStorage.getItem(APP_STATE_STORAGE_KEY);
    if (savedStateJSON) {
      try {
        const savedState: AppState = JSON.parse(savedStateJSON);
        setStoryDirection(savedState.storyDirection || '');
        setStoryLength(savedState.storyLength || 'normal');
        setCharacters(savedState.characters && savedState.characters.length > 0 ? savedState.characters : [defaultCharacter]);
        setPrologue(savedState.prologue || '');
        setSelectedModel(savedState.selectedModel || 'gemini-2.5-flash');
        setHistoryLookbackCount(savedState.historyLookbackCount || 4);
        setThinkingBudget(savedState.thinkingBudget || 0);
        setResearchSourceTopic(savedState.researchSourceTopic || '');
        setResearchSourceResult(savedState.researchSourceResult || null);
        setResearchCharacterTopic1(savedState.researchCharacterTopic1 || '');
        setResearchCharacterResult1(savedState.researchCharacterResult1 || null);
        setResearchCharacterTopic2(savedState.researchCharacterTopic2 || '');
        setResearchCharacterResult2(savedState.researchCharacterResult2 || null);
        setStoryHistory(savedState.storyHistory || []);
        setActiveTab(savedState.activeTab || Tab.Settings);
      } catch (e) {
        console.error("Failed to load saved state from localStorage", e);
        localStorage.removeItem(APP_STATE_STORAGE_KEY);
      }
    }
    
    // Use timeout to prevent saving on initial render before state is fully loaded
    setTimeout(() => {
      isInitialMount.current = false;
    }, 100);

  }, []);
  
  // Auto-save state to localStorage whenever it changes
  useEffect(() => {
      if (isInitialMount.current) {
          return;
      }
      const appState: AppState = {
          storyDirection,
          storyLength,
          characters,
          prologue,
          selectedModel,
          historyLookbackCount,
          thinkingBudget,
          researchSourceTopic,
          researchSourceResult,
          researchCharacterTopic1,
          researchCharacterResult1,
          researchCharacterTopic2,
          researchCharacterResult2,
          storyHistory,
          activeTab,
      };
      localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(appState));
  }, [
      storyDirection, storyLength, characters, prologue, selectedModel,
      historyLookbackCount, thinkingBudget, researchSourceTopic, researchSourceResult,
      researchCharacterTopic1, researchCharacterResult1, researchCharacterTopic2,
      researchCharacterResult2, storyHistory, activeTab
  ]);


  // Scroll button visibility
  useEffect(() => {
    const checkScrollPosition = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const scrollTop = window.scrollY;

      if (scrollHeight > clientHeight && scrollTop < scrollHeight - clientHeight - 100) {
        setShowScrollToBottomButton(true);
      } else {
        setShowScrollToBottomButton(false);
      }
    };

    window.addEventListener('scroll', checkScrollPosition);
    checkScrollPosition(); // Initial check

    return () => window.removeEventListener('scroll', checkScrollPosition);
  }, []);

  // Auto-scroll to bottom when switching to story tab
  useEffect(() => {
    if (activeTab === Tab.Story && storyHistory.length > 0 && !isMultiDeleteMode) {
      // Use a timeout to ensure the DOM has been updated before scrolling
      const timer = setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, isMultiDeleteMode]); // Added isMultiDeleteMode so we don't auto scroll while deleting

  const handleScrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
  };

  const handleSaveApiKey = () => {
    setApiKey(tempApiKey);
    localStorage.setItem('gemini-api-key', tempApiKey);
    alert('APIキーを保存しました。');
  };

  const handleApiCall = async (apiFunction: () => Promise<void>) => {
    if (!apiKey) {
      setError('APIキーが設定されていません。「設定」タブでAPIキーを入力して保存してください。');
      setActiveTab(Tab.Settings);
      return;
    }
    await apiFunction();
  };

  const handleApiError = (e: any, defaultMessage: string) => {
      console.error(e);
      let errorMessage = defaultMessage;
      
      if (e instanceof Error) {
          const lowerCaseMessage = e.message.toLowerCase();

          if (lowerCaseMessage.includes('api key not valid')) {
              errorMessage = "APIキーが正しくないようです。「設定」タブでAPIキーが正しく入力されているか、有効期限が切れていないか確認してください。";
          } else if (lowerCaseMessage.includes('quota')) {
              errorMessage = "APIの利用上限に達したようです。時間をおいて再度試すか、Googleの利用プランを確認してください。";
          } else if (lowerCaseMessage.includes('400 bad request') || lowerCaseMessage.includes('invalid')) {
              errorMessage = `リクエストが無効です。これは、APIキーが正しくないか、Google AI Studioでウェブサイトのドメイン制限を設定している場合に発生することがあります。設定を確認してください。\n(詳細: ${e.message})`;
          } else if (lowerCaseMessage.includes('fetch') || lowerCaseMessage.includes('network')) {
               errorMessage = `ネットワークエラーが発生しました。インターネット接続を確認してください。もし接続に問題がない場合、広告ブロッカーやセキュリティソフトが通信を妨げているか、デプロイ環境のCORSポリシーが原因の可能性があります。\n(詳細: ${e.message})`;
          } else if (lowerCaseMessage.includes('resource has been exhausted')) {
               errorMessage = `リソースが枯渇しました。一度に多くの処理をしようとしたか、APIの無料枠を使い切った可能性があります。しばらく待ってから再度お試しください。\n(詳細: ${e.message})`;
          } else {
              errorMessage = `予期せぬエラーが発生しました。しばらくしてからもう一度お試しください。\n(エラー詳細: ${e.message})`;
          }
      }
      setError(errorMessage);
  };

  const handleAddCharacter = () => {
    setCharacters([...characters, {
      id: `char-${Date.now()}`, name: '', gender: '', age: '', ability: '', personality: '', isOriginal: true, freeText: ''
    }]);
  };

  const handleRemoveCharacter = (id: string) => {
    if (characters.length > 1) {
      setCharacters(characters.filter(c => c.id !== id));
    }
  };

  const handleCharacterChange = (id: string, field: keyof Omit<Character, 'id'>, value: string | boolean) => {
    setCharacters(characters.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
    
  const handleFleshOutCharacter = async (characterId: string) => {
    const characterToFleshOut = characters.find(c => c.id === characterId);
    if (!characterToFleshOut) return;

    await handleApiCall(async () => {
      setIsLoading(true);
      setLoadingMessage(`${characterToFleshOut.name}の情報をAIが補完しています...`);
      setError(null);

      try {
          let relevantResearchText: string | null = null;
          if (characterToFleshOut.name) {
              const charNameLower = characterToFleshOut.name.toLowerCase();
              if (researchCharacterTopic1.toLowerCase().includes(charNameLower) && researchCharacterResult1) {
                  relevantResearchText = researchCharacterResult1.text;
              } else if (researchCharacterTopic2.toLowerCase().includes(charNameLower) && researchCharacterResult2) {
                  relevantResearchText = researchCharacterResult2.text;
              }
          }
          const researchDataForCharacter = relevantResearchText || researchSourceResult?.text;
          const fleshedOutData = await fleshOutCharacter(apiKey, characterToFleshOut, researchDataForCharacter);

          setCharacters(characters.map(c => {
              if (c.id === characterId) {
                  return {
                      ...c,
                      personality: fleshedOutData.personality || c.personality,
                      ability: fleshedOutData.ability || c.ability,
                  };
              }
              return c;
          }));

      } catch (e) {
          handleApiError(e, "キャラクター情報の補完中にエラーが発生しました。");
      } finally {
          setIsLoading(false);
      }
    });
  };


  const handleResearch = async (type: 'source' | 'character1' | 'character2') => {
    let topic: string;
    let topicName: string;

    switch (type) {
      case 'source':
        topic = researchSourceTopic;
        topicName = '原作';
        break;
      case 'character1':
        topic = researchCharacterTopic1;
        topicName = 'キャラクター1';
        break;
      case 'character2':
        topic = researchCharacterTopic2;
        topicName = 'キャラクター2';
        break;
    }

    if (!topic) {
      setError(`調査したい${topicName}のトピックを入力してください。`);
      return;
    }
    
    setResearching(type);
    await handleApiCall(async () => {
      setError(null);
      try {
        let finalTopic = topic;
        if ((type === 'character1' || type === 'character2') && researchSourceTopic) {
            finalTopic = `${topic} (${researchSourceTopic})`;
        }
        
        // Decide research type based on the function argument
        const searchType = type === 'source' ? 'source' : 'character';
        const result = await researchWithGoogle(apiKey, finalTopic, searchType);

        switch (type) {
          case 'source':
            setResearchSourceResult(result);
            break;
          case 'character1':
            setResearchCharacterResult1(result);
            break;
          case 'character2':
            setResearchCharacterResult2(result);
            break;
        }
      } catch (e) {
        handleApiError(e, "調査中にエラーが発生しました。");
      } finally {
        setResearching(null);
      }
    });
  };

  const handleOpenResearchEditor = (type: 'source' | 'character1' | 'character2') => {
    setEditingResearchType(type);
  };

  const handleCloseResearchEditor = () => {
      setEditingResearchType(null);
  };

  const handleSaveEditedResearch = (newText: string) => {
      if (!editingResearchType) return;

      switch (editingResearchType) {
          case 'source':
              setResearchSourceResult(prev => prev ? { ...prev, text: newText } : null);
              break;
          case 'character1':
              setResearchCharacterResult1(prev => prev ? { ...prev, text: newText } : null);
              break;
          case 'character2':
              setResearchCharacterResult2(prev => prev ? { ...prev, text: newText } : null);
              break;
      }
      handleCloseResearchEditor();
  };

  const handleStartStory = () => {
    if (!storyDirection || !characters[0].name || !prologue) {
      setError('「方向性」「キャラクター(最低1人)」「プロローグ」をすべて入力してください。');
      return;
    }
    setError(null);
    const processedPrologue = prologue.replace(/{{char}}/g, "私");
    setStoryHistory([processedPrologue]);
    setSuggestions([]);
    setUserDirective('');
    setActiveTab(Tab.Story);
  };

  const handleContinue = async () => {
    await handleApiCall(async () => {
      setIsLoading(true);
      setLoadingMessage('物語の続きを紡いでいます...');
      setError(null);
      setSuggestions([]);
      try {
        let result = await continueStory(apiKey, storyDirection, storyLength, characters, researchSourceResult, researchCharacterResult1, researchCharacterResult2, storyHistory, userDirective, selectedModel, historyLookbackCount, thinkingBudget);
        
        // If the story is empty, try one more time with a modified prompt.
        if (!result.story || result.story.trim() === '') {
            setLoadingMessage('AIが少し考え込んでいます... 展開を調整して再試行中...');
            result = await continueStory(apiKey, storyDirection, storyLength, characters, researchSourceResult, researchCharacterResult1, researchCharacterResult2, storyHistory, userDirective, selectedModel, historyLookbackCount, thinkingBudget, true);
        }

        if (!result.story || result.story.trim() === '') {
            setError("AIが物語の続きを生成できませんでした。これは、AIの安全基準に抵触した場合や、物語の展開が複雑すぎる場合に発生することがあります。\n\nお手数ですが、「1ブロック削除」ボタンで前のブロックに戻り、少し指示を変えてから再度お試しください。");
            setSuggestions([]);
        } else {
            const newHistory = [...storyHistory, result.story];
            setStoryHistory(newHistory);
            setSuggestions(result.suggestions);
        }
        setUserDirective('');

      } catch (e) {
          handleApiError(e, "物語の続きを生成できませんでした。");
      } finally {
          setIsLoading(false);
      }
    });
  };

  const handleRewrite = async () => {
      if (!userDirective || storyHistory.length < 2) {
        setError(userDirective ? 'リライト対象の文章がありません。プロローグはリライトできません。' : 'リライトの指示を入力してください。');
        return;
      }
      await handleApiCall(async () => {
        setIsLoading(true);
        setLoadingMessage('運命を書き換えています...');
        setError(null);
        setSuggestions([]);
        try {
            const lastSegment = storyHistory[storyHistory.length - 1];
            // Context excludes the last segment which is being rewritten
            const contextHistory = storyHistory.slice(0, -1);
            
            const result = await rewriteStory(
              apiKey, 
              lastSegment, 
              userDirective, 
              characters,
              contextHistory,
              historyLookbackCount,
              researchSourceResult,
              researchCharacterResult1,
              researchCharacterResult2,
              selectedModel, 
              thinkingBudget
            );
            
            const newHistory = [...storyHistory.slice(0, -1), result.story];
            setStoryHistory(newHistory);
            setUserDirective('');
            setSuggestions(result.suggestions);
        } catch (e) {
            handleApiError(e, "リライトに失敗しました。");
        } finally {
            setIsLoading(false);
        }
      });
  };

  const handleDeleteSimple = () => {
    if (storyHistory.length <= 1) {
        setError("削除できる物語のブロックがありません。");
        return;
    }
    const newHistory = storyHistory.slice(0, -1);
    setStoryHistory(newHistory);
    setSuggestions([]); // Clear suggestions as they are likely outdated
    setIsMenuOpen(false);
  };
  
  const handleDeleteAndSuggest = async () => {
    if (storyHistory.length <= 1) {
        setError("削除できる物語のブロックがありません。");
        return;
    }
    await handleApiCall(async () => {
        setIsLoading(true);
        setLoadingMessage('物語を1つ前に戻し、新しい展開を考えています...');
        setError(null);
        setSuggestions([]);
        try {
            const newHistory = storyHistory.slice(0, -1);
            setStoryHistory(newHistory);
            const nextSuggestions = await suggestNextDevelopments(apiKey, newHistory, historyLookbackCount);
            setSuggestions(nextSuggestions);
        } catch (e) {
            handleApiError(e, "ブロックの削除中にエラーが発生しました。");
        } finally {
            setIsLoading(false);
            setIsMenuOpen(false);
        }
    });
  };
  
  const handleJustSuggest = async () => {
    if (storyHistory.length === 0) return;
    
    await handleApiCall(async () => {
        setIsLoading(true);
        setLoadingMessage('現在の物語から、新しい展開を考えています...');
        setError(null);
        setSuggestions([]);
        try {
            const nextSuggestions = await suggestNextDevelopments(apiKey, storyHistory, historyLookbackCount);
            setSuggestions(nextSuggestions);
        } catch (e) {
            handleApiError(e, "展開の提案中にエラーが発生しました。");
        } finally {
            setIsLoading(false);
            setIsMenuOpen(false);
        }
    });
  };

  const initiateMultiDelete = () => {
      setIsMultiDeleteMode(true);
      setIsMenuOpen(false);
      setMultiDeleteStartIndex(null);
  };

  const handleExecuteMultiDelete = () => {
      if (multiDeleteStartIndex === null) return;

      if (multiDeleteStartIndex === 0) {
          if (!window.confirm("全ての物語（プロローグ含む）を削除しようとしています。本当によろしいですか？\n※この操作は取り消せません。")) {
              return;
          }
          setStoryHistory([]);
          setSuggestions([]);
          setActiveTab(Tab.Settings);
      } else {
          const newHistory = storyHistory.slice(0, multiDeleteStartIndex);
          setStoryHistory(newHistory);
          setSuggestions([]);
      }
      
      setIsMultiDeleteMode(false);
      setMultiDeleteStartIndex(null);
      
      // Scroll to bottom after deletion
      setTimeout(() => {
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
        });
      }, 100);
  };

  const handleCancelMultiDelete = () => {
      setIsMultiDeleteMode(false);
      setMultiDeleteStartIndex(null);
  };

  const handleEditLastSegment = (newText: string) => {
    if(storyHistory.length > 0) {
        setStoryHistory([...storyHistory.slice(0, -1), newText]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setUserDirective(suggestion);
  };

  const getTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}`;
  };

  const handleExportSettings = () => {
    const settings: ExportedSettings = {
      storyDirection,
      storyLength,
      characters,
      prologue,
      researchSourceResult,
      researchCharacterResult1,
      researchCharacterResult2,
      selectedModel,
      historyLookbackCount,
      thinkingBudget,
    };
    const dataStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.download = `yume-settings_${getTimestamp()}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const handleExportStory = () => {
    if (storyHistory.length === 0) {
        setError("エクスポートする物語がありません。");
        return;
    }
    const dataStr = storyHistory.join('\n\n');
    const blob = new Blob([dataStr], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `yume-story_${getTimestamp()}.txt`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("File could not be read.");
        const parsed: ExportedSettings & { researchCharacterResult?: ResearchResult | null } = JSON.parse(text);
        
        if (parsed.storyDirection === undefined || !Array.isArray(parsed.characters) || parsed.prologue === undefined) {
             throw new Error("Invalid settings file format.");
        }
        
        setStoryDirection(parsed.storyDirection);
        setStoryLength(parsed.storyLength || 'normal');
        setCharacters(parsed.characters);
        setPrologue(parsed.prologue);
        setResearchSourceResult(parsed.researchSourceResult);
        setResearchCharacterResult1(parsed.researchCharacterResult1 || parsed.researchCharacterResult || null);
        setResearchCharacterResult2(parsed.researchCharacterResult2 || null);
        setSelectedModel(parsed.selectedModel || 'gemini-2.5-flash');
        setHistoryLookbackCount(parsed.historyLookbackCount || 4);
        setThinkingBudget(parsed.thinkingBudget || 0);
        setError(null);
        alert("設定ファイルを正常に読み込みました。");
      } catch (err) {
        console.error("Failed to import settings:", err);
        setError("設定ファイルの読み込みに失敗しました。ファイルが破損しているか、形式が正しくありません。");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const triggerImport = () => {
      fileInputRef.current?.click();
  };

  const handleResetState = () => {
      if (window.confirm('本当に最初からやり直しますか？保存されている設定と物語はすべて削除されます。')) {
          localStorage.removeItem(APP_STATE_STORAGE_KEY);
          // Reset all states to default
          setActiveTab(Tab.Settings);
          setStoryDirection('');
          setStoryLength('normal');
          setCharacters([defaultCharacter]);
          setPrologue('');
          setSelectedModel('gemini-2.5-flash');
          setHistoryLookbackCount(4);
          setThinkingBudget(0);
          setResearchSourceTopic('');
          setResearchSourceResult(null);
          setResearchCharacterTopic1('');
          setResearchCharacterResult1(null);
          setResearchCharacterTopic2('');
          setResearchCharacterResult2(null);
          setStoryHistory([]);
          setSuggestions([]);
          setUserDirective('');
          setError(null);
          setIsMultiDeleteMode(false);
      }
  };
  
  const renderSection = (title: string, description: string, children: React.ReactNode) => (
    <div className="bg-white/50 p-3 sm:p-6 rounded-lg border border-sky-200 mt-6 dark:bg-slate-800/50 dark:border-sky-900">
      <h2 className="text-2xl font-bold text-sky-800 font-serif dark:text-sky-400">{title}</h2>
      <p className="text-slate-600 mt-1 mb-4 dark:text-slate-400">{description}</p>
      {children}
    </div>
  );

  const renderSettingsTab = () => (
    <>
      {renderSection("APIキー設定", "AI機能を利用するには、ご自身のGoogle AI APIキーが必要です。",
        <>
            <p className="text-sm text-slate-600 -mt-3 mb-4 dark:text-slate-400">ブラウザに保存されます。</p>
            <div className="flex flex-col sm:flex-row gap-2 items-start">
                <div className="relative flex-grow w-full">
                    <KeyIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="password"
                        value={tempApiKey}
                        onChange={(e) => setTempApiKey(e.target.value)}
                        placeholder="ここにGoogle AI APIキーを貼り付け"
                        className="w-full p-2 pl-10 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    />
                </div>
                <button onClick={handleSaveApiKey} className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 w-full sm:w-auto">保存</button>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-sm text-center sm:text-left text-sky-600 hover:underline pt-2 sm:pt-2.5 w-full sm:w-auto whitespace-nowrap dark:text-sky-400">APIキーを取得</a>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="model-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300">AIモデル</label>
                    <p className="text-xs text-slate-500 mb-1 dark:text-slate-400">物語生成の品質と速度のバランスを選択します。</p>
                    <select
                        id="model-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value as StoryModel)}
                        className="w-full p-2 mt-1 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    >
                        <option value="gemini-2.5-flash">gemini-2.5-flash (高速)</option>
                        <option value="gemini-2.5-pro">gemini-2.5-pro (高品質)</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="thinking-budget" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        AIの思考時間: {thinkingBudget === 0 ? '無効 (速い)' : thinkingBudget + ' トークン'}
                    </label>
                    <p className="text-xs text-slate-500 mb-1 dark:text-slate-400">
                      値を増やすと、AIが執筆前に論理的な整合性を深く考えます。
                      <span className="text-amber-600 block sm:inline sm:ml-1 dark:text-amber-400">
                        ※思考トークンの設定値を上げるとコストが増加します。
                      </span>
                    </p>
                    <input
                        id="thinking-budget"
                        type="range"
                        min="0"
                        max="4096"
                        step="1024"
                        value={thinkingBudget}
                        onChange={(e) => setThinkingBudget(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500 mt-2 dark:bg-slate-600"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1 dark:text-slate-500">
                        <span>無効</span>
                        <span>普通</span>
                        <span>最大(4k)</span>
                    </div>
                </div>
            </div>
        </>
      )}
      {renderSection("方向性", "物語の全体的な概要、ジャンル、雰囲気などを決定します。",
        <>
            <textarea
              value={storyDirection}
              onChange={(e) => setStoryDirection(e.target.value)}
              placeholder="例：魔法が廃れた世界で、古代の力を再発見する若者の冒険譚。ジャンルはファンタジー、恋愛要素あり。"
              className="w-full h-32 p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
            />
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">一回あたりの文字数</label>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                {(['short', 'normal', 'long'] as StoryLength[]).map(len => (
                  <div key={len} className="flex items-center">
                    <input
                      id={`${formId}-length-${len}`}
                      name="story-length"
                      type="radio"
                      checked={storyLength === len}
                      onChange={() => setStoryLength(len)}
                      className="h-4 w-4 text-sky-600 border-gray-300 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700"
                    />
                    <label htmlFor={`${formId}-length-${len}`} className="ml-2 block text-sm text-slate-900 dark:text-slate-200">
                      {len === 'short' && '短い (約250字)'}
                      {len === 'normal' && '普通 (約500字)'}
                      {len === 'long' && '長い (約800字)'}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">文脈の読み込みブロック数</label>
                <p className="text-xs text-slate-500 mb-2 dark:text-slate-400">物語の続きを生成する際に、AIがどれだけ前のブロックまでを文脈として読み込むか設定します。</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {[4, 8, 12, 1000].map(count => (
                    <div key={count} className="flex items-center">
                      <input
                        id={`${formId}-lookback-${count}`}
                        name="history-lookback"
                        type="radio"
                        checked={historyLookbackCount === count}
                        onChange={() => setHistoryLookbackCount(count)}
                        className="h-4 w-4 text-sky-600 border-gray-300 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700"
                      />
                      <label htmlFor={`${formId}-lookback-${count}`} className="ml-2 block text-sm text-slate-900 dark:text-slate-200">
                        {count === 1000 ? '全文' : `${count} ブロック`}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2 dark:text-slate-400">
                  <strong>注意:</strong> ブロック数を増やすと、AIがより広い文脈を理解できますが、応答が遅くなったり、APIコストが増加する可能性があります。
                </p>
            </div>
        </>
      )}

      {renderSection("キャラクター", "物語に登場する人物を設定します。最初のキャラクターが主人公（一人称視点）となります。",
        <div className="space-y-6">
          {characters.map((char, index) => (
            <div key={char.id} className="border-t border-sky-200 pt-6 dark:border-sky-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['name', 'gender', 'age'] as const).map(field => {
                    const labels: Record<typeof field, string> = {
                        name: '名前', gender: '性別', age: '年齢'
                    };
                    const placeholders: Record<typeof field, string> = {
                        name: '例：リオン', gender: '例：男性', age: '例：17歳'
                    };
                    return (
                        <div key={field}>
                            <label htmlFor={`${formId}-${char.id}-${field}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{labels[field]}</label>
                            <input
                                id={`${formId}-${char.id}-${field}`}
                                type="text"
                                value={char[field]}
                                onChange={(e) => handleCharacterChange(char.id, field, e.target.value)}
                                placeholder={placeholders[field]}
                                className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                            />
                        </div>
                    )
                })}
                <div className="md:col-span-2">
                    <label htmlFor={`${formId}-${char.id}-personality`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">性格</label>
                    <textarea id={`${formId}-${char.id}-personality`} value={char.personality} onChange={(e) => handleCharacterChange(char.id, 'personality', e.target.value)} placeholder="例：冷静沈着だが、仲間思い" className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" rows={2}></textarea>
                </div>
                <div className="md:col-span-2">
                    <label htmlFor={`${formId}-${char.id}-ability`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">能力・特技</label>
                    <textarea id={`${formId}-${char.id}-ability`} value={char.ability} onChange={(e) => handleCharacterChange(char.id, 'ability', e.target.value)} placeholder="例：高速な剣技、古代魔法の知識" className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" rows={2}></textarea>
                </div>

                <div className="md:col-span-2">
                    <label htmlFor={`${formId}-${char.id}-freeText`} className="block text-sm font-medium text-slate-700 dark:text-slate-300">自由記述欄</label>
                    <p className="text-xs text-slate-500 mb-1 dark:text-slate-400">背景、人間関係、口調など、その他の設定を自由に記述してください。</p>
                    <textarea id={`${formId}-${char.id}-freeText`} value={char.freeText} onChange={(e) => handleCharacterChange(char.id, 'freeText', e.target.value)} placeholder="例：王家の生き残りであることを隠している。皮肉屋な口調で話すことが多い。" className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" rows={3}></textarea>
                </div>

                <div className="md:col-span-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <input
                            id={`${formId}-${char.id}-isOriginal`}
                            type="checkbox"
                            checked={char.isOriginal}
                            onChange={(e) => handleCharacterChange(char.id, 'isOriginal', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700"
                        />
                        <label htmlFor={`${formId}-${char.id}-isOriginal`} className="text-sm text-slate-700 dark:text-slate-300">オリジナルキャラクター</label>
                    </div>

                    {!char.isOriginal && (
                        <button onClick={() => handleFleshOutCharacter(char.id)} disabled={!apiKey || isLoading || researching !== null} className="px-3 py-1.5 text-sm bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 flex items-center gap-1">
                            <SparklesIcon className="w-4 h-4" />
                            AIで設定を補完
                        </button>
                    )}
                </div>

               {index > 0 && <button onClick={() => handleRemoveCharacter(char.id)} className="text-red-500 hover:text-red-700 text-sm md:col-span-2 mt-2 dark:text-red-400 dark:hover:text-red-300">このキャラクターを削除</button>}
            </div>
            </div>
          ))}
          <button onClick={handleAddCharacter} className="mt-4 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600">キャラクターを追加</button>
        </div>
      )}

      {renderSection("プロローグ", "物語の冒頭部分を記載してください。",
        <textarea
          value={prologue}
          onChange={(e) => setPrologue(e.target.value)}
          placeholder="例：私は、錆びついた扉をゆっくりと押し開けた。その先に何が待っているのか、知る由もなかった..."
          className="w-full h-32 p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
        />
      )}
      
      {renderSection("リサーチ", "物語の解像度を上げるため、原作やキャラクターの情報をAIに調査させます。（任意）",
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">原作の世界観・あらすじ</label>
                <div className="flex gap-2">
                    <input type="text" value={researchSourceTopic} onChange={e => setResearchSourceTopic(e.target.value)} placeholder="例：「作品名」" className="flex-grow p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"/>
                    <button onClick={() => handleResearch('source')} disabled={!apiKey || isLoading || researching !== null} className="w-24 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 flex justify-center items-center">
                      {researching === 'source' ? <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : '調査'}
                    </button>
                </div>
                 {researchSourceResult && (
                    <div className="mt-2 p-2 bg-sky-100/50 rounded-md text-sm text-slate-700 flex justify-between items-center dark:bg-sky-900/30 dark:text-slate-300">
                        <span className="truncate pr-4"><strong>調査結果:</strong> {researchSourceResult.text.substring(0, 80)}...</span>
                        <button onClick={() => handleOpenResearchEditor('source')} className="flex-shrink-0 ml-2 px-3 py-1.5 text-xs bg-white border border-sky-300 text-sky-800 rounded-lg hover:bg-sky-100 flex items-center gap-1 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-sky-300 dark:hover:bg-slate-600">
                            <PencilIcon className="w-3 h-3" />
                            確認・編集
                        </button>
                    </div>
                 )}
            </div>
            <div className="border-t pt-4 dark:border-sky-800">
                 <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">特定キャラクターの背景</label>
                 <p className="text-xs text-slate-500 mb-2 dark:text-slate-400">原作名を入力すると、キャラクター名と組み合わせて検索し、精度を高めます。</p>
                <div className="flex gap-2">
                    <input type="text" value={researchCharacterTopic1} onChange={e => setResearchCharacterTopic1(e.target.value)} placeholder="キャラクター名（例：登場人物A）" className="flex-grow p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"/>
                    <button onClick={() => handleResearch('character1')} disabled={!apiKey || isLoading || researching !== null} className="w-24 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 flex justify-center items-center">
                        {researching === 'character1' ? <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : '調査'}
                    </button>
                </div>
                {researchCharacterResult1 && (
                    <div className="mt-2 p-2 bg-sky-100/50 rounded-md text-sm text-slate-700 flex justify-between items-center dark:bg-sky-900/30 dark:text-slate-300">
                        <span className="truncate pr-4"><strong>調査結果1:</strong> {researchCharacterResult1.text.substring(0, 80)}...</span>
                        <button onClick={() => handleOpenResearchEditor('character1')} className="flex-shrink-0 ml-2 px-3 py-1.5 text-xs bg-white border border-sky-300 text-sky-800 rounded-lg hover:bg-sky-100 flex items-center gap-1 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-sky-300 dark:hover:bg-slate-600">
                            <PencilIcon className="w-3 h-3" />
                            確認・編集
                        </button>
                    </div>
                )}
            </div>
            <div>
                <div className="flex gap-2 mt-2">
                    <input type="text" value={researchCharacterTopic2} onChange={e => setResearchCharacterTopic2(e.target.value)} placeholder="キャラクター名（例：登場人物B）" className="flex-grow p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"/>
                    <button onClick={() => handleResearch('character2')} disabled={!apiKey || isLoading || researching !== null} className="w-24 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 flex justify-center items-center">
                        {researching === 'character2' ? <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : '調査'}
                    </button>
                </div>
                {researchCharacterResult2 && (
                    <div className="mt-2 p-2 bg-sky-100/50 rounded-md text-sm text-slate-700 flex justify-between items-center dark:bg-sky-900/30 dark:text-slate-300">
                        <span className="truncate pr-4"><strong>調査結果2:</strong> {researchCharacterResult2.text.substring(0, 80)}...</span>
                        <button onClick={() => handleOpenResearchEditor('character2')} className="flex-shrink-0 ml-2 px-3 py-1.5 text-xs bg-white border border-sky-300 text-sky-800 rounded-lg hover:bg-sky-100 flex items-center gap-1 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-sky-300 dark:hover:bg-slate-600">
                            <PencilIcon className="w-3 h-3" />
                            確認・編集
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}

      {renderSection("データの管理", "現在の設定をファイルに保存したり、ファイルから読み込んだりします。",
        <div className="space-y-4">
            <input type="file" ref={fileInputRef} onChange={handleImportSettings} accept=".json" className="hidden" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={triggerImport} className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-sky-300 text-sky-800 rounded-lg hover:bg-sky-100 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-sky-300 dark:hover:bg-slate-600">
                    <UploadIcon className="w-5 h-5" />
                    <span>設定を読込</span>
                </button>
                <button onClick={handleExportSettings} className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-sky-300 text-sky-800 rounded-lg hover:bg-sky-100 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-sky-300 dark:hover:bg-slate-600">
                    <DownloadIcon className="w-5 h-5" />
                    <span>設定を保存</span>
                </button>
            </div>
            <button onClick={handleResetState} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 border border-red-300 text-red-800 rounded-lg hover:bg-red-100 transition-colors dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30">
                <span>最初からやり直す</span>
            </button>
        </div>
      )}

      <div className="mt-8 text-center">
        <button
          onClick={handleStartStory}
          disabled={!apiKey || isLoading || researching !== null}
          className="w-full sm:w-auto inline-flex items-center justify-center px-12 py-4 bg-gradient-to-r from-sky-500 to-blue-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 disabled:opacity-50"
        >
          <SparklesIcon className="w-6 h-6 mr-2" />
          物語を紡ぎ始める
        </button>
        <div className="mt-4 text-sm text-sky-800 bg-sky-100/80 p-4 rounded-lg text-left font-sans leading-relaxed dark:bg-sky-900/50 dark:text-sky-200">
            <strong>自動保存について：</strong><br />
            入力した設定と生成した物語は、お使いのブラウザに自動的に保存されます。<br />
            ブラウザを閉じたり更新したりしても、作業を再開できます。<br />
            データを完全に削除したい場合は、「データの管理」セクションの「最初からやり直す」ボタンを押してください。
        </div>
      </div>
    </>
  );

  const renderStoryTab = () => {
    const multiDeleteControlBar = (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-4 z-50 shadow-md flex justify-between items-center animate-fade-in-down">
            <span className="font-bold text-sm md:text-base">
                {multiDeleteStartIndex !== null 
                    ? `選択中: ブロック${multiDeleteStartIndex + 1}以降を削除` 
                    : "削除を開始したいブロックをクリックしてください"}
            </span>
            <div className="flex gap-2">
                <button onClick={handleCancelMultiDelete} className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm">
                    キャンセル
                </button>
                {multiDeleteStartIndex !== null && (
                        <button onClick={handleExecuteMultiDelete} className="px-3 py-1 bg-white text-red-600 font-bold rounded text-sm hover:bg-gray-100">
                        実行
                        </button>
                )}
            </div>
        </div>
    );

    return (
    <div className="p-2 sm:p-4 relative pb-24">
        {isMultiDeleteMode && multiDeleteControlBar}

        {storyHistory.length === 0 ? (
            <div className="text-center p-8 bg-white/50 rounded-lg dark:bg-slate-800/50">
                <p className="text-slate-600 dark:text-slate-300">「設定」タブで物語の準備を整え、「物語を紡ぎ始める」ボタンを押してください。</p>
            </div>
        ) : (
            <>
                <div className={`bg-white/60 p-3 sm:p-6 rounded-lg leading-relaxed min-h-[300px] dark:bg-slate-800/60 ${isMultiDeleteMode ? 'cursor-pointer' : ''}`}>
                    {storyHistory.map((part, index) => {
                        const isLastSegment = index === storyHistory.length - 1;
                        
                        const isSelectedForDelete = isMultiDeleteMode && multiDeleteStartIndex !== null && index >= multiDeleteStartIndex;
                        
                        const content = isLastSegment && isEditingLastSegment && !isMultiDeleteMode
                            ? <textarea key={`text-${index}`} value={part} onChange={(e) => handleEditLastSegment(e.target.value)} className="w-full h-48 p-2 bg-white/80 border border-sky-300 rounded-lg focus:ring-2 focus:ring-sky-400 dark:bg-slate-700 dark:border-sky-700 dark:text-slate-100" />
                            : <p key={`p-${index}`} className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{part}</p>;
                        
                        return (
                            <div 
                                key={index} 
                                onClick={() => isMultiDeleteMode && setMultiDeleteStartIndex(index)}
                                className={`
                                    transition-all duration-200 rounded-lg p-2 -mx-2
                                    ${isMultiDeleteMode ? 'hover:bg-sky-100 dark:hover:bg-sky-900/30' : ''}
                                    ${isSelectedForDelete ? 'bg-red-100 border border-red-300 opacity-70 dark:bg-red-900/50 dark:border-red-800' : ''}
                                `}
                            >
                                {index > 0 && <hr className="my-6 border-sky-200 dark:border-sky-800" />}
                                {content}
                                {isSelectedForDelete && (
                                    <p className="text-red-600 text-xs font-bold text-center mt-2 dark:text-red-300">削除対象</p>
                                )}
                            </div>
                        );
                    })}
                    {isLoading && <LoadingSpinner message={loadingMessage} />}
                </div>

                {isMultiDeleteMode && (
                    <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded-lg flex justify-between items-center sticky bottom-4 shadow-lg dark:bg-red-900/40 dark:border-red-800">
                        <span className="text-red-800 font-bold text-sm dark:text-red-200">
                            {multiDeleteStartIndex !== null 
                                ? `ブロック${multiDeleteStartIndex + 1}以降を削除します` 
                                : "削除開始位置を選択してください"}
                        </span>
                        <div className="flex gap-2">
                            <button onClick={handleCancelMultiDelete} className="px-4 py-2 bg-white text-slate-700 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600">
                                キャンセル
                            </button>
                             <button 
                                onClick={handleExecuteMultiDelete} 
                                disabled={multiDeleteStartIndex === null}
                                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                実行
                            </button>
                        </div>
                    </div>
                )}

                {!isMultiDeleteMode && (
                    <div className="mt-6 space-y-4">
                        {isEditingLastSegment ? (
                             <div className="flex gap-2">
                                 <button onClick={() => setIsEditingLastSegment(false)} className="flex-1 px-6 py-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50">編集を完了</button>
                             </div>
                        ) : (
                           <div className="flex flex-col gap-4">
                               <textarea
                                    value={userDirective}
                                    onChange={(e) => setUserDirective(e.target.value)}
                                    placeholder="今後の展開やリライトの指示を入力（空欄でAIにおまかせ）..."
                                    className="w-full flex-grow p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                                    rows={3}
                                />
                                {suggestions.length > 0 && !isLoading && (
                                    <div className="pt-2">
                                        <p className="text-sm font-medium text-slate-600 mb-2 dark:text-slate-400">次の展開のヒント:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {suggestions.map((s, i) => (
                                                <button key={i} onClick={() => handleSuggestionClick(s)} className="px-3 py-1.5 bg-sky-100 text-sky-800 text-sm rounded-full hover:bg-sky-200 transition-colors dark:bg-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-800/70">
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <button onClick={handleContinue} disabled={!apiKey || isLoading || researching !== null} className="md:col-span-2 px-6 py-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 font-bold shadow-sm">続きを生成</button>
                                    <button onClick={handleRewrite} disabled={!apiKey || isLoading || researching !== null || storyHistory.length < 2} className="px-4 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 shadow-sm">リライト</button>
                                    <button onClick={() => setIsEditingLastSegment(true)} disabled={isLoading || researching !== null || storyHistory.length < 1} className="px-4 py-3 bg-slate-500 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 shadow-sm">編集</button>
                                    
                                    {/* Menu Wrapper */}
                                    <div className="relative md:col-span-4">
                                        <button 
                                            onClick={() => setIsMenuOpen(!isMenuOpen)} 
                                            disabled={isLoading || researching !== null || storyHistory.length < 1}
                                            className={`w-full px-6 py-3 border rounded-lg shadow-sm flex justify-center items-center gap-2 transition-colors ${isMenuOpen ? 'bg-slate-200 text-slate-800 border-slate-400 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700'}`}
                                        >
                                            <Bars3Icon className="w-5 h-5"/>
                                            <span>メニュー</span>
                                        </button>
                                        
                                        {isMenuOpen && (
                                            <div className="absolute bottom-full right-0 w-[calc(200%+0.5rem)] md:left-0 md:right-auto md:w-full mb-3 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-20 animate-fade-in-up origin-bottom dark:bg-slate-800 dark:border-slate-600">
                                                
                                                {/* Section 1: Actions */}
                                                <div className="p-4 bg-white dark:bg-slate-800">
                                                    <div className="text-sm font-bold font-serif text-slate-700 flex items-center gap-2 mb-2 dark:text-slate-300">
                                                        <SparklesIcon className="w-4 h-4 text-sky-500"/>
                                                        <span>アクション</span>
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <button onClick={handleJustSuggest} className="w-full text-left px-4 py-3 bg-sky-50 hover:bg-sky-100 border border-sky-100 rounded-lg text-sky-900 text-sm transition-colors flex items-center gap-3 dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-900/30">
                                                            <span className="text-xl">💡</span>
                                                            <div>
                                                                <span className="font-bold block">展開を再提案</span>
                                                                <span className="text-xs opacity-80">現在の物語から新しいアイデアのみ生成</span>
                                                            </div>
                                                        </button>
                                                    </div>

                                                    <div className="text-sm font-bold font-serif text-slate-700 flex items-center gap-2 mt-4 mb-2 dark:text-slate-300">
                                                        <TrashIcon className="w-4 h-4 text-red-500"/>
                                                        <span>削除とやり直し</span>
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <button onClick={handleDeleteAndSuggest} className="w-full text-left px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg text-red-900 text-sm transition-colors flex items-center gap-3 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/30">
                                                            <span className="text-xl">↩️</span>
                                                            <div>
                                                                <span className="font-bold block">1つ戻って再提案</span>
                                                                <span className="text-xs opacity-80">直前のブロックを削除して書き直させる</span>
                                                            </div>
                                                        </button>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button onClick={handleDeleteSimple} className="text-left px-3 py-2 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-xs transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                                                                直前を削除のみ
                                                            </button>
                                                            <button onClick={initiateMultiDelete} className="text-left px-3 py-2 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-xs transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                                                                複数選択して削除
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section 2: Quick Settings */}
                                                <div className="p-4 bg-slate-50 border-t border-slate-200 dark:bg-slate-700/50 dark:border-slate-600">
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 dark:text-slate-400">クイック設定 (即時反映)</p>
                                                    
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-300">AIモデル</label>
                                                            <select
                                                                value={selectedModel}
                                                                onChange={(e) => setSelectedModel(e.target.value as StoryModel)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-400 transition-shadow dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                                            >
                                                                <option value="gemini-2.5-flash">gemini-2.5-flash (高速)</option>
                                                                <option value="gemini-2.5-pro">gemini-2.5-pro (高品質)</option>
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-300">
                                                                思考時間: <span className="font-bold">{thinkingBudget === 0 ? '無効' : thinkingBudget}</span>
                                                            </label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="4096"
                                                                step="1024"
                                                                value={thinkingBudget}
                                                                onChange={(e) => setThinkingBudget(Number(e.target.value))}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500 mt-2 dark:bg-slate-600"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-300">物語の方向性</label>
                                                        <textarea
                                                            value={storyDirection}
                                                            onChange={(e) => setStoryDirection(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-full h-32 p-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-400 transition-shadow dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                                            placeholder="物語の方向性を微調整..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                           </div>
                        )}
                    </div>
                )}

                {storyHistory.length > 0 && !isMultiDeleteMode && (
                  <div className="mt-8 border-t border-sky-200 pt-6 flex justify-center dark:border-sky-800">
                    <button onClick={handleExportStory} className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-sky-300 text-sky-800 rounded-lg hover:bg-sky-100 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-sky-300 dark:hover:bg-slate-600">
                        <DownloadIcon className="w-5 h-5" />
                        <span>物語を保存</span>
                    </button>
                  </div>
                )}
            </>
        )}
    </div>
  );
  };

  const renderTabNavigation = () => (
    <div className="grid grid-cols-2 gap-2">
      {(Object.values(Tab)).map(tab => (
        <TabButton key={tab} label={tab} isActive={activeTab === tab} onClick={() => setActiveTab(tab)} />
      ))}
    </div>
  );
  
  const getCurrentEditingResearch = () => {
    switch (editingResearchType) {
        case 'source': return { result: researchSourceResult, name: researchSourceTopic || '原作' };
        case 'character1': return { result: researchCharacterResult1, name: researchCharacterTopic1 || 'キャラクター1' };
        case 'character2': return { result: researchCharacterResult2, name: researchCharacterTopic2 || 'キャラクター2' };
        default: return { result: null, name: '' };
    }
  };
  const { result: currentResult, name: currentName } = getCurrentEditingResearch();

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 text-slate-800 p-2 sm:p-6 md:p-8 dark:from-slate-900 dark:to-slate-800 dark:text-slate-200 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-bold font-serif text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600 dark:from-sky-400 dark:to-blue-500">AI夢小説メーカー</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">思う存分推しと楽しもう！</p>
          <p className="mt-2">
            <a href="https://ameblo.jp/soranowoto0908/entry-12943949448.html" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline font-medium dark:text-sky-400">
              📖 使い方ガイド
            </a>
          </p>
        </header>

        <div className="bg-white/70 backdrop-blur-md border border-sky-200/80 rounded-xl shadow-2xl dark:bg-slate-800/70 dark:border-slate-700">
          <div className="p-2 sm:p-4 border-b border-sky-200/80 dark:border-slate-700">
            {renderTabNavigation()}
          </div>

          <main className="p-2 sm:p-6">
            {activeTab === Tab.Settings ? renderSettingsTab() : renderStoryTab()}
          </main>

          {error && <div className="px-4 sm:px-6 pb-4">
            <p className="text-red-700 bg-red-100 p-4 rounded-lg whitespace-pre-wrap text-sm text-left dark:bg-red-900/40 dark:text-red-300">{error}</p>
          </div>}
          
          <div className="p-2 sm:p-4 border-t border-sky-200/80 dark:border-slate-700">
            {renderTabNavigation()}
          </div>
        </div>
        <footer className="text-center mt-8 text-slate-500 text-sm dark:text-slate-400">
            <p>Google Gemini を搭載。想像力を解き放ちましょう。</p>
            <p className="mt-2">
                Created by <a href="https://x.com/skysound98" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline dark:text-sky-400">@skysound98</a>
            </p>
            <p className="mt-2">v1.7</p>
        </footer>
      </div>
      {showScrollToBottomButton && (
        <button
          onClick={handleScrollToBottom}
          className="fixed bottom-6 right-6 z-50 bg-sky-500 text-white rounded-full p-3 shadow-lg hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 transition-transform transform hover:scale-110 dark:focus:ring-offset-slate-900"
          aria-label="ページの一番下へスクロール"
        >
          <ChevronDoubleDownIcon className="w-6 h-6" />
        </button>
      )}
      <ResearchEditModal
        isOpen={!!editingResearchType}
        onClose={handleCloseResearchEditor}
        onSave={handleSaveEditedResearch}
        researchResult={currentResult}
        topicName={currentName}
      />
    </div>
  );
};

export default App;