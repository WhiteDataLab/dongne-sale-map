# DESIGN_CHANGELOG — 비주얼 리뉴얼 시안 기록 (AS-IS → TO-BE)

> 디자이너 비주얼 브리프(`VISUAL_DESIGN_BRIEF.html`)에 따른 시각 리뉴얼의 **변화 기록**.
> 컴포넌트별로 **AS-IS(기존) → TO-BE(개선) → 변화 형태 → 매출 레버**를 남긴다.
> 원칙: 구조·IA·API·결제 흐름 불변, **시각만**. 토큰 단일 출처 = [`../src/app/globals.css`](../src/app/globals.css) `:root`.
> 시안은 **코드/마크업 AS-IS↔TO-BE 비교**로 남긴다(레포 내 영속 기록). 실제 렌더 확인은 dev 프리뷰.
> 기획자용 요약 보고서: [`DESIGN_REPORT.md`](DESIGN_REPORT.md) (이 파일은 그 상세 부록).

## 디자인 토큰 한 벌 (단일 출처)
| 역할 | 토큰 | 값 |
|---|---|---|
| 신뢰·결제·1차 CTA | `--blue` / `--blue-ink` / `--blue-wash` | #3182F6 / #1B64DA / #EAF2FE |
| 시그니처(세일·마감임박만) | `--deal-1`→`--deal-2` (`--deal-grad`) | #FF6B35 → #FF3B30 |
| 본문·가격·제목 | `--ink` / `-2` / `-3` / `-4` | #191F28 / #4E5968 / #8B95A1 / #B0B8C1 |
| 인증 배지 | `--verify` / `--verify-wash` | #12B886 / #E6F8F1 |
| 경계·면 | `--line` / `--surface-2` | #E5E8EB / #F7F8FA |
| 반경 | `--r-card` / `--r-chip` / `--r-btn` / `--r-pill` | 20 / 14 / 14 / 999 |
| 그림자 | `--sh-1` / `--sh-pin` / `--sh-2` | 카드 / 핀 / 시트 |
| 모션 | `--ease` | cubic-bezier(.2,.8,.2,1) |
| 서체 | Pretendard(셀프호스팅 가변폰트) | 가격 = `.num`(tabular) |

---

## P0 — 디자인 토큰 + 글로벌 스타일  ✅ (커밋 `2ff4043`)

