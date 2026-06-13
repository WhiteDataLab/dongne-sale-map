# HANDOFF — 동네 세일 지도 (진행 상황 인수인계)

> 새 세션/작업자가 빠르게 이어받기 위한 요약. 제품 스펙은 [`PROJECT_SPEC.md`](PROJECT_SPEC.md), 코드 규칙은 [`../CLAUDE.md`](../CLAUDE.md), 배포는 [`../DEPLOY.md`](../DEPLOY.md).

## 1. 한 줄 정의 & 현황
동네 식료품 소상공인(야채/정육/과일 + 세탁/반찬/미용실/기타)의 **실시간 세일을 지도에서 보고 제보**하는 하이퍼로컬 웹.
- **배포 중**: https://dongne-sale-map.vercel.app (GitHub `WhiteDataLab/dongne-sale-map`, main 푸시 시 자동 재배포)
- 로컬: `C:\Market`, `npm run dev`(3000) / `npm run build`

## 2. 기술 스택
Next.js 15(App Router)·React 19·TS strict · Tailwind v4 · NextAuth v5(JWT) · Prisma 6 · Supabase(PostgreSQL + Storage) · Kakao Maps JS SDK + Local REST · Vercel.

## 3. 구현 완료 (Phase 0~7 + 추가)
- **지도 가격 핀 + 마감임박 + 필터 확장(레퍼런스: 호갱노노/오피넷/라스트오더/캐치테이블)**: 지도 핀에 **진행중 세일 최저가를 숫자로 노출**(`🔥 2,900원~`), 1시간 내 마감은 **주황 펄스 + `⏰`** 로 긴급 강조. `StoreDTO`에 `saleMinPrice`/`saleSoonExpiring` 추가(`/api/stores`·`/api/stores/[id]`에서 활성 세일 집계). 필터바에 **⏰ 마감임박 / 🟢 영업중** 추가(영업중·마감임박은 DTO 기준 클라 필터, 세일중은 서버). 핀 CSS `store-pin__sale--soon`/`store-pin--soon` 펄스(`prefers-reduced-motion` 정지).
- **마이페이지 본인 날짜=정확 날짜 + 펼치기/페이지네이션**: 남에게 보이는 화면(가게 상세 리뷰 등)은 상대표기(`reviewDateLabel`: 오늘/어제/이번주…) 유지, **마이페이지 본인 정보**(내 활동·내 리뷰)는 정확한 **년월일**(`ymd`: KST `2026.6.7`)로 표시. **내 활동**(`ActivityTimeline`)·**내 리뷰**(`MyReviewList`)는 포인트 내역(`PointHistory`)과 동일하게 **처음 N건(활동 5/리뷰 3) → ‘펼쳐서 보기’ → 10건/페이지 이전·다음** 패턴.
- **가격 변동 그래프(레퍼런스: 크림)**: 가게 상세 세일 탭 상단 **📈 가격 추이**(최근 90일). **별도 이력 테이블 없이** 과거 `Sale`(만료 포함)을 품목별(상품 productId 우선, 없으면 제목)로 묶어 시점별 가격 포인트로 사용. `StoreDetailDTO.priceTrends`(`/api/stores/[id]`에서 2개 이상 포인트인 품목만, 최대 8개·각 24포인트). **의존성 없는 SVG 스파크라인** `PriceChart`(상승=빨강/하락=파랑, 최근가·변동률·최저~최고가).
- **줌아웃 가격 클러스터링(레퍼런스: 호갱노노)**: 지도 레벨 6+(줌아웃)에서 화면을 7×7 격자로 나눠 같은 칸 가게를 **클러스터 버블(개수+최저 세일가)** 로 묶음. 클릭 시 줌인→idle 재조회로 자동 디클러스터. `MapExplorer` `groupByGrid`/`buildClusterElement`, CSS `.store-cluster`.
- **영수증 인증 리뷰(migration 26, 레퍼런스: 네이버 MY플레이스)**: 리뷰에 **영수증 업로드(선택)** → `🧾 영수증 인증` 배지(사진 인증보다 강한 신뢰). 영수증은 **비공개 버킷(merchant-docs/receipts)** 에 저장하고 **경로만**(`Review.receiptUrl`) 보관, 이미지는 공개 노출 X(배지만). 업로드=`POST /api/upload/receipt`(비공개), `uploadReceiptImage`/`isReceiptPath`. 포인트 게이트: 사진 **또는 영수증**이 있으면 2번째+ 리뷰도 적립(`hasProof`). DTO=`receiptVerified`(불리언만), `ReviewForm` 영수증 업로드 UI(편집 시 기존 인증 유지/교체), `ReviewContent` 영수증 배지.
- **지도↔세일 목록 + 카운트다운 + 정렬(레퍼런스: 에어비앤비/배민포장/쿠팡)**: 지도 하단 **📋 세일 목록 N** 토글 → `SaleListPanel`(모바일=하단시트, 데스크톱=우측 패널). 항목=가게/주소/최저가/실시간 카운트다운, 클릭 시 상세 열림. **정렬 마감임박순/최저가순/최신순**. `StoreDTO`에 `saleSoonestExpiry`/`saleLatestCreated`(ISO) 추가. **`Countdown` 컴포넌트**: 1시간 이상=‘N시간 M분 남음’, 미만=‘MM:SS 남음’(초갱신·주황), 만료=‘마감’.
- **메뉴/IA 개편(migration 25, 분석=`docs/MENU_IA.md`)**: 사이드 메뉴를 **6그룹(탐색/기여/혜택/내정보/고객지원/관리)** 으로 재구성 + 하단 **약관·정책 묶음**(서비스소개·이용약관·개인정보·위치기반약관·운영정책·교환환불·운영정보·사이트맵). 신설 페이지: **위치기반서비스 이용약관**(`/location-terms`, P0), **운영정책·커뮤니티 가이드**(`/policy`), **포인트·기프티콘 교환/환불 정책**(`/refund`), **서비스 운영 정보**(`/company`, 사업자 정보 TODO), **FAQ**(`/faq`), **사이트맵**(`/sitemap`), **설정 허브**(`/settings`), **동네 소식**(`/news`, 최근 세일/휴업·폐업/신규가게 집계, 모델 없음).
  - **공지·이벤트(Notice 모델)**: 관리자 `/admin/notices`(`NoticeAdmin` + `POST/PATCH/DELETE /api/admin/notices[/id]`, 종류 notice|event·상단고정·노출토글) → 공개 `/notices`.
  - **인앱 알림함(`/notifications`)**: 별도 테이블 없이 **Notice + 내 문의 답변(Inquiry.answered) + 내 기프티콘 교환 상태(sent/canceled)** 를 파생 집계. 읽음 상태는 클라(`NotificationList`, localStorage `notif_seen_at`)에서 새 항목 강조. 푸시는 Out-of-scope.
  - **길찾기**: 가게 상세 헤더에 카카오맵 길찾기 딥링크(`map.kakao.com/link/to/...`).
  - **사진 인증 배지**: 사진 있는 리뷰에 “📷 사진 인증” 칩(`ReviewContent` verified).
  - **마이페이지 보강**: 활동 배지(활동점수=가게×4+세일×2+리뷰×2+즐겨찾기×1 → 새내기~동네스타)+**내 활동 타임라인**(가게/세일/리뷰)+알림/설정 바로가기. **관리 콘솔** 네비 5그룹(현황/심사큐/회원/포인트샵/지원·콘텐츠)으로 그룹핑.
  - ⏳ 미구현(후속): 즐겨찾기 폴더, 사장님 쿠폰(현재는 세일/행사로 갈음).
