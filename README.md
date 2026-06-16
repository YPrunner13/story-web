# AutoMate (MVP)

> 주제만 던지면, AI가 SNS 콘텐츠를 대신 만들어주는 자동화 앱.
> **시간은 지키고, 결과는 가져간다** — 요즘 20대의 "노동 자동화" 욕구를 노린 제품.

기획 배경·전략은 [`docs/PRD.md`](docs/PRD.md) 참고.

## 현재 구현 (Phase 1 MVP)

- 주제 입력 → Claude API로 SNS 콘텐츠 자동 생성
- **Free / Pro 2단계 게이팅**
  - Free: 하루 3건, 인스타그램만
  - Pro: 무제한, 멀티 채널(블로그·X·스레드)
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
  page.tsx              # 메인 화면 (생성 폼 + 티어 토글)
  api/generate/route.ts # 콘텐츠 생성 API (티어 게이팅)
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
