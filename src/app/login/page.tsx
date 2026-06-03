import { LoginOptions } from "@/components/LoginOptions";

export const metadata = { title: "로그인 — 동네 세일 지도" };

export default function LoginPage() {
  const naverEnabled = Boolean(
    process.env.AUTH_NAVER_ID && process.env.AUTH_NAVER_SECRET,
  );
  const kakaoEnabled = Boolean(
    process.env.AUTH_KAKAO_ID && process.env.AUTH_KAKAO_SECRET,
  );

  return (
    <div className="h-full overflow-y-auto">
      <LoginOptions naverEnabled={naverEnabled} kakaoEnabled={kakaoEnabled} />
    </div>
  );
}
