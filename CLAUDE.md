# CLAUDE.md — 동네 세일 지도

이 파일은 Claude Code가 이 레포에서 작업할 때 따르는 규칙이다.
**제품/기능의 단일 진실 공급원은 [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)** 이며,
이 파일은 그 위에서의 **코드 컨벤션·작업 규칙**만 담는다.

## 0. 황금률
- **한 번에 한 Phase만.** 끝나면 멈추고, 무엇을 만들었는지 요약하고, 승인을 받은 뒤 다음 Phase로 간다.
- **Out of Scope(스펙 1-2) 절대 선구현 금지.** 발견 시 구현하지 말고 `// TODO(out-of-scope): ...` 주석만 남긴다.
- 스펙과 코드가 어긋나면 **스펙을 먼저 고치고** 코드를 맞춘다.

## 1. 기술 스택 (확정)
- Next.js 15 (App Router) + TypeScript + React 19
- Tailwind CSS v4 (CSS-first, `@import "tailwindcss"`, `tailwind.config` 없음)
- Auth.js (NextAuth v5 beta) — Kakao + Naver, **JWT 세션** (Phase 0은 Prisma Adapter 미연결)
- Prisma 6 + PostgreSQL (Supabase: DB + Storage)
- Kakao Maps JS SDK + Kakao Local REST API (Phase 1+)
- 배포: Vercel / PWA: `@serwist/next` (아직 미설치)

## 2. 디렉터리 구조
```
src/
  app/            # App Router (page.tsx, layout.tsx, api/)
    api/          # Route Handlers
  components/     # 재사용 UI 컴포넌트 (PascalCase 파일명)
  lib/            # prisma 클라이언트 등 서버 유틸
prisma/
  schema.prisma   # 데이터 모델 (스펙 4장 반영)
  migrations/     # 마이그레이션 SQL
docs/
  PROJECT_SPEC.md # 단일 진실 공급원
```

## 3. 코드 컨벤션
- **언어**: TypeScript strict. `any` 지양, 불가피하면 이유 주석.
- **컴포넌트**: 함수형 + named export. 파일명 PascalCase(`Header.tsx`).
- **서버/클라이언트**: 기본 Server Component. 상호작용 필요 시에만 최상단 `"use client"`.
- **임포트 경로**: `@/*` 별칭 사용 (`@/components/...`, `@/lib/...`).
- **스타일**: Tailwind 유틸리티 우선. 모바일 우선(mobile-first) 반응형.
- **DB 접근**: 반드시 `@/lib/prisma` 싱글톤 사용. 컴포넌트에서 직접 `new PrismaClient()` 금지.
- **주석/문구**: 한국어 OK. UI 카피는 스펙의 톤(친근체) 유지.
- **TODO 컨벤션**: `// TODO(phase-N): ...`, `// TODO(out-of-scope): ...`.

## 4. 외부 API / 시크릿 규칙
- 모든 외부 키는 **환경변수**. `.env.local` 은 커밋 금지(.gitignore).
- **키 없이도 빌드가 깨지지 않게** 가드한다 (예: provider 조건부 등록).
- 클라이언트 노출 키(`NEXT_PUBLIC_*`, 카카오 JS 키)와 서버 전용 키(REST 키, secret)를 **분리**한다.
- 새 환경변수 추가 시 `.env.example` 도 함께 갱신.

## 5. 데이터·도메인 규칙 (스펙에서 파생)
- 위치정보(GPS) **미수집**. 지도 이동은 검색어 → 지오코딩으로만.
- 기본 지도 중심 = 서울 동대문구 이문동.
- 포인트는 **적립 로그만**(`PointLog.status = pending`), 실지급 없음.
- 신고 누적 N건(기본 3) → 콘텐츠 soft hide 후 사후 검토.
- 세일은 `expiresAt` 경과 시 자동 비활성.

## 6. 커밋/PR
- 커밋 메시지: `feat:`, `fix:`, `chore:` 컨벤션.
- 각 Phase 완료 시 동작 확인 후 커밋. 다음 Phase는 승인 후.
- 새 라이브러리 추가 시 **이유를 한 줄** 남긴다.

## 7. 검증
- 변경 후 `npm run build` 통과를 기본 확인선으로 둔다.
- `npm run lint` 통과 유지.
