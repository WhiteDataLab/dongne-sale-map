# 동네 세일 지도 (가칭) — 프로젝트 스펙

> 이 문서는 Claude Code가 항상 참조하는 **단일 진실 공급원(single source of truth)** 이다.
> 코드와 스펙이 어긋나면 이 문서를 먼저 갱신한 뒤 코드를 수정한다.

---

## 0. 한 줄 정의

동네 식료품 소상공인(야채/정육/과일)의 **실시간 세일·할인 정보**를 지도에서 보고, 사용자가 직접 제보할 수 있는 **하이퍼로컬(hyperlocal) 웹 서비스**.

---

## 1. 이번 빌드의 목표와 범위 (중요)

전체 기획서를 한 번에 만들지 않는다. 이번 빌드는 **수요 검증용 MVP(0차 + 1차)** 다.
"동네 사람이 세일 정보를 실제로 보고 올리는가?" 한 가지만 검증한다.

### 1-1. 이번에 만드는 것 (In Scope)

- 카카오/네이버 소셜 로그인 (전화번호 로그인은 후순위)
- 지도(카카오맵) 위에 가게 핀(pin) 표시
- **검색 기반 지도 이동** ("이문", "이문동", "이문아이파크자이" → 해당 좌표로 지도 이동)
- 가게 상세 보기 (가게명, 사진, 영업시간/영업중 자동판정, 주소, 상품 탭, 세일 탭, 리뷰 탭)
- **사용자 세일 제보** (사진 + 내용 + 가격/수량 + 만료시간) → 만료시간 지나면 자동 비활성
- 가게 즐겨찾기
- 리뷰 작성/평점
- 정정·신고 (커뮤니티 자동 숨김 기준 포함)
- 포인트 **적립 로그만** 기록 (실제 지급/기프티콘 교환은 보류 — 숫자만 보여줌)
- 회원 탈퇴 + 개인정보 삭제 (법적 필수)
- 개인정보처리방침 / 이용약관 페이지
- PWA (모바일 웹 우선, 설치 가능하되 Push는 미구현)

### 1-2. 이번에 만들지 않는 것 (Out of Scope — 절대 미리 만들지 말 것)

- GPS/현재위치 기반 서비스 (위치정보법 회피 위해 의도적으로 제외)
- ~~사장님 직접 등록 / 사업자 전환 / 내가게 관리 대시보드~~ → **In Scope로 편입(Phase 7)**
- 사업자등록번호 검증(국세청 API) — **미사용 유지**(서류 업로드 + 관리자 수동 승인으로 대체)
- 푸시 알림(Push) / 네이티브 앱
- 포인트 → 기프티콘 교환, 출금
- 아바타/치장/닉네임 특수효과 게이미피케이션
- 관리자 대시보드(가입자 통계, 접속 통계 등) — *단, 신고/제보 처리용 최소 관리 화면은 1-1에 포함*
- 수익화(구독/스폰서 핀/광고)
- ~~카테고리 확장(세탁/아이스크림 등)~~ → **In Scope로 편입(Phase 6)**: 야채/정육/과일 + 세탁/반찬/미용실/기타

> 위 항목을 발견하더라도 **구현하지 말고 TODO 주석과 이슈로만 남긴다.**

---

## 2. 핵심 제품 결정 (Product Decisions)

- **위치정보 미수집**: 사용자 단말 GPS를 일절 쓰지 않는다. 대신 검색어 → 지오코딩(geocoding)으로 지도를 이동시킨다. (카카오 로컬 키워드/주소 검색 API 활용)
- **기본 지도 중심**: 검색 전 기본값은 "서울 동대문구 이문동" 좌표.
- **가게 데이터 출처**: 길거리 노점은 카카오 POI에 없을 수 있으므로, 가게는 **이 서비스 자체 DB**에 저장한다. (POI 연동은 후순위)
- **포인트는 적립만**: 어뷰징(abusing) 방어를 위해 적립 로그만 남기고 실지급은 보류. 모든 적립은 `status: pending`.
- **신뢰 기반 자동화**: 신고 누적 N건(기본 3건) 시 콘텐츠 자동 숨김(soft hide) 후 사후 검토. 사전 전수 승인 안 함.