- **0** 스캐폴딩/스키마/레이아웃, **1** 지도+검색+핀(이문동 기본), **2** 가게 상세 바텀시트(상품/세일/공지/리뷰 탭, 영업중 자동판정, 즐겨찾기), **3** 세일 제보(사진·만료·PointLog pending)+리뷰+**Naver 로그인**, **4** 신고/자동숨김(3건)+관리자 화면+회원탈퇴+약관/개인정보.
- **5** 인증확장: 전화번호 로그인+SMS 본인확인(**개발모드 목업**)+Kakao 로그인(개발앱 키)+`Identity` 기반 **계정 병합**(포인트 합산·즐겨찾기 통합, 닉네임/프사는 **먼저 가입 계정** 기준)+포인트 내역(2년 조회/5년 소멸).
- **6** 소비자 가게 등록 + 카테고리 확장 + 출처(소비자/사장님) 구분.
- **7** 사장님(merchant): **7a** 사업자등록증 업로드(비공개 버킷)→관리자 서명URL 심사·승인→merchant 권한+소유권, **7b** 메뉴(상품) CRUD 권한(소유자/관리자 vs 소유자없으면 누구나, 사진필수·등록자표시·신고자동숨김)+**7b-2 계정 정지(ban)**, **7c** 가게 배너(소유자/관리자만, 없으면 소비자에겐 기본배너), **7d** 즐겨찾기 별도 메뉴(`/favorites`, 세일여부+딥링크).
- **추가**: 전역 버튼 micro-interaction, 이미지 hover 확대(`.zoomable`), Apple풍 소개페이지 `/about`(긴 스크롤+등장 애니메이션), **사진 편집기**(PhotoEditor v3: 펜/지우개/모자이크/줌·박스 자르기/되돌리기), **GPS 현재위치**(파란 점, 좌표 미저장), **장소검색**(카카오 POI→기존가게 열기/빠른등록), **가게 등록을 메인 지도에서 직접 좌표 찍어 인라인 등록**, **소개페이지 업로드 영상**(관리자, `SiteConfig.intro_video_url`).
- ❌ 제거됨: 외부(YouTube) 영상 링크 — 영상은 소개페이지 업로드만.
- **프로필 사진 업로드(원형 크롭)**: 마이페이지(`/account`) 프로필 아바타 클릭→파일 선택→`CircleCropper`(드래그 이동·슬라이더 확대, 원형 마스크, 512² 정사각 출력)→`/api/upload`→`updateProfileImage` 서버액션(`User.profileImgUrl`+`unstable_update`)→즉시 반영. auth jwt/session이 `token.picture=profileImgUrl`로 헤더 아바타도 갱신. SideNav 드로어 프로필=`/account` 링크.
- **가게별 공유 URL(`/s/[id]`)**: 지도 없이 가게 세일 정보 바로 노출하는 공개 랜딩(서버 렌더). `generateMetadata`로 OG/트위터 카드(제목·세일·대표사진) → 카톡 등 링크 미리보기. "지도에서 자세히 보기"=딥링크(`/?store=&lat=&lng=`). `ShareButton`(Web Share API→클립보드 폴백)을 공유 페이지·가게 상세 헤더에 배치.
- **실시간 피드 오버레이(`/api/feed`)**: 현 지도 bounds의 최신 세일을 **상단 가로 광고판(마퀴 `SaleMarquee`)**, 최신 리뷰를 **좌측 유튜브 채팅식 상승+페이드 스트림(`ReviewStream`)**으로 표시. 줌아웃→bounds 확대→더 많은 데이터. idle + 18초 폴링 갱신. CSS `marquee-x`/`stream-up`+mask, `prefers-reduced-motion` 정지.
- **추천인 이벤트(`/invite`, migration 18)**: `User.referralCode`(unique, 지연 생성 `ensureReferralCode`)·`referredById`(self FK). 친구가 **초대 링크 `/i/CODE`**(ref_code 쿠키 7일)로 **카카오·네이버·전화 가입 시** auth 콜백이 쿠키 읽어 `applyReferral`→**추천인·친구 각 +50P**(PointLog refType=referral). 링크 없이 가입한 회원은 `/invite`에서 **코드 직접 입력**(`POST /api/referral`, 가입 7일내+미등록+본인아님 가드). 1인 1회. 사이드 메뉴 '🎉 친구 초대'.
  - **악용 방어(migration 19/23, `User.referralRewarded`+`ReferralClaim`+`contactVerified`)**: 보상은 **SMS 인증된 연락처** 등록 시점에만 지급(`grantReferralIfEligible`, 가입 시엔 관계만=pending). 연락처는 `ContactVerifyForm`(phone/send+verify→`saveVerifiedContact`)로만 등록 가능(인증 필수). **연락처(전화) 해시를 영구 원장**에 기록 → **탈퇴 후 재가입 + 같은 연락처면 미지급**(원장은 User 삭제와 무관히 잔존). 이미 사용된 연락처면 `referralRewarded=true`로 **소진 처리**(다른 연락처로 우회 차단). 연락처 미등록이면 양쪽 미지급. ⚠️ 남은 한계: 매번 **새 가짜 전화번호**로는 우회 가능(연락처 미인증) — 단, 그 번호로 기프티콘 발송돼 운영자가 인지 가능. 소셜 다계정도 완전차단 불가.
