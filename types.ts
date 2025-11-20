
import { Tab } from './constants';

export interface Character {
  id: string;
  name: string;
  gender: string;
  age: string;
  ability: string;
  personality: string;
  isOriginal: boolean;
  freeText: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ResearchResult {
  text: string;
  sources: GroundingSource[];
}

export type StoryLength = 'short' | 'normal' | 'long';
export type StoryModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export interface ExportedSettings {
  storyDirection: string;
  storyLength: StoryLength;
  characters: Character[];
  prologue: string;
  researchSourceResult: ResearchResult | null;
  researchCharacterResult1: ResearchResult | null;
  researchCharacterResult2: ResearchResult | null;
  selectedModel?: StoryModel;
  historyLookbackCount?: number;
  thinkingBudget?: number;
}

export interface StoryGenerationResult {
  story: string;
  suggestions: string[];
}

export interface AppState {
  storyDirection: string;
  storyLength: StoryLength;
  characters: Character[];
  prologue: string;
  researchSourceResult: ResearchResult | null;
  researchCharacterResult1: ResearchResult | null;
  researchCharacterResult2: ResearchResult | null;
  selectedModel: StoryModel;
  storyHistory: string[];
  researchSourceTopic: string;
  researchCharacterTopic1: string;
  researchCharacterTopic2: string;
  activeTab: Tab;
  historyLookbackCount: number;
  thinkingBudget: number;
}
