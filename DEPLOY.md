# 배포 가이드 — Vercel (무료, 스마트폰 테스트용)

이 앱은 Next.js라 **Vercel** 이 최적입니다(무료, 고정 `https://*.vercel.app` URL).
DB·이미지(Supabase)는 이미 원격이라 그대로 쓰면 됩니다. **로컬 마이그레이션 완료 상태**라 배포 시 DB 작업은 없습니다.

> 실제 배포에는 **본인 Vercel/GitHub 계정**과 **OAuth·카카오맵 콘솔에 배포 도메인 등록**이 필요합니다(아래 5번). 코드는 이미 배포 준비가 됐습니다(`npm run build` 통과).

---

## A. 코드 올리기 (둘 중 하나)

### A-1) GitHub → Vercel (권장, 자동 재배포)
```bash
# 이미 git init + 첫 커밋 되어 있음. GitHub 빈 레포 만들고:
git remote add origin https://github.com/<본인>/dongne-sale-map.git
git branch -M main
git push -u origin main
```
→ vercel.com → **Add New Project** → 그 레포 Import.

### A-2) Vercel CLI (레포 없이 바로)
```bash
npm i -g vercel
vercel login        # 브라우저 인증
vercel              # 프로젝트 생성 + 미리보기 배포
vercel --prod       # 운영 배포
```

---

## B. Vercel 환경변수 설정 (Project → Settings → Environment Variables)
`.env.local` 의 값을 그대로 넣습니다. **값은 여기 적지 않음 — `.env.local` 참고.**

| 변수 | 비고 |
|---|---|
| `DATABASE_URL` | Supabase pooler(6543) |
| `DIRECT_URL` | Supabase pooler(5432) |
| `AUTH_SECRET` | 기존 값 |
| `AUTH_TRUST_HOST` | **`true`** (Vercel 도메인 신뢰 — 신규 추가) |
| `AUTH_NAVER_ID` / `AUTH_NAVER_SECRET` | |
| `AUTH_KAKAO_ID` / `AUTH_KAKAO_SECRET` | 카카오 로그인(개발 앱) |
| `NEXT_PUBLIC_KAKAO_MAP_JS_KEY` | 지도 JS키(운영 앱) — 빌드 시 주입되므로 **배포 전 설정** |
| `KAKAO_REST_API_KEY` | 지오코딩(서버) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 사진 업로드(서버 전용) |

> `SMS_PROVIDER` 는 비워두면 개발모드(목업)로 동작 — 인증번호가 화면에 표시됩니다.

배포 완료 후 URL 예: `https://dongne-sale-map.vercel.app`

---

## C. 콘솔에 배포 도메인 등록 (이거 안 하면 로그인·지도 실패)
배포 도메인을 `https://<프로젝트>.vercel.app` 라고 할 때:

1. **네이버 로그인** (developers.naver.com → 내 애플리케이션 → API 설정)
   - Callback URL 추가: `https://<도메인>/api/auth/callback/naver`
   - 서비스 URL: `https://<도메인>`
2. **카카오 로그인** (개발 앱 → 카카오 로그인)
   - Redirect URI 추가: `https://<도메인>/api/auth/callback/kakao`
   - Web 플랫폼 사이트 도메인 추가: `https://<도메인>`
3. **카카오 지도** (운영 앱 → 앱 설정 → 플랫폼 → Web)
   - 사이트 도메인 추가: `https://<도메인>`  ← **지도 렌더링 도메인 검증 때문에 필수**

콘솔 변경 후 Vercel에서 한 번 **Redeploy** 하면 깔끔합니다.

---

## D. 스마트폰 테스트 체크
- 지도가 뜨는가 (카카오 JS 도메인 등록 됐으면 OK)
- **전화번호 로그인**(개발모드 인증번호 화면 표시) → 제보/등록/리뷰 — *OAuth 콘솔 설정 없이도 됨*
- 네이버/카카오 로그인 (콘솔 Callback 등록 후)
- 가게 등록 → 미인증 회색 핀 → `/admin/stores` 승인

---

## E. 더 빠른 임시 테스트 (선택) — 터널
배포 없이 지금 로컬을 폰으로 보고 싶다면:
```bash
npm run dev                      # 터미널 1 (localhost:3000)
npx cloudflared tunnel --url http://localhost:3000   # 터미널 2 → 임시 https URL
```
- **전화번호 로그인 + 대부분 기능은 바로 테스트 가능**(터널 URL이 바뀌어도 OK).
- 단, **카카오 지도/소셜 로그인은 그 터널 도메인을 콘솔에 등록**해야 작동(터널 URL은 매번 바뀌어 번거로움). → 반복 테스트는 Vercel 권장.
