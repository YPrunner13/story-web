import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CHANNEL_LABELS, type Channel, type Tier } from "@/lib/tiers";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const MAX_COUNT = 5;

interface AutopilotBody {
  topic?: string;
  channel?: Channel;
  count?: number;
  tier?: Tier;
}

interface Idea {
  hook: string;
  angle: string;
}

interface ScheduledPost {
  hook: string;
  angle: string;
  content: string;
  scheduledFor: string; // YYYY-MM-DD
}

/** Claude 응답에서 JSON 배열만 안전하게 추출 */
function extractJsonArray(text: string): unknown[] {
  const fenced = text.replace(/```json|```/g, "");
  const start = fenced.indexOf("[");
  const end = fenced.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("아이디어 파싱 실패");
  return JSON.parse(fenced.slice(start, end + 1));
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function dateAfter(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  let body: AutopilotBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const topic = body.topic?.trim();
  const channel = body.channel ?? "instagram";
  const tier: Tier = body.tier === "pro" ? "pro" : "free";
  const count = Math.min(Math.max(body.count ?? 3, 1), MAX_COUNT);

  if (!topic) {
    return NextResponse.json({ error: "주제를 입력해주세요." }, { status: 400 });
  }

  // 자동 운영(Auto-Pilot)은 Pro 전용 기능.
  if (tier !== "pro") {
    return NextResponse.json(
      { error: "자동 운영(Auto-Pilot)은 Pro 전용 기능입니다.", upgrade: true },
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

  const client = new Anthropic({ apiKey });

  try {
    // 1단계 — 기획 에이전트: 주제로부터 서로 다른 콘텐츠 아이디어 N개 발굴
    const planMsg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            `너는 SNS 콘텐츠 기획자다. 주제 "${topic}"로 ${CHANNEL_LABELS[channel]} 콘텐츠 아이디어 ${count}개를 기획해줘.`,
            `각 아이디어는 서로 겹치지 않게 다른 각도로.`,
            `반드시 아래 JSON 배열 형식으로만 답해. 다른 말 금지:`,
            `[{"hook":"후킹 문구","angle":"콘텐츠 방향 한 줄"}]`,
          ].join("\n"),
        },
      ],
    });

    const ideas = extractJsonArray(textOf(planMsg)).slice(0, count) as Idea[];

    // 2단계 — 생성 에이전트: 각 아이디어를 실제 콘텐츠로 (병렬)
    const posts: ScheduledPost[] = await Promise.all(
      ideas.map(async (idea, i) => {
        const genMsg = await client.messages.create({
          model: MODEL,
          max_tokens: 700,
          messages: [
            {
              role: "user",
              content: [
                `너는 한국 20~30대 타깃 SNS 카피라이터다.`,
                `주제: "${topic}" / 채널: ${CHANNEL_LABELS[channel]}`,
                `이번 글의 후킹: "${idea.hook}" / 방향: "${idea.angle}"`,
                `바로 게시 가능한 한국어 ${CHANNEL_LABELS[channel]} 한 편을 작성해줘. 이모지·해시태그 적절히.`,
              ].join("\n"),
            },
          ],
        });

        return {
          hook: idea.hook,
          angle: idea.angle,
          content: textOf(genMsg),
          // 3단계 — 스케줄러: 내일부터 하루 간격으로 예약 배치
          scheduledFor: dateAfter(i + 1),
        };
      }),
    );

    return NextResponse.json({ topic, channel, count: posts.length, posts });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `자동 운영 실행에 실패했습니다: ${detail}` },
      { status: 502 },
    );
  }
}