---

## 3. 기술 스택 (제안 — 시작 전 확정할 것)

> Claude Code는 작업 시작 전에 이 스택이 맞는지 사용자에게 한 번 확인한다.

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js (App Router) + TypeScript | 풀스택 단일 레포, 솔로 개발 마찰 최소 |
| 스타일 | Tailwind CSS | 빠른 UI |
| 인증(Auth) | Auth.js (NextAuth v5) — Kakao, Naver 프로바이더 | 한국 OAuth 기본 지원 |
| DB | PostgreSQL (Supabase 또는 Neon) | 무료 티어, 솔로 친화 |
| ORM | Prisma | 스키마 관리·마이그레이션 편의 |
| 이미지 저장 | Supabase Storage 또는 Vercel Blob | 제보 사진 업로드 |
| 지도 | Kakao Maps JS SDK + Kakao Local REST API | 한국 지도/검색 |
| 배포 | Vercel | CI/CD 자동 |
| PWA | next-pwa | 설치형 웹 |

> **사용자가 직접 확인해야 할 것**: 카카오맵 API 키 발급·상업적 이용 약관·무료 쿼터(quota), 네이버 로그인 앱 등록. 키는 환경변수(`.env.local`)로 관리하고 절대 커밋하지 않는다.

---

## 4. 데이터 모델 (초안 — Prisma 스키마 기준으로 구체화)

```
User
  id, provider(kakao|naver|phone, nullable·레거시), providerId(nullable),
  name(nullable, 실명), nickname, profileImgUrl,
  phone(nullable, unique), phoneVerified(bool),   // 전화번호 로그인 (Phase 5)
  role(user|admin)        // merchant 역할은 이번 빌드 미사용
  status(active|banned), points(int, 표시용), createdAt

Identity              // 로그인 수단 ↔ User (계정 연결, Phase 5)
  id, userId, provider(kakao|naver|phone), providerId, createdAt
  // @@unique([provider, providerId]) — 신원의 단일 출처

PhoneVerification     // 전화번호 본인확인 코드 (Phase 5, 개발모드=목업)
  id, phone, codeHash, expiresAt, attempts, verified, createdAt

Store
  id, name, category(vegetable|meat|fruit),
  address, lat, lng, phone(nullable), hoursJson, description,
  verified(bool, default false),   // 미인증 가게는 회색 핀
  createdById, status(active|hidden), createdAt

Product            // 상품 탭
  id, storeId, name, price(int), qtyUnit(string), stock(nullable),
  photoUrl, origin(nullable), createdById, createdAt

Sale               // 세일 탭 (시간 만료형)
  id, storeId, productId(nullable), title, photoUrl,
  salePrice(int), qty(string), expiresAt(datetime),
  status(active|expired|hidden), createdById, createdAt

Review
  id, storeId, userId, rating(1~5), content, hidden(bool, default false), createdAt
  // hidden: 신고 누적 N건 시 soft hide (Phase 4)

Favorite
  userId, storeId

Report             // 신고/정정 통합
  id, targetType(store|sale|review), targetId, reason,
  reporterId, status(open|resolved), createdAt

PointLog
  id, userId, amount(int), reason(string), status(pending|granted),
  refType, refId, createdAt
```

> 정정(correction)은 별도 테이블 대신 Report에 `reason`으로 사유를 받고 관리자가 처리하는 방식으로 단순화한다.

---

## 5. 기능 요구사항 (페이즈별 — Claude Code는 이 순서대로 PR 단위 작업)

### Phase 0 — 프로젝트 기반
- 레포 스캐폴딩, Tailwind/Prisma/Auth.js 설치
- `CLAUDE.md`(코드 컨벤션), `.env.example`, README 작성
- DB 연결, 기본 마이그레이션
- 레이아웃 셸(shell): 헤더 + 지도 영역