- **고객센터 1:1 문의(`/support`, migration 22 `Inquiry`)**: 로그인 사용자가 닉네임·이메일·제목·내용·첨부이미지로 문의(`POST /api/inquiries`, 레이트리밋, 이미지=storage URL). 내 문의 목록을 `<details>`로 펼쳐 답변 확인(상태 문의중/답변완료). 관리자 `/admin/inquiries`에서 확인+답변(`answerInquiry`→status=answered). 사이드 메뉴 '🎧 고객센터', 관리 네비/홈(미답변 N).
- **기프티콘 상품 관리(`/admin/gifts`, migration 21 `GiftItem`)**: 카탈로그를 코드 하드코딩→**DB(GiftItem)** 로 이관(기본 6종 시드). 관리자 **추가/수정/삭제/이미지 업로드/노출토글/정렬**(`GiftAdmin` + `POST/PATCH/DELETE /api/admin/gifts[/id]`, 이미지=storage URL 검증). 포인트샵·교환 API는 `getActiveGifts`/`getGiftItem`(DB)로 조회(비활성·삭제 상품 교환 차단). 과거 교환은 itemName/points 스냅샷 보존.
- **포인트샵/기프티콘 교환(`/shop`, migration 17)**: 카탈로그=DB(GiftItem, 위 항목), 포인트=원. `POST /api/redemptions`: 연락처(`User.contactPhone`) 필수→없으면 409 needContact, 트랜잭션 내 잔액 재확인, **음수 PointLog(refType=redemption)로 차감** + `Redemption(requested)` 주문. 발송은 **관리자 수동**(`/admin/redemptions`: 발송완료/취소-환원, 취소 시 음수로그 삭제로 환원). 마이페이지=연락처 등록(`updateContact`)+교환 내역. ⚠️ 포인트가 이제 **소비(음수)**도 되므로 잔액=PointLog 합계에 음수 포함. 실제 기프티콘 구매·발송은 외부 전문샵 수동 운영(API 연동 미구현).
- **출석체크(`/checkin`, migration 16)**: 하루 1회 출석(`User.lastCheckInDate`/`checkInStreak`, KST 자정 기준 streak). 매일 +10P, 연속 7일마다 +20P, 30일마다 +50P(PointLog pending, refType=checkin). `POST /api/checkin`(오늘 중복 409). 사이드 메뉴 '✅ 출석체크', 주간 7칸·월간 30 진행 UI.
- **탭 라벨/업종별 수량**: 가게 상세 탭 `상품→메뉴`, `세일→세일/행사`. **식품 업종(`FOOD_CATEGORIES`=야채/정육/과일/반찬)만 수량·단위 입력**, 세탁/미용/기타는 `categoryHasQuantity()`로 수량 필드 숨김(폼/표시 모두). 서버(`/api/products`,`/api/sales`)도 qty/qtyUnit 필수 해제(빈값 허용).
- **리뷰 규칙 개편(migration 24)**: ⚠️ **좋아요/싫어요 기능 제거** — `ReviewReaction` 테이블/`ReactionKind` enum DROP, `/api/reviews/[id]/react`·`ReviewReactions` 컴포넌트 삭제, ReviewDTO에서 like/dislike/myReaction 제거. **핵심 규칙**:
  - **모든 리뷰는 구매 메뉴(상품) 1개 이상 연결 필수**(`Review.productIds String[]`, 다중 선택). 서버가 해당 가게 상품인지 검증. 리뷰 표시에 "🛒 구매 메뉴: …" 노출(현존 상품만 이름 해석).
  - **태그/본문 분리 저장**: `Review.tags String[]`(빠른 선택 프리셋) + `Review.content`(‘기타’ 자유 입력). 표시는 **태그=원형 테두리 칩**, content=일반 텍스트 조합(`ReviewContent` 컴포넌트). 피드(`/api/feed`)는 tags+content 합쳐 한 줄로.
  - **당일 재작성 제한(파밍 방지)**: `Review.scored Boolean`. 같은 날(KST) 같은 가게에 이미 `scored=true` 리뷰가 있으면 새 리뷰는 `scored=false` → **포인트·별점 미반영**(가게 avgRating은 scored 리뷰만 집계). 그 리뷰를 **삭제하면 다시 반영 가능**(당일 scored 0건이 되므로). 최초 리뷰는 글만 써도 +10P/별점 반영, 2번째부터는 사진 필요(기존 정책 유지하되 scored 게이트 추가).
