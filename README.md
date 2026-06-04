# 동네 세일 지도 (가칭)

동네 식료품 소상공인(야채/정육/과일)의 **실시간 세일·할인 정보**를 지도에서 보고,
사용자가 직접 제보하는 **하이퍼로컬(hyperlocal) 웹 서비스**.

> 제품 스펙(단일 진실 공급원): [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)
> 코드 컨벤션·작업 규칙: [`CLAUDE.md`](CLAUDE.md)

## 기술 스택
Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Auth.js(NextAuth v5, Kakao/Naver) ·
Prisma 6 · PostgreSQL(Supabase) · Kakao Maps · Vercel

## 빌드 현황
**Phase 0 — 프로젝트 기반** ✅
- [x] Next.js + TypeScript + Tailwind 스캐폴딩
- [x] Prisma 스키마 (스펙 4장 데이터 모델) + 초기 마이그레이션 SQL
- [x] Auth.js(NextAuth v5) Kakao/Naver 골격 — 환경변수 가드(키 없어도 빌드 OK)
- [x] 레이아웃 셸: 헤더 + 지도 영역 자리
- [x] `CLAUDE.md` · `.env.example` · README

**Phase 1 — 지도 + 검색 이동** ✅
- [x] 카카오맵 렌더링 (기본 중심 = 이문동)
- [x] 검색창 → 카카오 로컬 API 지오코딩 → `map.setCenter` (`/api/geocode`)
- [x] 현 지도 영역(bounds) 내 가게 핀 `[아이콘 | 가게명]` (`/api/stores`)
- [x] 미인증 가게 회색(점선) 핀, 클릭 시 "인증 진행중" 안내
- [x] 필터: 전체/야채/정육/과일 + 세일중 (영업중·평점은 Phase 2·3 의존 → 비활성 칩)
- [x] 빈 상태(empty state) / DB 미연결 graceful 처리
- [x] 개발용 시드(`prisma/seed.ts`) — 이문동 샘플 가게 6곳

**Phase 2 — 가게 상세** ✅
- [x] 가게(인증 핀) 클릭 → 바텀시트, 위로 끌면 전체화면(peek↔full 드래그 스냅, 아래로 끌면 닫힘)
- [x] 탭: 상품 / 세일 / 공지 / 리뷰 (`/api/stores/[id]`)
- [x] 영업시간(hoursJson) 기반 **영업중 자동판정** (KST 요일+시간, 자정 넘김 지원)
- [x] 데이터 신선도("N일 전 업데이트")·세일 만료 카운트다운
- [x] 즐겨찾기 토글 UI + API(세션 가드) — 영속화는 로그인 연결(마지막 Phase) 이후
- [x] 시드에 영업시간/상품/리뷰 추가
- ※ 공지 탭은 데이터 모델에 Notice가 없어 `Store.description`+기본정보+영업시간으로 구성(스펙 불일치 항목)

**Phase 3 — 사용자 제보 + 리뷰 + Naver 로그인** ✅
- [x] **Naver 소셜 로그인** 연결 (signIn 시 `User` 자동 생성/upsert, 세션에 User.id/role/points 주입)
- [x] 세일 제보: 사진(필수, Supabase Storage 업로드) + 내용 + 세일가 + 수량 + 만료(1h/2h/마감까지)
- [x] 제보 시 **PointLog `pending` 적립**(+10P, 실지급 없음) — 세일과 동일 트랜잭션
- [x] 같은 항목 중복 세일 → "이미 세일중"(409) + **정정 진입점**(`/api/reports`)
- [x] 리뷰 작성/평점 (별점 1~5 + 내용)
- [x] 어뷰징 방어: 1분 내 3건 초과 제보 레이트리밋(429), 이미지 5MB/타입 제한
- ※ 즐겨찾기 영속화·Kakao 로그인은 여전히 맨 뒤 Phase(스펙 5장 Phase 5)
- ※ Naver 로그인 실제 동작은 **개발자 콘솔에 Callback URL 등록** 필요(아래 준비물)

