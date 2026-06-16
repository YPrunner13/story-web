import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  TIER_LIMITS,
  CHANNEL_LABELS,
  canUseChannel,
  type Channel,
  type Tier,
} from "@/lib/tiers";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

interface GenerateBody {
  topic?: string;
  channel?: Channel;
  tier?: Tier;
}

function buildPrompt(topic: string, channel: Channel): string {
  const channelGuide: Record<Channel, string> = {
    instagram:
      "인스타그램 캡션 3개. 각 1~3문장, 친근한 말투, 적절한 이모지와 해시태그 5개 포함.",
    blog: "블로그 글 1편. 제목 + 소제목 3개 + 본문. 정보성과 가독성 중심, 약 500자.",
    x: "X(트위터) 포스트 3개. 각 280자 이내, 후킹 강하게, 해시태그 1~2개.",
    threads: "스레드(Threads) 포스트 3개. 각 2~4문장, 대화하듯 자연스럽게.",
  };

  return [
    `너는 한국 20~30대를 타깃으로 하는 SNS 콘텐츠 카피라이터다.`,
    `주제: "${topic}"`,
    `요청: ${channelGuide[channel]}`,
    `한국어로, 바로 게시할 수 있는 형태로 작성해줘.`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const topic = body.topic?.trim();
  const channel = body.channel ?? "instagram";
  const tier: Tier = body.tier === "pro" ? "pro" : "free";

  if (!topic) {
    return NextResponse.json({ error: "주제를 입력해주세요." }, { status: 400 });
  }

  // 티어 게이팅: Free는 일부 채널만 사용 가능.
  if (!canUseChannel(tier, channel)) {
    return NextResponse.json(
      {
        error: `'${CHANNEL_LABELS[channel]}'은 Pro 전용 기능입니다.`,
        upgrade: true,
      },
      { status: 403 },
    );
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
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(topic, channel) }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      content: text,
      channel,
      tier,
      limit: TIER_LIMITS[tier].dailyGenerations,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `콘텐츠 생성에 실패했습니다: ${detail}` },
      { status: 502 },
    );
  }
}