- **내 리뷰 관리**: 마이페이지(`/account`)에 **내가 쓴 리뷰 목록**+**삭제**(`DELETE /api/reviews/[id]`, 작성자/관리자, 포인트 회수)+**수정**(아래).
- **리뷰 수정/삭제 + 작성일 라벨**: 가게 상세·마이페이지 모두 **내 리뷰에 수정/삭제 버튼**. 수정=`PATCH /api/reviews/[id]`(작성자/관리자, 별점·태그·구매메뉴·내용·사진 갱신, `scored`는 작성시점 기준이라 미변동, 교체/삭제된 이전 사진 스토리지 정리). `ReviewForm`은 `review` prop으로 **작성/수정 공용**(구매메뉴·태그·기타·사진 프리필, 기존 사진 유지/삭제+새 사진 추가). 마이페이지는 `MyReviewItem`(클라)이 `ReviewForm`을 인라인으로 열고 구매메뉴 후보로 **연결된 메뉴**를 넘김. 작성일은 정확한 시각 대신 **KST 달력일 기준 한글 구간**(`reviewDateLabel`/`kstDaysAgo`): 오늘/어제/그제(0·1·2일)·3~6 이번주·7~13 저번주·14~27 이번달·28~59 저번달·60~364 `N개월 전`(2~11)·365+ `N년 전`.
- **리뷰→상품 등록 퍼널**: 리뷰 작성 시 "어떤 걸 구매하셨나요?"로 메뉴 선택 유도. '메뉴에 없어요' 선택 시 "상품부터 등록(+5P)" 안내→`onGoRegisterProduct`로 상품 탭+추가폼 자동 오픈(`ProductsTab requestAdd`). **메뉴 등록 시 +5P 적립**(`/api/products`, pending, refType=product, 숨김 시 회수). 등록 후 리뷰 다시 쓰면 리뷰 포인트(첫/사진 정책).
- **리뷰 사진+포인트(migration 15, `Review.photoUrls`)**: 리뷰에 사진 최대 5장(업로드+PhotoEditor). 포인트(pending +10): **첫 리뷰는 글만 써도 지급, 2번째부터는 사진 있어야 지급**(`/api/reviews`에서 `review.count`로 판정). 리뷰 숨김(신고 자동/관리자) 시 `refType="review"` PointLog **회수**. 리뷰 목록에 사진 썸네일(zoomable).
- **리뷰 태깅**: `ReviewForm`이 프리셋 버튼(재료 신선/양 많음/가성비/메뉴 알참/고기 질/가치있음/인테리어, 다중선택)+별점, **‘기타’ 토글 시 직접 입력**. ⚠️ migration 24부터 태그(`tags[]`)와 자유 텍스트(`content`)를 **분리 저장**(표시는 원형 칩+텍스트, 위 ‘리뷰 규칙 개편’ 참고).
- **휴업/폐업 커뮤니티 제보(`ClosureReport`, migration 14)**: 소비자가 '오늘 갑자기 휴업'/'폐업'을 **현장 사진+메모**로 제보(`POST /api/closures`, 로그인·24h내 동종 1회 가드). **지도 핀 시각효과**: 폐업제보=검정 "폐업?"+취소선·흐림, 오늘휴업제보=주황 "오늘 휴업?"+강조테두리, 영업시간상 영업종료=회색 "영업종료"+흐림(우선순위 폐업>휴업>영업종료>세일). 목록 API가 isOpenNow·오늘휴업수·폐업수(최근14일) 계산해 StoreDTO로 전달. 가게 상세 상단에 **경고 배너(사진·제보수)+제보 버튼**(`ClosureBanner`/`ClosureReportForm`). 푸시는 Out of Scope라 '알림'=지도/상세 시각 노출.
- **반응형 패널**: 가게 등록 폼·가게 상세시트가 모바일=하단 바텀시트(드래그/탭 높이조절), 태블릿·PC(≥768px)=왼쪽 전체높이 사이드 패널. 등록 시트는 그립 탭으로 필터바 직전까지 최대화 토글. 지도 핀 찍기 전 커서 따라다니는 미리보기 핀(ghost)+드롭 애니메이션.
- **가게 공지사항(notice)**: 공지 탭에서 사장님/관리자(`canManageStore`)만 추가·수정·삭제, 소비자는 조회만(`Store.notice`, PATCH `/api/stores/[id]`). 같은 탭의 **가게 소개·기본정보(주소/전화)·영업시간(요일별)도 동일 권한으로 인라인 편집**(PATCH 부분수정).
- **신고 버튼**: 텍스트 → 깃발 아이콘(`ReportButton`).
- **회원 활동 분석(`/admin/activity`)**: 콘텐츠 기여(가게/세일/리뷰/즐겨찾기) groupBy로 **활발한 회원(가중 활동점수=가게×4+세일×2+리뷰×2+즐겨찾기×1)+마지막 활동일**, 가게등록/리뷰/세일 **랭킹**. ⚠️ 순수 페이지뷰 트래픽은 **미수집** → 활동점수로 추정(화면에 명시). 실트래픽은 방문 이벤트 로깅/GA4 연동 필요(미구현).
- **회원 정보 관리(`/admin/members`)**: 가입일·**연결된 로그인수단 전체(Identity 기준, 예 "네이버 · 카카오")**·**ID값(accountId)**·닉네임·**적립포인트(PointLog 5년 합계 groupBy)** 목록 + **계정 잠금/해제(`lockUser`/`unlockUser`)**·**강제 탈퇴(`forceDeleteUser` — 콘텐츠 익명화+탈퇴로그+User 삭제)**. 관리자 계정은 보호. 파괴적 액션은 `ConfirmSubmit`로 확인.
- **계정 식별자 accountId(ID값, migration 13)**: 소셜=이메일(소문자, OAuth `user.email`), 이메일 없으면 `영문4+YYYYMMDDHHmmss(KST)`, 전화=전화번호(`makeAccountId`). 닉네임 중복과 무관한 안정 식별자(신원 매칭은 여전히 Identity). 로그인 시 비어있으면 backfill(`resolveSocialUser`/`resolvePhoneUser`). 기존 계정은 **다음 로그인 때** 채워짐.
- **관리자 대시보드(`/admin/dashboard`)**: 회원가입·가게등록·세일제보·리뷰·신고·**회원탈퇴**의 **오늘/어제/최근7일/누적** 집계(각 모델 `createdAt` count). 일자 경계는 **KST 자정**(`kstDayStart` 헬퍼). **가입 경로별(카카오/네이버/전화) 현재 회원 수**(User.provider groupBy, sentinel 제외). 회원수 집계는 고스트 sentinel(`providerId="deleted-user"`) 제외. 관리 네비/홈에 진입 카드 추가.
- **탈퇴 로그(`WithdrawalLog`, migration 12)**: User는 탈퇴 시 hard delete라 추이를 못 남김 → 탈퇴 시 PII 없이 `provider+createdAt`만 로그(`account/actions.ts deleteAccount`). 대시보드 '회원 탈퇴' 행 출처. **로그 도입 이후부터** 집계.
- **서비스 소개(/about) 관리자 편집(CMS-lite)**: 콘텐츠를 `SiteConfig(about_content)` JSON으로 저장(`src/lib/about.ts` 모델+기본값, 없으면 폴백). `/about`에서 관리자에게만 '✏️ 소개 편집' 버튼(`AboutEditor`) → 히어로 글·콘텐츠 섹션(추가/삭제/순서/이미지 업로드/이모지·다크)·영상·마무리 편집. 저장 `POST /api/admin/about`(admin), 이미지=`/api/upload`(sale-photos), 영상=`/api/admin/intro-video`. '믿을 수 있게' 가치 카드 3개는 고정.
- 프로필 사진(메뉴) 열면 지도에 열린 등록/상세 패널 자동 닫힘(`window` `app:overlay-close` 이벤트).