**Phase 4 — 신뢰·안전** ✅
- [x] 신고/정정 접수(가게·세일·리뷰) → **신고 3건 누적 시 자동 숨김(soft hide)**
- [x] 숨김 콘텐츠는 지도/상세에서 제외 (`Review.hidden` 컬럼 추가)
- [x] 최소 관리 화면 `/admin` (role=admin 전용): 신고 큐 처리 / 가게 인증 승인·반려
- [x] 회원 탈퇴 + 데이터 삭제 `/account` (개인정보 즉시 파기, 작성물은 익명화)
- [x] 개인정보처리방침 `/privacy`, 이용약관 `/terms` 정적 페이지
- ※ 관리자 화면을 보려면: 해당 계정 `User.role` 을 `admin` 으로 바꾼 뒤 **다시 로그인** (아래 준비물)

**Phase 5 착수(진행중) — 마이페이지/UX + 남은 연기 항목** ✅(일부)
- [x] 좌측 슬라이드 **드로어 네비**(프로필 사진 + 마이페이지/관리/약관/로그아웃)
- [x] **즐겨찾기 영속화**(토글 → DB 저장, 마이페이지에 즐겨찾기 목록)
- [x] 버튼 hover/active 색상 효과(로그아웃·탈퇴·로그인·관리 버튼)
- [x] 관리 가게인증 화면: **제보자** 표시 + **카카오 주소↔핀 좌표 대조**(거리 라벨)
- [x] **5a 토대**: `Identity`(계정연결) + `PhoneVerification` 모델, 기존 소셜 로그인 Identity 기반 재배선(기존 회원 backfill), **SMS 인증 발송/검증(개발모드 목업)** API
- [x] **5b**: 전화번호 로그인 UI + 간단가입(닉네임/이름) · Kakao 로그인 활성화(개발 앱) · 마이페이지 **소셜 계정 연결**(연결하기) · 통합 `/login` 페이지
  - 로그인 진입점(헤더/드로어) → `/login`(네이버·카카오·전화번호)
  - 전화번호: `/api/phone/send`(목업 devCode) → `/api/phone/verify` → Credentials("phone") 로그인. 신규 번호는 간단가입.
  - 계정 연결/병합: 로그인 상태에서 `연결하기` → `link_uid` 쿠키 + OAuth → 그 신원이 별개 계정이면 **병합**(포인트 합산·즐겨찾기 통합·작성물 이전 후 상대 계정 삭제)
- [x] **포인트 내역/정책**: 마이페이지에 적립 내역(날짜·경로·금액). 잔액=PointLog 합계, **조회 최근 2년**, **적립 후 5년 경과분 소멸**
- [x] **닉네임 병합 규칙**: 연동을 시작한(로그인 중이던) 계정의 닉네임이 기준. 이후 다른 provider 로그인해도 덮어쓰지 않음. 마이페이지에서 닉네임 직접 수정 가능

**Phase 6 — 가게 등록(소비자) + 출처 구분** ✅
- [x] 로그인 사용자가 **가게 직접 등록**(`/stores/new`): 가게명·카테고리·주소→지오코딩 좌표·전화·소개. 미인증(verified=false)으로 생성 → 관리자 승인(Phase 4)
- [x] 진입점: 드로어 "가게 등록", 지도 우하단 FAB
- [x] **소비자/사장님 등록 시각 구분**(`Store.source`): 사장님 가게는 지도 핀에 👑+금색 테두리, 상세에 "👑 사장님 가게" 배지 / 소비자 등록은 "주민 등록"
- [x] 등록 레이트리밋(10분 5건)
- ※ **사장님 직접 등록/인증(사업자등록증 서류 업로드 + 관리자 수동 승인)은 다음 단계**로 보류(스펙 Phase 6 주석)