### 0-1. 서체 / 전역 톤
- **AS-IS**: 시스템 폰트 스택(`ui-sans-serif, system-ui, Apple SD Gothic Neo, Malgun Gothic`). 토큰 없음, 색은 컴포넌트마다 Tailwind 기본(`blue-600`#2563EB, `red-500`, `gray-*`)을 직접 사용 → 화면별 색·반경 제각각.
- **TO-BE**: **Pretendard** 가변폰트(100~900) 셀프호스팅. `:root`에 디자인 토큰 한 벌 + `@theme inline`로 Tailwind 유틸(`bg-brand`/`text-ink-2`/`border-line`) 노출. `.num` tabular 가격 정렬.
- **변화 형태**: 색·타이포·반경·그림자·모션이 **단일 토큰**으로 수렴. 화면이 "정밀해서 비싸 보이게".
- **매출 레버**: 전 화면 신뢰도 ↑ → 결제 직전 망설임 제거(L1).

### 0-2. 포커스 링 / 공통 버튼·배지
- **AS-IS**: 포커스 `2px #2563EB`. 신뢰 배지·CTA가 컴포넌트마다 임의 스타일.
- **TO-BE**: 포커스 `3px rgba(49,130,246,.55)`(브랜드). 공통 클래스 `.badge`(official/pro/verify/store 필) · `.btn-cta`(primary/deal/block) 추가.
- **변화 형태**: 신뢰 신호를 **한 형태(필 pill)**, 의미별 색 하나씩으로 통일.

### 0-3. 필터바 칩
- **AS-IS**: `rounded-full border` 칩, 선택 시 `bg-blue-600`(#2563EB), 회색 `gray-200/700`.
- **TO-BE**: 동일 구조에 토큰 적용 — 선택 `bg-brand`(#3182F6), 비선택 `border-line`/`text-ink-2`, `font-semibold`.
- **변화 형태**: 글랜서블 필 + 브랜드 블루 선택 상태.

### 0-4. 지도 핀·클러스터 색 (구조 유지, 색만)
- **AS-IS**: 세일 배지 솔리드 `#EF4444`, 마감임박 `#F97316`, 클러스터/현재위치 `#2563EB`/`#3B82F6`, 폐업 `#111827`.
- **TO-BE**: 세일·마감임박·클러스터 가격 → `--deal-grad`(따뜻한 그라데이션), 클러스터/현재위치/포커스 → `--blue`, 폐업 → `--ink`. 펄스 색도 deal로.
- **변화 형태**: "온도는 세일·임박에만" 원칙 — 따뜻함을 시그니처 지점에 집중.
- **매출 레버**: 핀 매력 ↑ → 상세 진입(detail_open) ↑.

---

## P1 — 매출 직결 컴포넌트  ✅

### P1-a. 가격 핀 시그니처  ✅
파일: [`MapExplorer.tsx`](../src/components/MapExplorer.tsx) `buildPinElement` + [`globals.css`](../src/app/globals.css) `.store-pin--deal`
- **AS-IS**: 모든 핀이 `이모지 + 가게명` 알약(pill). 세일은 끝에 작은 빨강 배지 `🔥 2,900원~`(10px). 가격이 이름에 묻혀 글랜스가 안 됨.
  ```
  [ 🥬 행복 청과  🔥2,900원~ ]   ← 이름이 주인공, 가격은 보조
  ```
- **TO-BE**: 세일 가게는 **이름을 빼고 가격이 주인공**인 흰 카드(`--r-chip`, `--sh-pin`). 가격 15px·**800 weight**·`.num`, `원~`은 작게(`--ink-3`). 마감임박엔 따뜻한 `--deal-grad` 칩 `⏰ 23분` + 펄스. 스폰서 세일은 금색 카드 유지. 비세일 가게는 이름핀(톤만 통일).
  ```
  [ 🥬 2,900원~  ⏰23분 ]   ← 가격이 주인공, 임박만 따뜻하게
  ```
- **변화 형태**: "0.5초에 싸다 + 지금". 이름 → 가격으로 초점 이동, 온도는 마감임박에만.
- **매출 레버**: 핀 매력 ↑ → 상세 진입(detail_open) ↑ → 사장님에게 보여줄 반응 데이터 ↑.
- 검증: tsc·dev 프리뷰에서 시그니처/임박/스폰서/이름핀 4종 렌더 확인.

### P1-b. '우리 가게 반응' 패널 + 잠금 업셀  ✅
파일: [`MerchantDashboard.tsx`](../src/components/MerchantDashboard.tsx) `stats` 섹션 (`/manage`)
- **AS-IS**: 6개 지표를 `grid-cols-3` 작은 카드(파랑 배경 `bg-blue-50/60`)에 균등 나열, 각 카드 "오늘(큰 글씨)·7일(작게)". 위계 없음 → 무엇이 중요한지·다음 행동이 안 보임. 업셀은 회색 텍스트 한 줄.
- **TO-BE**: **숫자를 느끼게**. ① 큰 히어로 「이번 주 **152**명이 봤어요」(`text-4xl/800/.num`) + 보조 「오늘 N명」. ② 미니 스탯 `grid-cols-2`(상세 열람/길찾기/**🏃 갈래요**(deal 색 강조)/즐겨찾기, `bg-surface-2`). ③ **'값 보여주고 자물쇠'** 업셀 카드(무료 티어만, dashed `border-brand`·`bg-brand-wash`) — 「단골에게 세일 알림 보내기 · 갈래요한 23명부터 · 전단지 한 장 값 [라이트부터]」. ④ 티어 사다리: 무료→라이트 잠금카드 / 라이트→프로 업셀 / 프로→`ProStats`(하나의 다음 행동만 노출).
- **변화 형태**: 균등 나열 → **큰 숫자 위계 + 단일 업셀**. "갖고 싶게 만든 뒤 잠근다".
- **매출 레버**: 무료→라이트→프로 전환율(L1, 가장 빠른 매출 + ARPU).
- 검증: tsc·dev 프리뷰 computed style 확인(히어로 36px/800/`--ink`, 갈래요 `--deal-ink`, 잠금카드 `--blue-wash`/`--blue` 정확).

### P1-c. 요금제 카드 (Free/Lite/Pro)  ✅
파일: [`sponsor/page.tsx`](../src/app/stores/[id]/sponsor/page.tsx) + [`SponsorSubscribeButton.tsx`](../src/components/SponsorSubscribeButton.tsx)
- **AS-IS**: 라이트(에메랄드)·스폰서(앰버)·프로(인디고 '추천') 3카드가 **기능 나열** 중심, 색이 제각각(emerald/amber/indigo). 가격은 본문 크기. Free 기준선 없음 → 가치 사다리·앵커링 부재. 버튼은 amber/indigo.
- **TO-BE**: **결과로 프레이밍 + 앵커링**. ① **FREE 기준선** 카드 추가(「게시판에 올라가요 · 0원」, `bg-surface-2`) — "지금도 무료"로 유료 가치 대비. ② **라이트 = '가장 인기'** 추천 띠 + `border-2 border-brand` + 블루 글로우, role 「손님에게 먼저 연락해요」, 가격 `text-2xl/800/.num`, 버튼 `tone=primary`(블루). ③ **스폰서** 중립 카드(「지도에서 눈에 띄어요」, 버튼 `tone=neutral`). ④ **프로 = 다크 앵커**(`#10243F→#0B1A2E` 그라데이션, 최상위 가격, role 「단골을 데이터로 관리해요」, 버튼 `tone=dark` 흰 버튼). 트라이얼 안내는 `deal-wash` 필. `SponsorSubscribeButton`: `accent:boolean` → **`tone: primary|neutral|dark`** 로 확장.
- **변화 형태**: 기능 나열 → **결과 프레이밍 + 라이트 추천 + 프로 다크 앵커링**(임펄스 전환 유도).
- **매출 레버**: 가격 화면 자체가 전환 표면(L1 직접).
- 검증: tsc·dev 프리뷰 computed style(FREE `--surface-2`, LITE 보더/리본 `--blue`, PRO 다크 그라데이션·`#9DC2FF`, 트라이얼 `--deal-wash`/`--deal-ink`).

### P1-d. 세일 카드 · 예약/갈래요 CTA  ✅
파일: [`SaleReserveBox.tsx`](../src/components/SaleReserveBox.tsx) · [`SaleListPanel.tsx`](../src/components/SaleListPanel.tsx) · [`SaleMarquee.tsx`](../src/components/SaleMarquee.tsx)
- **AS-IS**:
  - 예약 박스(`SaleReserveBox`): 장미색(rose) 톤, 작은 회색 버튼 `bg-rose-600`, 남은 수량은 회색 텍스트, **카운트다운 없음**.
  - 세일 목록(`SaleListPanel`): 정렬 칩 `blue-600`, 가격 배지 `bg-red-50 text-red-600`(13px), 이름 `font-medium`.
  - 마퀴: 다크 스트립 + 앰버 가격.
- **TO-BE**:
  - 예약 박스: **deal 그라데이션 CTA**(`--deal-grad` + 그림자, "예약하고 픽업"), **⏰ 카운트다운 「N 후 픽업 마감」**, "N개 남음" deal 필, 수량 스텝퍼·텍스트 토큰화. 예약완료/마감 상태도 deal-wash/surface-2로.
  - 세일 목록: 정렬 칩 → `bg-brand`, 가격 배지 → **`bg-deal-wash text-deal-ink` 14px/800/.num**(가격이 주인공), 이름 `font-bold text-ink`, 구분선 `--line-2`.
  - 마퀴: 다크 유지(지도 위 가독성) + 가격 `.num/800` 통일.
- **변화 형태**: 거래(GMV)·광고(CPA)가 걸린 예약 버튼을 **따뜻한 그라데이션 + 카운트다운**으로 "지금" 강조. 목록은 가격을 키워 결정 속도 ↑.
- **매출 레버**: 예약 전환(L2 GMV) · 갈래요/길찾기 CPA(L3).
- 검증: tsc·dev 프리뷰 computed style(예약 박스 deal-wash/deal-ink·deal 그라데이션 버튼·opacity 변형 정상, 목록 가격 deal 필).

---

## P2 — 디테일 · 빈 화면 · 토큰 확산  ✅

### P2-1. 엠프티 스테이트 (빈 동네 → 첫 제보 초대)
파일: [`MapExplorer.tsx`](../src/components/MapExplorer.tsx) · [`StoreSheet.tsx`](../src/components/StoreSheet.tsx) `EmptyState`
- **AS-IS**: 빈 동네 = 검은 알약 「이 동네는 아직 정보가 없어요 / 첫 제보를 남겨보세요!」. 시트 빈 상태 = 회색 텍스트.
- **TO-BE**: 흰 카드(🗺️ 아이콘 + 「이 동네는 아직 비어 있어요 / 첫 세일·가게를 제보하면 이웃들이 함께 봐요」, `--sh-1`·`border-line`). `EmptyState`는 `--ink-3`로 통일.
- **변화 형태**: 막다른 빈 화면 → **초대(첫 제보 유도)**. 매출 레버: 콘텐츠 공급(트래픽 품질의 시작).

### P2-2. 신뢰 배지 통일 (공통 `.badge`)
파일: [`StoreSheet.tsx`](../src/components/StoreSheet.tsx) 헤더 · [`ReviewContent.tsx`](../src/components/ReviewContent.tsx)
- **AS-IS**: 공식=emerald, 공식 프로=indigo, 영수증=blue, 사진=green — 화면마다 제각각 색·형태.
- **TO-BE**: 공통 `.badge` 한 벌 — 공식 `badge--official`(블루), 공식 프로 `badge--pro`(블루 그라데이션), 영수증 인증 `badge--verify`(그린, 가장 강한 신뢰), 사장님 직접 관리 `badge--store`(잉크). 사진 인증·인증중·주민관리는 중성(`surface-2`/`ink-3`)으로 위계 정리.
- **변화 형태**: 의미별 색 하나씩, 한 형태(필)로 — 산만함 없이 신뢰만. 매출 레버: 방문/결제 직전 안심(전환 윤활유).

### P2-3. ProStats · 벤치마크 토큰 확산
파일: [`StoreSheet.tsx`](../src/components/StoreSheet.tsx) `ProStats`/`Benchmark`
- **AS-IS**: indigo 차트 막대·indigo/gray 텍스트, 벤치마크 green/amber.
- **TO-BE**: 막대 `--blue`(요일별 `/55`), 텍스트 `--ink` 계열·`.num`, 벤치마크 카드 `--brand-wash`, 평균 대비 ≥100% `--verify-ink` / 미달 `--deal-ink`.

### P2-4. 공유 랜딩 `/s/[id]` 토큰
파일: [`s/[id]/page.tsx`](../src/app/s/[id]/page.tsx)
- **AS-IS**: 제목/주소 gray, 세일가 `text-red-600`, 만료 `bg-red-50`, CTA `bg-blue-600`, 배지 green/amber/gray.
- **TO-BE**: 제목 800/`--ink`, 세일가 `text-lg/800/.num/--deal-ink`, 만료 `--deal-wash` 필, 세일 수 `--deal-ink`, CTA `--blue`(hover `--blue-ink`)·공유 버튼 중성, 영업상태 verify/deal/중성 배지, 카드 `--sh-1`/`--line`.
- **변화 형태**: 외부 공유 첫인상을 본 앱과 동일한 토스급 톤으로 — 가격이 주인공. 매출 레버: 공유 유입 전환(바이럴 표면).
- 검증: `/s/[id]` 실제 렌더 스크린샷 확인(영업중 verify 배지·brand CTA·surface-2 엠프티 카드·ink 타이포).

### P2-5. 공유 OG 동적 이미지 (링크 미리보기 카드)
파일: [`s/[id]/opengraph-image.tsx`](../src/app/s/[id]/opengraph-image.tsx) (신규) · `assets/og/*.woff` · `next.config.mjs`
- **AS-IS**: OG/트위터 이미지 = 가게 대표사진 또는 없음(`generateMetadata` 수동 images). 사진 없으면 미리보기 밋밋, 브랜드 일관성 X.
- **TO-BE**: `next/og ImageResponse`로 **브랜드 OG 카드(1200×630) 동적 생성** — deal 그라데이션 브랜드 마크 + "동네 세일 지도" + 가게명(800/ink) + 업종·주소 + **세일 시 deal-wash 펄 카드(「진행중인 세일 N건」 + 대표 세일 + 대형 가격 ExtraBold deal-ink)**, 세일 없으면 「메뉴·리뷰를 확인해보세요」 폴백. **Pretendard woff**(satori는 woff2/이모지 미지원 → woff + 도형/텍스트). `generateMetadata`의 수동 images 제거(동적 카드가 자동 연결). `outputFileTracingIncludes`로 Vercel 람다에 폰트 포함.
- **변화 형태**: 사진 의존 → **항상 브랜드 일관된 가격 중심 미리보기**. 매출 레버: 카톡/SNS 공유 클릭률 → 바이럴 유입.
- 검증: dev에서 `/s/[id]/opengraph-image` 200·image/png, 세일/폴백 두 변형 실제 렌더 스크린샷 확인(한글 Pretendard·대형 가격 정상), 프로덕션 빌드 통과.

### P2-6. 관리자 공통 크롬 + 허브 토큰화
파일: [`admin/layout.tsx`](../src/app/admin/layout.tsx) · [`admin/page.tsx`](../src/app/admin/page.tsx)
- **AS-IS**: 네비/헤더·허브 카드가 `gray-*`/`blue-600`/`red-100`/`blue-100` 등 기본색.
- **TO-BE**: 네비 라벨 `--ink-3`·링크 `--ink-2`(hover `--ink`), 헤더 `border-line-2`·"관리 콘솔" 800/`--ink`, 권한 안내 링크 `--brand`. 허브 카드 `border-line`·제목 `font-bold/--ink`·설명 `--ink-3`, 대기 배지 = 신고 `deal-wash/deal-ink`·사장님 `brand-wash/brand-ink`·기타 대기 amber(경고 유지) + `.num`.
- **변화 형태**: 전 admin 페이지가 공유하는 크롬을 토큰으로 통일(내부 화면 일관성).
### P2-7. 스크롤 등장 확산 + admin 본문 토큰 일괄
파일: [`s/[id]/page.tsx`](../src/app/s/[id]/page.tsx) (`Reveal`) · `src/app/admin/**` + admin 컴포넌트(`BrandAdmin`/`GiftAdmin`/`LocalAdAdmin`/`NoticeAdmin`)
- **스크롤 등장**: 공개 스크롤 페이지 `/s/[id]`의 세일 카드를 `Reveal`(fade+up)로 **스태거 등장**(delay = index×70ms, 최대 6단). `/about`에만 있던 Apple식 등장 모션을 공개 공유 표면으로 확산.
- **admin 본문 토큰(코드모드 1회)**: 17개 admin 페이지 + 4개 admin 컴포넌트의 **중성 회색·일반 블루** 클래스 **311건**을 토큰으로 일괄 치환(`gray-* → ink/line/surface-2`, `blue-600/700 → brand/brand-ink`, `bg-blue-50 → brand-wash`). **의미색(red 위험·green 성공·amber 경고·emerald·indigo·rose)은 보존**. 매핑 검토 후 1회 적용·스크립트 삭제.
- **변화 형태**: 공개 페이지 모션 일관 + 운영 화면까지 토큰 단일화(앱 전체 톤 수렴).
- 검증: tsc·lint·프로덕션 빌드 통과, `/admin`·`/s/[id]` 200 렌더 확인.

### P2-8. 앱 전역 토큰 정비 (소비자 화면 전체)
파일: `src/components/**` + `src/app/**`(admin 제외) — `/account`·`/shop`·`/coupons`·`/reservations`·`/notifications`·`/checkin`·`/invite`·`/support`·`Header`·`SideNav`·`StoreSheet`·정적 안내 페이지 등 **71개 파일**
- **AS-IS**: 브리프 지목 컴포넌트 외 다수 소비자 화면이 레거시 `gray-*`/`blue-600`/`blue-50`·`focus:ring-blue-*`를 직접 사용 → P0~P2로 만든 토큰과 혼재.
- **TO-BE**: 검증된 코드모드로 **873건 일괄 토큰화** — `gray-* → ink/line/surface-2`, `blue-600/700 → brand/brand-ink`, `bg-blue-50/100 → brand-wash`, `focus:ring/border-blue-* → brand`, `border-blue-200 → border-brand/40`. **의미색(red/green/amber/emerald/indigo/rose) 보존**. SideNav/Header/정적 페이지까지 톤 수렴.
- **변화 형태**: 토큰 시스템의 **앱 전역 채택 완료** — 디자인 토큰이 진짜 단일 출처가 됨.
- 검증: tsc·lint·프로덕션 빌드 통과, 홈·SideNav 드로어 실렌더 스크린샷 확인(그룹 라벨/링크/CTA 토큰 일관). 잔여 비매핑 클래스(다크 배경·`bg-gray-200` 활성·PhotoEditor 캔버스 UI 등)는 적절한 컨텍스트라 보존.

**남은 후속(선택, 매우 낮음)**: 잔여 비매핑 색 미세정리, 정적 안내 페이지 모션. 디자인 시스템 채택은 사실상 완결.

---

## 후보 B (벤토 웜 톤) 리뉴얼 — 디자이너 핸드오프 Part 1/2 반영

> 출처: `MENU_DESIGN_HANDOFF.md`(Part 1, 메뉴 리스트) + `DESIGN_HANDOFF_PART2.md`(Part 2, 전 화면 확산).
> 컨셉: **벤토 따뜻한 아이보리 베이스 + 가격 800 주인공 + 세일=따뜻함(딱 한 곳) + 50~60대 큰 글씨·큰 터치·고대비.**
> 실행 순서(Part2 부록): ①토큰 → ②메뉴 리스트 → ③대시보드 → ④지도 핀·마퀴 → ⑤공용 → ⑥공유+reduced-motion.

### B-1. 토큰 갱신 (벤토 웜 베이스 + 대비 강화)
파일: [`globals.css`](../src/app/globals.css) `:root` · `@theme inline` · `body`
- **AS-IS**: 베이스가 쿨/화이트 — `--surface-2 #F7F8FA`, `--line #E5E8EB`, `--line-2 #EDF0F3`, `--ink-3 #8B95A1`, `--deal-ink #E0331F`, `--deal-wash #FFF1ED`. 페이지 배경 = `--surface`(흰색).
- **TO-BE**: **벤토 웜 톤** + 점검 지적 저대비 회색 상향 —
  - 베이스: **`--bg #FBF6EF`(아이보리, 페이지 배경 신설)**, `--surface #FFFFFF`(카드 유지), `--surface-2 #F7F2EA`(웜), `--line #ECE3D5`/`--line-2 #F2ECE1`(웜 보더).
  - 잉크 대비: `--ink-3 #8B95A1 → #6F7884`(명암비 ↑). `--ink-4 #B0B8C1`는 값 유지하되 **장식 한정**(의미 텍스트 금지) 정책.
  - 세일: `--deal-ink #E0331F → #D62D14`(웜 배경 위 ≥4.5:1), `--deal-wash #FFEAE0` + **`--deal-wash-2 #FFF2EC` 신설**. `--deal-1/-2`·`--deal-grad`는 유지(주황→빨강).
  - 신규: `--r-row 16px`, `--sh-card`(웜 그림자), `--sh-sale`(세일 글로우), **접근성 하한**(`--fs-base/-name/-price/-sale-price`, `--tap-min 48px`/`--tap-primary 56px`).
  - `body` 배경 = `var(--bg)`, `--background → var(--bg)`. `@theme inline`에 `--color-deal-wash-2`/`--color-bg`/`--color-surface`/`--radius-row` 노출.
- **변화 형태**: 토큰 한 벌만 바꿔 **전 화면이 따뜻한 톤으로 자동 정렬**(P2.8에서 전역 토큰화 완료 덕분). 의미색(blue/green/amber)·세일 시그니처는 보존.
- 검증: dev 프리뷰 computed style 확인(`--bg #fbf6ef`·body bg `rgb(251,246,239)`·`--deal-ink #d62d14`·`--ink-3 #6f7884`·`--line #ece3d5`), `/`·`/faq` 실렌더 스크린샷(웜 베이스+흰 카드+웜 보더, 대비 회귀 없음), 콘솔 에러 0.

### B-2. 메뉴 리스트 — 세그먼트 토글 + 세일 행 강조 (전환 핵심)
파일: [`StoreSheet.tsx`](../src/components/StoreSheet.tsx) `ProductsTab` · [`globals.css`](../src/app/globals.css)(`.seg-toggle`/`.menu-list`/`.menu-row`/`.badge-off`) · [`types.ts`](../src/lib/types.ts)(`SaleDTO.productId` 추가) · [`api/stores/[id]/route.ts`](../src/app/api/stores/[id]/route.ts)
- **AS-IS**: 메뉴 탭이 `<ul>` 단순 행(64px 썸네일 + 14px 이름 + 14px 가격). 세일은 별도 탭에만. 세일/일반 구분·필터 없음, 가격이 작아 주목도 약함.
- **TO-BE**: 후보 B **단일 세로 리스트 + "전체 N / 🔥 세일만 N" 세그먼트 토글**(`role="tablist"`). 상품(메뉴) 행을 활성 세일(`Sale.productId` 연결분, 이미 존재)과 클라이언트에서 매칭 —
  - **세일 행**(`.menu-row--sale`): 웜 그라데이션 풀블리드 배경 + **할인% 배지**(`--deal-grad`, off=round(1−sale/price)) + **원가 취소선**(`<s>`) + **실시간 카운트다운**(`Countdown` 재사용) + 세일가 `--deal-ink` 21px/800. **항상 리스트 최상단 고정**(전체 모드에서도 세일 먼저 정렬).
  - **일반 행**: 이름 16.5px/700 + 가격 21px/800 `.num` + 메타(단위·원산지·재고).
  - **이모지/썸네일 칩 42px**: 사진 있으면 썸네일, 없으면 카테고리 이모지(`CATEGORY_META.icon`).
  - **세일만 0건**: 안내 카드 "오늘은 세일이 없어요" + [전체 보기] 버튼.
  - **50~60대 접근성**: 토글 ≥56px·메뉴추가/전체보기 버튼 ≥48px·관리 칩 ≥40px, 본문 ≥16px, 가격 `.num` 정렬.
  - **구조 불변**: 상품과 연결되지 않은 단독 세일은 기존 세일/행사 탭에 그대로(메뉴 리스트는 메뉴=상품 기준). API는 `SaleDTO.productId` **추가(additive)** 만, 엔드포인트·결제·IA 불변.
- **변화 형태**: "전체/세일만" 토글로 세일을 한 번에 골라보게 만들어 **세일 주목→갈래요·길찾기 전환**을 설계(Part1 §10 효과측정의 '세일 토글 사용률').
- 검증: dev 프리뷰 **computed style 정밀 확인**(세그먼트 토글 min-height 56·선택 흰 배경, 세일 행 min-height 62·웜 그라데이션, 세일가 `rgb(214,45,20)`=`#d62d14`, 일반가 21px/800, 할인 배지 deal 그라데이션+흰 800, 이모지 칩 42×42 r13, 메뉴명 16.5/700, 375px 뷰포트 레이아웃 정상 분배), `tsc`·`lint`·**프로덕션 빌드 통과**, dev Fast Refresh 무에러. (스크린샷 도구는 환경 이슈로 타임아웃 → 색·크기는 권장 방식인 computed style로 검증.)

### B-3. 사장님 대시보드 — 후보 B 톤 보완 (매출 핵심)
파일: [`MerchantDashboard.tsx`](../src/components/MerchantDashboard.tsx) · [`stores/[id]/sponsor/page.tsx`](../src/app/stores/[id]/sponsor/page.tsx)
- **이미 충족(P1-b/P1-c)**: '우리 가게 반응' 히어로 숫자 + 갈래요 `--deal-ink` 강조 + '값 보여주고 자물쇠' 업셀 + 요금제 4카드(FREE 앵커·LITE 추천 띠·SPONSOR 중립·**PRO 다크 앵커**). Part2 §3 구조는 P1에서 구현됨.
- **보완(B-3, Part2 §3 디테일·접근성)**:
  - **히어로 숫자**: `text-4xl`(36px) → **`text-[38px]`/800**(Part2 §3-1 정확값), "명이 봤어요" 14→16px.
  - **잠금 업셀 터치**: `min-h-[56px]` 부여(Part2 §3-2 ≥56px), 아이콘·문구 크기 상향.
  - **ink-4 의미 텍스트 제거**: "최근 7일 합계" 캡션 `text-ink-4`→`text-ink-3`(+10→12px), 요금제 법적 안내 `text-ink-4`→`text-ink-3`(ink-4는 장식 한정 정책).
  - **비토큰 색 통일(블루·중성)**: 플랜 배지 `indigo-100/700`→`brand-wash/brand-ink`, 미인증 배지 `gray-200`→`surface-2`, 구독 패널·3-way 플랜 스위처 `indigo-*`→`brand`/`brand-ink`/`brand-wash`. (현재 플랜 amber 카드는 스폰서 금색과 동일한 프리미엄 액센트라 유지.)
  - **작은 폰트 상향**: 미니스탯 라벨 11.5→13px, 플랜 혜택 보조 10·11→12px, 플랜 변경/플랜보기 버튼 `min-h-[48px]`.
  - **PRO 다크 카드 대비 확인**: gradient 상단(`#10243F`) 기준으로도 본문 `#B8C7DD`≈9:1·라벨/가격단위 `#9DC2FF`/`#7E9ECB`≈5.7:1 — 모두 ≥4.5:1 통과(변경 불필요).
  - **델타(+N%)**: 전주 대비는 이전 7일 집계가 없어 보류(`TODO(out-of-scope)` 주석) — 데이터 날조 대신 '오늘 N명' 보조 노출 유지.
- **변화 형태**: "사장님이 숫자를 느낄 때 결제한다" — 히어로·갈래요·자물쇠 업셀의 위계·터치·대비를 어르신 사장님 기준으로 마감. 매출 레버: 잠금 업셀 클릭 → 라이트/프로 업그레이드(L1).
- 검증: `tsc`·`lint`·**프로덕션 빌드 통과**. 토큰 해석은 B-1에서 확인됨(`--brand-wash`/`--deal-ink` 등), 변경은 결정적 Tailwind 유틸 스왑(로직 무변경). ⚠️ `/manage/[id]`는 소유자 인증이 있어야 렌더되고 스크린샷 도구가 환경상 불가 → 실인앱 화면은 배포본에서 사장님 계정으로 확인 권장.

### B-4. 지도 핀·마퀴 (Part2 §2)
파일: [`globals.css`](../src/app/globals.css)(`.store-pin`/`.store-pin--selected`/`.store-cluster`) · [`MapExplorer.tsx`](../src/components/MapExplorer.tsx)(`buildPinElement` selected 인자·빈 동네 CTA)
- **이미 충족**: 4종 핀(세일 가격 800·마감임박 deal 칩 펄스·스폰서 금색·일반 이름핀, P1-a), 마퀴 다크 밴드+`.num`+hover/reduced-motion 정지(P0).
- **보완(B-4)**:
  - **선택 핀**: `.store-pin--selected`(scale 1.12 + `0 0 0 3px var(--blue)` 링) 신설 + `buildPinElement(store, selected, onClick)`로 현재 열린 가게 핀 강조(effect deps에 `selectedStoreId`).
  - **클러스터 흰 원**(§2-1): `--blue` 채움 → **흰 카드(surface)+웜 보더(line)+52px**, 카운트 `--ink`, 최저가 칩 `--deal-wash`/`--deal-ink`(세일 신호만 따뜻).
  - **핀 히트영역 ≥44px**: `.store-pin { min-height: 44px }`(어르신 터치).
  - **빈 동네 CTA**(§2-3): 정보 카드(막다른 화면) → **[➕ 제보하기] ≥56px 버튼** 추가(등록 모드 진입), 본문 14→16px.
- **변화 형태**: 시그니처 표면(지도)에서 세일=따뜻함, 선택/클러스터/현재위치=블루·중성 원칙 일관. 매출 레버: 핀 노출→상세 진입.
- 검증: dev 프리뷰 **computed style**(핀 height 44, 선택 핀 boxShadow에 `rgb(49,130,246) 0 0 0 3px`·transform 1.12, 클러스터 흰 배경+웜 보더 52px·가격 `#d62d14` on `#ffeae0`), `tsc`·`lint`·프로덕션 빌드 통과. (지도 SDK는 localhost 미등록으로 인앱 렌더 불가 → 마크업 주입 computed style로 검증.)

### B-5. 공용 컴포넌트 접근성 (Part2 §4)
파일: [`globals.css`](../src/app/globals.css)(`.btn-cta`) · [`ReviewForm.tsx`](../src/components/ReviewForm.tsx)
- **이미 충족**: 신뢰 배지(`.badge--official/pro/verify/store` 아이콘+텍스트, P0), 그래프(추이=상승빨강/하락파랑 `PriceChart`·통계 막대 `--blue` `ProStats`, P2-3), `:active scale` reduced-motion(P0).
- **보완(B-5)**:
  - **CTA 버튼**: `.btn-cta { min-height: 52px }` + 14→15px(§4-1 주요 ≥52px).
  - **리뷰 입력**(§4-6): 별점 버튼 탭영역 `size-11`(≥44px), textarea **16px**(`text-base`)+`bg-surface-2`+**포커스 링**(`focus:border-brand focus:ring-2 focus:ring-brand/30`), 등록 버튼 `min-h-[52px]`/800/`disabled:bg-ink-4`.
  - **제외**: §4-2 스타일드 on/off 토글은 별도 공용 컴포넌트가 없고(네이티브 체크박스 사용), §4-3 hold는 '선택 패턴'·미사용 → '톤 적용' 범위 밖이라 신규 구현 안 함(스펜드 절제).
- 검증: `tsc`·`lint`·프로덕션 빌드 통과.

### B-6. 공유 표면 + reduced-motion 마감 (Part2 §5·§6)
파일: [`Reveal.tsx`](../src/components/Reveal.tsx)
- **이미 충족**: `/s/[id]` 토큰 패스+가격 deal-ink 800(P2-4), OG 동적 카드(P2-5), 핀 펄스·마퀴·stream·geo-dot·pin-bob/drop·`:active` 모두 reduced-motion 정지(P0~B-4).
- **보완(B-6, §6 '완전 마감')**: **`Reveal` reduced-motion 미준수 수정** — `prefers-reduced-motion: reduce`면 `matchMedia`로 감지해 **등장 모션(fade+up)·transition 제거하고 즉시 표시**. `/s/[id]`·`/about` 등 Reveal 쓰는 모든 공개 페이지에 일괄 적용(§5-1 'Reveal reduced-motion 마감' 미완 항목 종결).
- **변화 형태**: 접근성 모션 정책이 전 컴포넌트에 빠짐없이 적용 — reduced-motion 사용자에게 펄스·마퀴·스태거 등장이 전부 정지.
- 검증: `tsc`·`lint`·프로덕션 빌드 통과, Reveal 로직 검토(reduce 시 transition 클래스 미부여·show 즉시 true).

---

> **후보 B 리뉴얼 완료**: ①토큰(B-1) → ②메뉴 리스트(B-2) → ③대시보드(B-3) → ④지도 핀·마퀴(B-4) → ⑤공용(B-5) → ⑥공유+reduced-motion(B-6). 구조·IA·API·결제 흐름 불변, 시각·접근성만. Part1/Part2 핸드오프 6단계 전부 반영.

---

## C — 콜드스타트 지도 UX (테마지도 벤치마크, 기록=`THEME_MAP_BENCHMARK_PM_BRIEF.md` P0)  ✅

> 목적이 다름: P0~B가 '비주얼(비싸 보이게)'이었다면, C는 **밀도(콜드스타트) 엔진** — 거지맵·야장맵·러브버그맵이 검증한 소비자 바이럴 루프를 지도 구조에 이식. **전부 `/admin/launch` '이전 지도 UI 롤백'(flag_classic_map) 토글로 즉시 롤백 가능**(재배포 불필요).

### C-1. 히어로 '지금 세일중' 1토글 필터 (P0-4, 거지맵 패턴)
파일: [`FilterBar.tsx`](../src/components/FilterBar.tsx) (`hero` prop)
- **AS-IS**: 업종(전체/야채/정육/과일/…) + 세일중 + 마감임박 + 영업중 칩 **11개 병렬** — 주된 의도가 묻힘.
- **TO-BE**: **"🔥 지금 세일중" 큰 토글(48px, 켜면 deal-grad) 하나를 히어로로**, 마감임박은 보조 칩, 업종·영업중은 "필터 ▼"로 접음. '조건(지갑 사정)이 탐색의 출발점'(§4-E).
- **변화 형태**: 첫 화면 인지 부하 11칩 → 1토글+2칩. 어르신 단순화와 정합(§7-5).

### C-2. 라이브 카운터 헤드라인 (P0-3, 러브버그맵 패턴)
파일: [`LiveHeadline.tsx`](../src/components/LiveHeadline.tsx)(신규) · [`/api/feed`](../src/app/api/feed/route.ts) `counts`
- **AS-IS**: 지도에 생동감 신호 없음(마퀴는 개별 세일 나열).
- **TO-BE**: 필터 아래 다크 필 "📢 이문동 오늘 세일 제보 N건 · 세일중 M곳 · ⏰ 마감임박 K곳"(18초 폴링, bounds 기준). 0건이면 "첫 제보의 주인공이 돼보세요!" 초대 카피로 폴백 — 빈 화면 막다름 회피.
- **매출 레버**: FOMO·생동감 → 재방문·제보 전환(밀도 엔진).

### C-3. 동네별 세일 히트맵 클러스터 (P0-2, 러브버그맵 패턴)
파일: [`MapExplorer.tsx`](../src/components/MapExplorer.tsx) `buildClusterElement` · [`globals.css`](../src/app/globals.css) `.store-cluster--warm/--hot`
- **AS-IS**: 줌아웃 클러스터가 흰 원(개수+최저가) — 어디가 핫한지 색으로 안 보임.
- **TO-BE**: 활성 세일 1~2곳=`--deal-wash` warm, 3곳+=`--deal-grad` hot 버블. 줌아웃해도 "어디가 핫한 동네인지" 항상 보임 → 빈 지도 문제 구조적 회피.

### C-4. 원탭 세일 제보 FAB + 시트 (P0-1, 이 개편의 핵심)
파일: [`QuickSaleSheet.tsx`](../src/components/QuickSaleSheet.tsx)(신규) · [`MapExplorer.tsx`](../src/components/MapExplorer.tsx) FAB · [`/api/sales`](../src/app/api/sales/route.ts) · migration 44
- **AS-IS**: 세일 제보 = 핀 클릭 → 상세 시트 → 세일/행사 탭 → 제보 폼(**사진+제목+가격 필수**) — 최소 5스텝.
- **TO-BE**: 항상 떠 있는 **"🔥 여기 세일중" FAB(56px, deal-grad)** → 근처 인증 가게 리스트(거리순) 탭 → **"🔥 세일 제보 완료"**. 사진·가격·내용은 "✏️ 자세히 적기(선택)"로 확장, 만료는 가게 마감까지 자동. 가게 등록 FAB는 보조(작은 흰 필)로 강등.
- **변화 형태**: 제보 5스텝·필수 4종 → **2탭·필수 0종**. 비로그인은 제보 시점에만 "3초 로그인" 안내(무로그인 조회 유지).

### C-5. 정체성 카피 (P0-5 브랜드명 확정 전 카피)
파일: [`Header.tsx`](../src/components/Header.tsx)
- **TO-BE**: 헤더에 "우리 동네 오늘의 떨이·세일" 한 줄(sm+) — 0.5초에 뜻이 통하게. 브랜드명('장날'류) 확정은 비개발 P0-5로 별도.

> **롤백**: `/admin/launch` → "🗺️ 이전 지도 UI 롤백" 켜기 → C-1~C-4 즉시 이전 UI(칩 병렬 필터·가게 등록 FAB만)로 복귀. C-5(헤더 카피)와 서버 확장(counts·최소 제보 API·migration 44)은 공용/additive라 유지.
