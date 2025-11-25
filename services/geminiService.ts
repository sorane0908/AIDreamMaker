


import { GoogleGenAI, Type } from "@google/genai";
import type { GroundingSource, Character, ResearchResult, StoryLength, StoryGenerationResult, StoryModel } from '../types';

export const researchWithGoogle = async (apiKey: string, prompt: string): Promise<ResearchResult> => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `あなたは情報を要約するAIです。後続のAIが直接読み込むことを想定し、以下の指示に従ってトピックを要約してください。
# 指示
- 物語の核心（プロット、キャラクターの動機、世界観）に絞る。
- 箇条書きで事実のみを記述する。
- 「以下は～に関する情報です」のような前置きや、解説、結びの言葉は一切含めない。
- 出力は箇条書きから始めること。

# トピック
"${prompt}"`,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });

    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => ({
            uri: chunk.web?.uri,
            title: chunk.web?.title,
        }))
        .filter((source: GroundingSource) => source.uri && source.title) || [];
    
    const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());

    return { text: response.text, sources: uniqueSources };
};

export const fleshOutCharacter = async (
  apiKey: string,
  characterInfo: Partial<Character>,
  researchText: string | null
): Promise<Partial<Pick<Character, 'personality' | 'ability'>>> => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `下記情報に基づき、キャラクターの性格と能力を詳細に肉付けせよ。

# 入力情報
- 名前: ${characterInfo.name || '指定なし'}
- 性別: ${characterInfo.gender || '指定なし'}
- 年齢: ${characterInfo.age || '指定なし'}

# 参考情報
${researchText || 'なし'}

# 出力
上記を統合し、指定のJSON項目を埋めること。
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          personality: {
            type: Type.STRING,
            description: "キャラクターの性格を詳細に記述したもの。",
          },
          ability: {
            type: Type.STRING,
            description: "キャラクターの能力や特技を具体的に記述したもの。",
          },
        },
        required: ['personality', 'ability']
      },
    },
  });

  try {
    const jsonStr = response.text.trim();
    const parsed = JSON.parse(jsonStr);
    return parsed as Partial<Pick<Character, 'personality' | 'ability'>>;
  } catch (e) {
    console.error("Failed to parse character flesh out response:", e);
    return {};
  }
};


const buildStoryPrompt = (
    storyDirection: string,
    storyLength: StoryLength,
    characters: Character[],
    researchSource: ResearchResult | null,
    researchCharacter1: ResearchResult | null,
    researchCharacter2: ResearchResult | null,
    history: string[],
    historyLookbackCount: number,
    userDirective?: string,
    isRetry?: boolean
) => {
    const lengthMap = {
        short: 250,
        normal: 500,
        long: 800,
    };
    
    // Compress character details
    const charactersDetails = characters.map(c => {
        const details = [];
        if (c.freeText) details.push(`自由記述: ${c.freeText}`);
        if (c.personality) details.push(`性格: ${c.personality}`);
        if (c.ability) details.push(`能力: ${c.ability}`);
        return `- ${c.name}: ${details.join('; ')}`;
    }).join('\n');

    // To prevent hitting API quota limits, only send the last segments of the story history.
    const recentHistory = history.length > historyLookbackCount ? history.slice(-historyLookbackCount) : history;

    // A more concise system prompt
    let fullPrompt = `プロの小説家として、主人公(私)の一人称視点で物語を執筆。
約${lengthMap[storyLength]}文字の地の文のみ。描写は登場人物の変化を反映させること。

# ルール
- 物語の本文には、読みやすさを向上させるため、必ず改行を適宜含めてください。段落と段落の間には空行を一つ入れてください。
- 文章の結びは推量形を避け、読者が次の展開を想定できるような表現は避けること。
- 物語が続くように締めくくる。

# 設定
## 方向性
${storyDirection || "指定なし"}

## 登場人物
${charactersDetails || "指定なし"}

## 参考情報(原作)
${researchSource?.text || "なし"}

## 参考情報(キャラ1)
${researchCharacter1?.text || "なし"}

## 参考情報(キャラ2)
${researchCharacter2?.text || "なし"}

# これまでの物語
${recentHistory.join('\n\n') || "物語はここから始まります。"}
`;

    if (userDirective) {
        fullPrompt += `

# 次に書くべき場面
「これまでの物語」の直後の場面として、以下の「指示」で示された出来事を詳細に描写してください。
## 指示
${userDirective}`;
    } else {
        fullPrompt += `

# 次に書くべき場面
「これまでの物語」の続きを、設定と矛盾なく自然な流れで執筆してください。`;
    }

    if (isRetry) {
        fullPrompt += `

# 追加指示
重要：直前の試みでは、AIの安全基準などが原因で空の応答が返されました。この問題を回避するため、展開を少し変え、より穏当で創造的な表現を用いて物語を執筆してください。`;
    }

    return fullPrompt;
}

export const continueStory = async (
  apiKey: string,
  storyDirection: string,
  storyLength: StoryLength,
  characters: Character[],
  researchSource: ResearchResult | null,
  researchCharacter1: ResearchResult | null,
  researchCharacter2: ResearchResult | null,
  history: string[],
  userDirective: string,
  modelName: StoryModel,
  historyLookbackCount: number,
  thinkingBudget: number,
  isRetry?: boolean
): Promise<StoryGenerationResult> => {
  const ai = new GoogleGenAI({ apiKey });
  if (characters.length === 0) throw new Error("キャラクターが設定されていません。");

  const prompt = buildStoryPrompt(storyDirection, storyLength, characters, researchSource, researchCharacter1, researchCharacter2, history, historyLookbackCount, userDirective, isRetry);

  const finalPrompt = prompt + `