**Phase 7a — 사장님 인증** ✅
- [x] 사장님 인증 신청: 가게 상세 → 사업자등록증 업로드(**비공개 버킷** `merchant-docs`) → `MerchantVerification(pending)`
- [x] 관리자 심사 `/admin/merchants`: **서명 URL로 문서 확인** 후 승인/반려. 승인 시 `role=merchant` + `Store.ownerId` 지정(`source=merchant`, `verified=true`)
- [x] `Store.ownerId` / 상세 DTO `isOwner`·`hasOwner` 추가
**Phase 7b — 메뉴(상품) 관리/권한** ✅
- [x] 소유자(사장님)·관리자 가게: 소유자·관리자만 메뉴 추가/수정/삭제 (비소유자 403)
- [x] 소유자 없는(소비자 등록) 가게: 로그인한 누구나 메뉴 관리(커뮤니티) — **사진 필수**, **등록자 닉네임/프사·갱신일 표시**
- [x] 메뉴별 **신고 버튼** → 신고 3건 누적 시 **자동 숨김**(`Product.hidden`), 관리자 신고 큐에서도 처리
- [x] 가게 헤더: 소유자 없으면 **최초 등록자** 노출, 사장님 소유면 **👑 사장님 관리** + 최초등록자 작게
- ※ 신고 작성자 **계정 정지(ban)** 관리 기능은 후속(7b-2)
**Phase 7c — 가게 상단 메인 사진(배너)** ✅
- [x] 가게 상세 상단 배너(`Store.bannerUrl`) 표시 + 등록/변경/삭제
- [x] 권한: **사장님(소유자)·관리자만**(소비자 등록 가게라도 일반 소비자는 불가) — `canManageStore`, PATCH `/api/stores/[id]` 403 가드
**Phase 7d — 즐겨찾기 별도 메뉴** ✅
- [x] `/favorites` 별도 페이지(드로어 "♥ 즐겨찾기") — 마이페이지에서 분리
- [x] 가게별 **세일 여부**(🔥 세일중 / 세일 없음) 표시
- [x] 클릭 시 `/?store=&lat=&lng=` 딥링크 → 지도가 **위치 무관**하게 해당 가게 상세(메뉴/세일/리뷰)를 바로 엶
- ※ 후속: 신고 누적 작성자 **계정 정지(ban)** 관리(7b-2)

> SMS는 발송사 미설정 시 **개발모드**로 동작: 실제 발송 없이 인증번호를 응답/서버로그에 노출(`/api/phone/send` → `devCode`). 실발송사(CoolSMS 등)는 `SMS_PROVIDER` 설정 시 연동 예정.

> ⚠️ **Supabase DB 연결**: 직접 호스트(`db.<ref>.supabase.co`)는 IPv4 환경에서 접속이 안 될 수 있다.
> Supabase 대시보드 ▸ **Connect** 에서 **Pooler** 연결문자열을 복사해 쓰는 것을 권장한다:
> `DATABASE_URL` = Transaction pooler(6543), `DIRECT_URL` = Session pooler(5432).
> 연결되면 `npm run db:migrate && npm run db:seed` 로 스키마+샘플데이터 적용.

다음 Phase부터는 스펙 "5. 기능 요구사항" 순서대로 진행한다.

## 로컬 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
```bash
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
```
`.env.local` 을 열어 값을 채운다. 키가 없어도 빌드/기동은 되지만,
로그인·DB·지도 기능은 해당 키가 있어야 동작한다. (아래 "준비물" 참고)

### 3. DB 마이그레이션 (DB 연결 후)
```bash
npm run db:migrate     # prisma migrate dev — DATABASE_URL/DIRECT_URL 필요
```
> Phase 0에는 초기 마이그레이션 SQL(`prisma/migrations/`)만 생성돼 있다.
> 실제 DB에 적용하려면 위 명령을 실행한다.

### 4. 개발 서버
```bash
npm run dev          # http://localhost:3000
```

### 5. 프로덕션 빌드 확인
```bash
npm run build
```

## 준비물 (사용자가 직접 발급)
자세한 체크리스트는 Phase 0 작업 요약 또는 `.env.example` 주석 참고.
- **Supabase**: 프로젝트 생성 → `DATABASE_URL`(pooled, 6543) / `DIRECT_URL`(direct, 5432)
- **카카오 로그인**(developers.kakao.com): REST 키 + Client Secret, Redirect URI 등록
- **네이버 로그인**(developers.naver.com): Client ID/Secret, Callback URL 등록
- **카카오맵**(Phase 1): JS 키(`NEXT_PUBLIC_KAKAO_MAP_JS_KEY`) + REST 키(`KAKAO_REST_API_KEY`)
- **AUTH_SECRET**: `npx auth secret` 로 생성

## 범위 주의
이번 빌드는 **수요 검증용 MVP**다. 스펙 "1-2 Out of Scope"(GPS, 사장님 등록,
푸시, 포인트 교환 등)는 **구현하지 않는다.** 발견 시 `// TODO(out-of-scope:)` 주석만 남긴다.