### Phase 1 — 지도 + 검색 이동
- 카카오맵 렌더링, 기본 중심 = 이문동
- 검색창 1개: 검색어 → 카카오 로컬 API 지오코딩 → `map.setCenter`
- 현 지도 영역(bounds) 내 가게 핀 표시: `[카테고리 아이콘 | 가게명]`
- 미인증 가게는 회색 핀, 클릭 시 "인증 진행중" 문구
- 상세조회 필터: 전체/야채/정육/과일, 영업중/영업종료, 세일중/세일아님, 평점

### Phase 2 — 가게 상세
- 가게 클릭 → 바텀시트(bottom sheet) → 위로 끌면 전체화면
- 탭: 상품 / 세일 / 공지 / 리뷰
  - **공지 탭은 별도 `Notice` 모델을 두지 않고 `Store.description`(가게 소개) + 기본정보 + 영업시간 표로 구성한다.**
    (사장님 직접 등록이 Out of Scope라 공지 작성 주체가 없음 → 전용 모델은 사장님 등록 도입 시 추가)
- 영업시간(hoursJson) 기반 **영업중 자동 판정** (KST 기준, 요일+시간)
- 즐겨찾기 토글
  - **토글 UI/API/`Favorite` 모델까지 구현하되, 실제 영속화는 로그인(세션→User 매핑) 연결 이후**(Phase 4 신뢰·안전 또는 그 직후 로그인 연결 시점)에 활성화한다. 그전에는 비로그인 안내만 노출.

