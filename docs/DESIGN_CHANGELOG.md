# DESIGN_CHANGELOG — 비주얼 리뉴얼 시안 기록 (AS-IS → TO-BE)

> 디자이너 비주얼 브리프(`VISUAL_DESIGN_BRIEF.html`)에 따른 시각 리뉴얼의 **변화 기록**.
> 컴포넌트별로 **AS-IS(기존) → TO-BE(개선) → 변화 형태 → 매출 레버**를 남긴다.
> 원칙: 구조·IA·API·결제 흐름 불변, **시각만**. 토큰 단일 출처 = [`../src/app/globals.css`](../src/app/globals.css) `:root`.
> 시안은 **코드/마크업 AS-IS↔TO-BE 비교**로 남긴다(레포 내 영속 기록). 실제 렌더 확인은 dev 프리뷰.

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
