import { NextRequest, NextResponse } from "next/server";
import { synthesize, ttsConfigured, type Tone } from "@/lib/tts";

export const runtime = "nodejs";

// 클라이언트가 고품질 TTS 사용 가능 여부를 먼저 확인
export async function GET() {
  return NextResponse.json({ available: ttsConfigured() });
}

export async function POST(req: NextRequest) {
  if (!ttsConfigured()) {
    return NextResponse.json(
      { error: "고품질 TTS가 설정되지 않았습니다.", fallback: true },
      { status: 501 },
    );
  }

  let text: string | undefined;
  let tone: Tone = "anime";
  try {
    const body = await req.json();
    text = body.text;
    if (body.tone) tone = body.tone;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: "text가 필요합니다." }, { status: 400 });
  }

  try {
    const audio = await synthesize(text, tone);
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `음성 생성 실패: ${detail}`, fallback: true },
      { status: 502 },
    );
  }
}
