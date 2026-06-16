import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Tier } from "@/lib/tiers";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export type Mood = "calm" | "energetic" | "serious" | "playful" | "inspiring";

export interface Scene {
  narration: string; // TTS로 읽어줄 나레이션
  onScreenText: string; // 화면에 띄울 짧은 자막/키워드
  visual: string; // 비주얼 묘사 (다음 단계: 이미지 생성 프롬프트)
  mood: Mood; // 장면 분위기 → 색감/애니메이션 결정
}

export interface Storyboard {
  title: string;
  hook: string;
  scenes: Scene[];
}

interface VideoBody {
  topic?: string;
  length?: "short" | "normal"; // short: 4~5씬, normal: 6~8씬
  tier?: Tier;
}

const MOODS: Mood[] = ["calm", "energetic", "serious", "playful", "inspiring"];

function extractJsonObject(text: string): unknown {
  const fenced = text.replace(/```json|```/g, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("스토리보드 파싱 실패");
  return JSON.parse(fenced.slice(start, end + 1));
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function normalizeScene(raw: Partial<Scene>): Scene {
  const mood = MOODS.includes(raw.mood as Mood) ? (raw.mood as Mood) : "energetic";
  return {
    narration: String(raw.narration ?? "").trim(),
    onScreenText: String(raw.onScreenText ?? "").trim(),
    visual: String(raw.visual ?? "").trim(),
    mood,
  };
}

export async function POST(req: NextRequest) {
  let body: VideoBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const topic = body.topic?.trim();
  const sceneCount = body.length === "normal" ? "6~8" : "4~5";

  if (!topic) {
    return NextResponse.json({ error: "주제를 입력해주세요." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            `너는 유튜브 애니메이션 영상 작가다. 주제 "${topic}"로 짧은 설명형 애니메이션 영상의 스토리보드를 만들어줘.`,
            `타깃은 한국 시청자. 도입 후킹 → 핵심 설명 → 마무리 흐름으로 ${sceneCount}개 장면.`,
            `각 장면:`,
            `- narration: 그 장면에서 성우가 읽을 나레이션 (1~2문장, 자연스러운 구어체 한국어)`,
            `- onScreenText: 화면에 크게 띄울 짧은 자막/키워드 (8자 내외)`,
            `- visual: 어떤 애니메이션 장면인지 묘사 (이미지 생성용, 한국어)`,
            `- mood: ${MOODS.join(" | ")} 중 하나`,
            `반드시 아래 JSON 형식으로만 답해. 다른 말 금지:`,
            `{"title":"영상 제목","hook":"썸네일 후킹 문구","scenes":[{"narration":"","onScreenText":"","visual":"","mood":"energetic"}]}`,
          ].join("\n"),
        },
      ],
    });

    const raw = extractJsonObject(textOf(message)) as Partial<Storyboard>;
    const scenes = Array.isArray(raw.scenes) ? raw.scenes.map(normalizeScene) : [];

    if (scenes.length === 0) {
      throw new Error("생성된 장면이 없습니다.");
    }

    const storyboard: Storyboard = {
      title: String(raw.title ?? topic).trim(),
      hook: String(raw.hook ?? "").trim(),
      scenes,
    };

    return NextResponse.json(storyboard);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `영상 스토리보드 생성에 실패했습니다: ${detail}` },
      { status: 502 },
    );
  }
}