### Phase 3 — 사용자 제보
- 세일 제보: 사진(필수, **최대 10장 · 슬라이드 표시**) + 내용 + 세일가 + 수량 + 만료시간(1h/2h/마감까지/**직접 설정**)
- 제보 시 PointLog에 `pending` 적립 로그 생성
- 같은 항목 중복 세일 시 "이미 세일중" 처리 + 정정 진입점
- 리뷰 작성/평점
- **Naver 소셜 로그인 최소 연결**: 제보/리뷰 작성 주체를 확보하기 위해 이 시점에 Naver 로그인을 붙인다.
  signIn 시 OAuth 프로필 → `User` 자동 생성(upsert), 세션에 `User.id`/role/points 주입.
  (Kakao 로그인은 사업자등록 필요로 **맨 뒤 Phase**로 연기. 즐겨찾기 영속화도 로그인 연결 이후 단계에서.)
- 사진 업로드: **Supabase Storage**(서버 전용 service_role 키, public 버킷 `sale-photos`).

### Phase 4 — 신뢰·안전
- 신고/정정 접수, 신고 N건 시 자동 숨김
- 최소 관리 화면: 신고 큐 보기 / 가게 인증 승인·반려
- 회원 탈퇴 + 데이터 삭제, 개인정보처리방침/약관 정적 페이지

### Phase 6 — 가게 등록 (소비자) + 출처 구분
- 로그인 사용자가 **가게를 직접 등록**(가게명/카테고리/주소→지오코딩 좌표/전화/소개). 미인증(verified=false)으로 등록 → 관리자 승인은 Phase 4 가게 인증.
- `Store.source(user|merchant)`: **소비자(주민) 등록 vs 사장님 등록을 지도 핀·상세에서 시각 구분.**
- **사장님 직접 등록/인증은 별도 후속 단계**(아래). 인증 방식은 **사업자등록증 서류 업로드 + 관리자 수동 승인**(외부 API 미사용)으로 확정.
  - 즉 Out of Scope 였던 "사장님 직접 등록"은 *소비자 가게 등록* 까지만 우선 In Scope 로 편입하고, merchant 권한/대시보드는 다음 단계로 유지.

### Phase 7 — 사장님(merchant) + UX 개선
> Out of Scope 였던 "사장님 직접 등록/사업자 전환/내가게 관리"를 In Scope로 편입. 인증은 **서류 업로드 + 관리자 수동 승인**(국세청 API 미사용). 여러 하위 단계로 진행.
- **7a 사장님 인증**: `MerchantVerification`(사업자등록증 이미지·대상 가게·상태). 사장님이 업로드 → 관리자가 **이미지 확인 후 승인/반려**. 승인 시 `UserRole=merchant` + 해당 `Store.ownerId` 지정(`source=merchant`, `verified=true`).
- **7b 메뉴(상품) 관리/권한**:
  - **사장님(owner)·관리자 소유 가게**: 소유자·관리자만 메뉴 추가/수정/삭제. 일반 소비자는 세일 제보만.
  - **사장님 미등록(소비자 등록) 가게**: 로그인한 누구나 메뉴 추가/수정/삭제(커뮤니티 방식). 단 **메뉴마다 사진 필수**, **등록자 닉네임/프사·갱신일 표시**, **메뉴별 신고 버튼**(허위/음란 등 → 신고 누적 시 자동 숨김, 관리자 검토·작성자 정지).
  - **가게 표시**: 소비자 등록 가게는 **최초 등록자 닉네임/프사** 노출. 사장님이 정식 가입·인증해 소유하면 **'사장님 관리' 표시** + 최초 등록자는 작게.
- **7c 가게 상세 UI**: 상단 **메인 사진(배너, `Store.bannerUrl`)** + 가게명 + 탭(상품/세일/공지/리뷰).
- **7d 즐겨찾기 별도 메뉴**(`/favorites`): 가게별 **세일 여부** 표시 + 클릭 시 **위치 무관하게** 해당 가게 상세(메뉴/세일/리뷰) 바로 열람.

### Phase 5 — 인증 확장 (후순위, 별도 진행)
> 1-1의 "전화번호 로그인은 후순위" 및 추가 요청사항을 묶은 별도 단계. 여러 하위 단계로 나눠 진행한다.
- 전화번호 로그인 + 간단 회원가입(이름/닉네임/연락처)
- 휴대폰 번호 본인확인: SMS 인증번호(4~6자리) 발송·검증 (외부 SMS 발송사 키·비용 필요)
- Kakao 로그인 활성화(사업자등록 완료 후)
- 마이페이지 + **소셜 계정 연결/병합**(전화번호 가입자가 Naver/Kakao 연결 → 이후 소셜로도 로그인)
  - 경량 Identity 테이블로 구현(JWT 유지). 연동 시 별개 계정이면 **계정 병합**:
    포인트 합산·즐겨찾기 통합·작성물/신원 이전 후 상대 계정 삭제.
- **포인트 정책**: 잔액의 출처는 PointLog 합계. **내역 조회는 최근 2년**, **적립 후 5년 경과분은 소멸**(잔액 제외).
  각 적립은 날짜 + 경로(reason)와 함께 마이페이지에서 열람.
- 개인정보 영향: 휴대폰 번호 수집은 스펙 6장 "수집 최소화"를 넓히므로, 개인정보처리방침/약관에 반영 필수.

> 각 Phase 완료 시 동작 확인 후 커밋(commit). 다음 Phase는 사용자 승인 후 진행.

---

## 6. 비기능 요구사항 (Non-Functional)

- **개인정보**: 수집 최소화(이메일/닉네임/프로필만). 위치정보 미수집. 탈퇴 시 즉시 또는 N일 내 파기.
- **보안**: API 키·시크릿은 환경변수. 클라이언트에 노출되는 카카오 JS 키와 서버용 REST 키 분리.
- **어뷰징 방어**: 동일 사용자 단시간 다중 제보 레이트리밋(rate limit), 포인트는 전부 pending.
- **빈 화면(empty state)**: 데이터 0건일 때 "이 동네는 아직 정보가 없어요. 첫 제보를 남겨보세요" 유도.
- **데이터 신선도**: 상품/세일에 "마지막 업데이트 N일 전" 표시. 세일은 만료시간 지나면 자동 비활성.
- **반응형**: 모바일 웹 우선(mobile-first).

---

## 7. Claude Code 작업 규칙

- 한 번에 한 Phase만. 끝나면 멈추고 사용자 확인을 받는다.
- Out of Scope 기능은 구현 금지. 필요하면 `// TODO(phase-X):` 주석만.
- 모든 외부 API(카카오/네이버)는 키 없이도 빌드가 깨지지 않도록 환경변수 가드(guard) 처리.
- 커밋 메시지는 `feat:`, `fix:`, `chore:` 컨벤션.
- 새 라이브러리 추가 시 이유를 한 줄로 설명.