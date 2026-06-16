# AutoMate (MVP)

> 주제만 던지면, AI가 SNS 콘텐츠를 대신 만들어주는 자동화 앱.
> **시간은 지키고, 결과는 가져간다** — 요즘 20대의 "노동 자동화" 욕구를 노린 제품.

기획 배경·전략은 [`docs/PRD.md`](docs/PRD.md) 참고.

## 🎬 핵심 방향: 유튜브 애니메이션 영상 자동 제작

주제만 넣으면 → AI가 **대본 작성 → 장면 분할 → 나레이션 음성 → 애니메이션 재생** 까지 자동.
(`/studio` — 현재는 브라우저 TTS+애니메이션 미리보기. 다음 단계: 장면별 AI 이미지 → MP4 렌더링 → 유튜브 자동 업로드)

영상 제작 파이프라인:
```
주제 → ①대본 → ②장면분할 → ③비주얼/애니 → ④나레이션(TTS) → ⑤MP4 → 유튜브 업로드
        └──────── 현재 구현(①~④, 브라우저 미리보기) ────────┘  └─ 다음 단계 ─┘
```

## 현재 구현 (Phase 1 MVP)

- **🎬 영상 스튜디오 (`/studio`)** — 주제 → 나레이션 애니메이션 영상 자동 생성·재생
- 주제 입력 → Claude API로 SNS 콘텐츠 자동 생성
- **⚡ 자동 운영(Auto-Pilot)** — 주제 하나로 며칠치 콘텐츠를 자동 기획 → 생성 → 예약 (멀티스텝 워크플로, Pro 전용)
- **Free / Pro 2단계 게이팅**
  - Free: 하루 3건, 인스타그램만, 단건 생성
  - Pro: 무제한, 멀티 채널(블로그·X·스레드), 자동 운영
- Pro 업셀 UI (결제 연동 자리 — Stripe 예정)

## 실행 방법

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY 입력
npm run dev                  # http://localhost:3000
```

## 기술 스택

Next.js (App Router) · TypeScript · Tailwind CSS · Anthropic Claude API

## 구조

```
app/
  page.tsx               # 메인 화면 (단건 생성 / 자동 운영 + 티어 토글)
  studio/page.tsx        # 🎬 영상 스튜디오: 스토리보드 → 나레이션 애니메이션 플레이어
  api/generate/route.ts  # 단건 콘텐츠 생성 API (티어 게이팅)
  api/autopilot/route.ts # 자동 운영: 기획→생성→예약 멀티스텝 워크플로 (Pro)
  api/video/route.ts     # 영상 스토리보드 생성 (주제 → 대본·장면 JSON)
lib/
  tiers.ts              # Free/Pro 권한 정의
docs/
  PRD.md                # 기획문서
```

## 다음 단계 (로드맵)

- [ ] 인증 + 서버측 사용량 집계 (현재 Free 카운트는 클라이언트 임시)
- [ ] Stripe 구독 결제 연동
- [ ] 예약 발행 · 멀티 에이전트 워크플로 (Pro)
- [ ] 모바일 클라이언트 확장