## 4. 데이터 모델 (Prisma, migrations 0~26 적용 완료)
User(provider?/providerId? nullable, name?, nickname, phone? unique, phoneVerified, role `user|admin|merchant`, status `active|banned`, points) · **Identity**(provider/providerId→user, 계정연결 단일출처) · Store(category `vegetable|meat|fruit|laundry|sidedish|salon|etc`, lat/lng, verified, **source `user|merchant`**, **ownerId?**, bannerUrl?, **notice?**(공지사항, 소유자/관리자만 편집), hoursJson?, status) · Product(photoUrl?, hidden, updatedAt) · Sale(photoUrls[], status, expiresAt) · Review(rating, content, **tags[]**, **productIds[]**, photoUrls[], **scored**, hidden) · Favorite · Report(targetType `store|sale|review|product`, 누적 3건 자동숨김) · PointLog(status pending|granted, refType/refId) · MerchantVerification(docPath) · PhoneVerification(codeHash) · **SiteConfig**(key/value) · **Notice**(kind notice|event, title/body, pinned, active — 공지/이벤트).
- 포인트 잔액 출처 = PointLog 합계(<5년). 세일 삭제/숨김/제재 시 해당 PointLog **회수**.
- **세일 포인트는 즉시 적립**(status=granted). UI에서 '적립예정' 라벨 제거. **하루 1회 제한**: 같은 사용자가 오늘(KST) 같은 가게·같은 항목(productId 또는 title)으로 이미 올렸으면 등록 차단(만료 행도 카운트 → 1시간 만료 반복 파밍 방지).
- ⚠️ **정합 규칙**: "사장님 가게" 판정·표시는 **`ownerId`(hasOwner) 기준**(인증 소유자 유무). `source`는 등록 출처 메타일 뿐. `approveMerchant`는 `ownerId+source=merchant+verified`를 **함께** 세팅하므로 둘이 항상 일치해야 함. (과거 시드가 `source=merchant`만 주고 ownerId 누락 → 상세는 "사장님 가게", 상품탭은 "사장님 미등록" 모순. 시드/라이브 데이터 모두 소유자 지정으로 복구함.)