最後に、上記の指示に従って執筆した物語の続きとして考えられる、面白そうな展開のアイデアを3つ提案してください。`;

  const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
          type: Type.OBJECT,
          properties: {
              story: {
                  type: Type.STRING,
                  description: "生成された物語の地の文。"
              },
              suggestions: {
                  type: Type.ARRAY,
                  description: '3つの展開アイデアの配列',
                  items: { type: Type.STRING }
              }
          },
          required: ['story', 'suggestions']
      }
  };

  // Only add thinkingConfig if thinkingBudget is greater than 0
  if (thinkingBudget > 0) {
      config.thinkingConfig = { thinkingBudget };
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: finalPrompt,
    config: config
  });
  try {
    const jsonStr = response.text.trim();
    const parsed = JSON.parse(jsonStr);
    return parsed as StoryGenerationResult;
  } catch (e) {
    console.error("Failed to parse continueStory response:", e);
    return { story: response.text, suggestions: [] };
  }
}

export const rewriteStory = async (
  apiKey: string,
  lastSegment: string,
  rewriteInstruction: string,
  characters: Character[],
  history: string[],
  historyLookbackCount: number,
  researchSource: ResearchResult | null,
  researchCharacter1: ResearchResult | null,
  researchCharacter2: ResearchResult | null,
  modelName: StoryModel,
  thinkingBudget: number
): Promise<StoryGenerationResult> => {
  const ai = new GoogleGenAI({ apiKey });

  // Format characters
  const charactersDetails = characters.map(c => {
      const details = [];
      if (c.freeText) details.push(`自由記述: ${c.freeText}`);
      if (c.personality) details.push(`性格: ${c.personality}`);
      if (c.ability) details.push(`能力: ${c.ability}`);
      return `- ${c.name}: ${details.join('; ')}`;
  }).join('\n');

  // Format history context
  const recentHistory = history.length > historyLookbackCount ? history.slice(-historyLookbackCount) : history;

  const prompt = `プロの編集者として、以下の設定と文脈を踏まえ、指示に従って対象の文章を書き直せ。

# 設定
## 登場人物
${charactersDetails || "指定なし"}

## 参考情報(原作)
${researchSource?.text || "なし"}

## 参考情報(キャラ1)
${researchCharacter1?.text || "なし"}

## 参考情報(キャラ2)
${researchCharacter2?.text || "なし"}

# これまでの物語（文脈）
${recentHistory.join('\n\n') || "（文脈なし）"}

# 書き直す対象の文章（元の文章）
${lastSegment}

# 修正指示
${rewriteInstruction}

# ルール
- 物語の筋（プロット）は維持すること。ただし指示で変更が求められている場合は従うこと。
- キャラクターの性格や口調設定を厳守すること。
- 書き直した物語の本文には、必ず改行を適宜含めてください。段落と段落の間には空行を一つ入れてください。
- 文章の結びは、「～だった。」「～だろう。」のような過去形や推量形を避け、現在の瞬間の描写で締めくくること。
- 出力は{story: string, suggestions: string[]}のJSON形式。
`;

  const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
          type: Type.OBJECT,
          properties: {
              story: {
                  type: Type.STRING,
                  description: "書き直された物語の地の文。"
              },
              suggestions: {
                  type: Type.ARRAY,
                  description: '3つの展開アイデアの配列',
                  items: { type: Type.STRING }
              }
          },
          required: ['story', 'suggestions']
      }
  };

  // Only add thinkingConfig if thinkingBudget is greater than 0
  if (thinkingBudget > 0) {
      config.thinkingConfig = { thinkingBudget };
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: config
  });
  
  try {
    const jsonStr = response.text.trim();
    const parsed = JSON.parse(jsonStr);
    return parsed as StoryGenerationResult;
  } catch (e) {
    console.error("Failed to parse rewriteStory response:", e);
    return { story: response.text, suggestions: [] };
  }
}

export const suggestNextDevelopments = async (apiKey: string, history: string[], historyLookbackCount: number): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey });
  
  // To prevent hitting API quota limits, only send the last segments of the story history.
  const recentHistory = history.length > historyLookbackCount ? history.slice(-historyLookbackCount) : history;

  const prompt = `以下の物語の続きとなる面白そうな展開案を3つ簡潔に提案せよ。

# これまでの物語
${recentHistory.join('\n\n')}

# 提案
`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            description: '3つの展開アイデアの配列',
            items: {
              type: Type.STRING,
            },
          },
        },
        required: ['suggestions'],
      },
    },
  });
  try {
    const jsonStr = response.text.trim();
    const parsed = JSON.parse(jsonStr);
    return parsed.suggestions as string[];
  } catch (e) {
    console.error("Failed to parse suggestions:", e);
    return [];
  }
}