## 4-1. 보안/어뷰징 방어 (점검 완료)
- **권한**: 모든 변경 API는 `getCurrentUser`(정지=차단, role=DB 최신) 또는 `getAdminSession`(이제 **DB role/status 재확인** → 강등/정지 관리자 즉시 차단). 세일/리뷰/제보 삭제는 작성자·관리자만.
- **포인트 파밍 차단**: 리뷰=**가게당 1회 + 60s 레이트리밋(3)**, 메뉴=**5분 레이트리밋(8)**, 세일=기존 60s(3)+중복가드. 콘텐츠 숨김/삭제 시 PointLog 회수(sale/review/product).
- **가짜 사진으로 포인트 우회 차단**: 세일·리뷰·메뉴·휴업제보·프로필·배너 사진 URL은 **우리 공개 스토리지 URL(`isPublicStorageUrl`)만 인정**(외부/위조 URL 거부).
- **신고 악용 차단**: 같은 사용자가 같은 대상 **중복 신고 불가** → 자동숨김 임계치(3)는 '서로 다른 신고자 수' 기준.
- **업로드**: 서버 경유(service_role 키 비노출), 이미지 화이트리스트(png/jpg/webp/gif, **SVG 불가**)+5MB. 민감문서(사업자등록증)=비공개 버킷+단기 서명URL.
- **이미지 용량 정리**: 배너/프로필 사진 교체·삭제, 메뉴/리뷰/세일 삭제, 기프티콘 상품 이미지 교체·삭제 시 **이전/해당 스토리지 이미지 삭제**(`deletePublicImage`/`deletePublicImages`, best-effort). 공개 URL→`{bucket}/{path}` 파싱 후 service_role로 DELETE.
- **전역 보안 헤더(next.config `headers()`)**: `X-Frame-Options: DENY`+`CSP frame-ancestors 'none'`(클릭재킹), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`(camera/mic/payment 차단·geolocation self), `HSTS`(1년). ⚠️ 전체 CSP(script/connect-src)는 미도입(카카오맵/Supabase 외부자원 많아 점진 도입 TODO).
- **비용·트래픽 남용 레이트리밋(`lib/rateLimit.ts`, 인메모리 고정윈도)**: 비인증 카카오 REST 프록시 `/api/geocode`·`/api/places`=IP 분당 30회(쿼터 고갈·과금 방어), `/api/upload`·`/api/upload/receipt`=사용자당 분당 20장(스토리지 비용·고아 이미지), `/api/phone/send`=IP 분당 5회(번호 로테이션 SMS 폭탄). ⚠️ **서버리스 인스턴스별 메모리**라 전역 카운트 아님 → 정밀 분산 제한 필요 시 Upstash Redis 등으로 교체.
- 잔여 위험(낮음): 토큰 maxAge 동안 닉네임/이미지 지연, 업로드 magic-byte 미검증(MIME만 검사), `/api/feed`·`/api/stores` 공개(단 `take` 상한으로 쿼리비용 제한), 계정연결 `link_uid`는 httpOnly+인증세션 기반(XSS 없으면 안전), `hashCode`/`hashContact`의 `AUTH_SECRET ?? "salt"` 폴백(운영선 AUTH_SECRET 항상 설정 전제).

## 5. 인프라/시크릿
- DB: Supabase 풀러 `aws-1-ap-northeast-2.pooler.supabase.com`(user `postgres.<ref>`), 6543(앱)/5432(마이그레이션). **직접호스트 db.<ref>.supabase.co 는 IPv6-only라 사용 불가.**
- Storage 버킷: `sale-photos`(public·이미지), `merchant-docs`(private·서명URL), `intro`(public·영상 50MB).
- 시크릿은 `.env.local`(gitignore). 키: DATABASE_URL/DIRECT_URL, AUTH_SECRET, AUTH_NAVER_ID/SECRET, AUTH_KAKAO_ID/SECRET(**개발앱 키**), NEXT_PUBLIC_KAKAO_MAP_JS_KEY, KAKAO_REST_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. (`.env.example`은 placeholder)
- Auth: 세션=JWT. 신원 해석/병합 = `src/lib/userIdentity.ts`. 정지(ban)·role 확인 = `src/lib/session.ts`(DB status 체크).

## 6. ⚠️ 작업 시 함정 (Windows 환경)
1. **빌드 EPERM**(`query_engine.dll` rename 실패): dev 서버가 DLL 점유. → PowerShell로 node 종료 + `.prisma/client/*.tmp` 삭제 후 빌드. **dev 켠 채 build 금지.**
2. **`pkill -f "next dev"`(git-bash)로 안 죽음** → PowerShell `Stop-Process`. 안 죽이면 EADDRINUSE로 **낡은 코드가 서빙됨**(디버깅 헛수고 원인).
3. **Prisma CLI는 `.env` 만 읽음(`.env.local` X)** → migrate/seed/studio 시 `DATABASE_URL`/`DIRECT_URL` inline export.
4. 새 마이그레이션: 파일 작성 → `prisma db execute --file ...` → `prisma migrate resolve --applied <name>`.
5. **curl `-d`로 한글 보내면 깨짐**(테스트) → URL은 percent-encoding, 본문은 ASCII/파일. node의 `/tmp`는 `C:\tmp`로 깨짐 → 프로젝트 폴더 사용.
6. ESLint: **`@typescript-eslint/no-explicit-any` 룰 미로딩** → 그 disable 주석 쓰면 빌드 실패. `any`는 주석 없이 사용.
7. `position:fixed` 전체화면 모달은 **transform 조상(바텀시트)에 갇힘** → `createPortal(document.body)`. 모바일 높이는 `visualViewport`.

## 7. 검증 방식
빌드 통과 + dev(3137)에서 headless API 테스트. 인증 필요한 경로는 **세션 토큰 발급**해 쿠키로 호출: `encode`(`next-auth/jwt`, secret=AUTH_SECRET, salt `"authjs.session-token"`)로 `{userId,role,...}` 토큰 생성 → `Cookie: authjs.session-token=...`.

## 8. 사용자가 직접 할 일(운영/테스트)
- **Kakao 개발앱**: 카카오 로그인 Redirect URI `https://dongne-sale-map.vercel.app/api/auth/callback/kakao`(+localhost) 등록, 동의항목(닉네임/프로필). **지도(운영앱) JS키**의 Web 플랫폼에 배포 도메인 등록.
- **Naver**: Callback `https://<도메인>/api/auth/callback/naver`.
- **관리자 권한**: Supabase SQL `UPDATE "User" SET role='admin' WHERE nickname='4Leaf';` 후 재로그인. (관리 화면 `/admin`)
- 소개페이지 영상: `/admin`에서 업로드.

## 9. 남은 후보(미구현/선택)
실제 **SMS 발송사** 연동(현재 목업) · 앱 전체 Apple풍 톤 정비 · 5년 경과 포인트 **물리 삭제 스케줄**(현재 지연계산) · PWA(설치/매니페스트/오프라인) · 푸시(스펙상 Out of Scope) · 전화번호를 소셜 계정에 추가연결(현재 소셜→현재계정 병합만).

## 10. 최근 커밋
반응형 패널(좌측 사이드/바텀시트) · 가게 공지사항 CRUD(migration 11) · 신고 아이콘화 · 프로필 열 때 오버레이 닫힘까지 반영됨. 이후 작업은 여기서 이어가면 됨.
- ⚠️ **배포 파이프라인은 마이그레이션 자동적용 안 함**(build=`prisma generate && next build`). 새 컬럼 추가 시 `.env.local`의 DIRECT_URL 인라인 export 후 `npx prisma migrate deploy`로 Supabase에 **먼저 적용**한 뒤 코드 push.
