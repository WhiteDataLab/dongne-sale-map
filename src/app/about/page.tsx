import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { parseAbout, type AboutBlock } from "@/lib/about";
import { AboutEditor } from "@/components/AboutEditor";

export const metadata = {
  title: "우리 동네 세일 — 소개",
  description: "야채·정육·과일… 동네 가게의 실시간 세일을 지도에서 한눈에.",
};

/** Apple 스타일 긴 스크롤 소개(랜딩) 페이지. 콘텐츠는 SiteConfig 기반(관리자 편집 가능). */
export default async function AboutPage() {
  let introVideo: string | null = null;
  let aboutRaw: string | null = null;
  try {
    const cfgs = await prisma.siteConfig.findMany({
      where: { key: { in: ["intro_video_url", "about_content"] } },
    });
    introVideo = cfgs.find((c) => c.key === "intro_video_url")?.value ?? null;
    aboutRaw = cfgs.find((c) => c.key === "about_content")?.value ?? null;
  } catch {
    // DB 미연결
  }
  const content = parseAbout(aboutRaw);
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* Hero */}
      <section className="flex min-h-[88svh] flex-col items-center justify-center bg-black px-6 text-center text-white">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.3em] text-white/40">{content.hero.eyebrow}</p>
        </Reveal>
        <Reveal delay={120}>
          <h1 className="mt-5 bg-gradient-to-b from-white to-white/60 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-7xl">
            {content.hero.title}
          </h1>
        </Reveal>
        <Reveal delay={240}>
          <p className="mt-6 max-w-xl text-balance text-lg text-white/70 sm:text-xl">
            {content.hero.subtitle}
          </p>
        </Reveal>
        <Reveal delay={360}>
          <Link
            href="/"
            className="mt-10 inline-block rounded-full bg-white px-8 py-3 text-base font-semibold text-black"
          >
            {content.hero.cta}
          </Link>
        </Reveal>
        <Reveal delay={600}>
          <p className="mt-16 animate-bounce text-2xl text-white/30">↓</p>
        </Reveal>
      </section>

      {/* 소개 영상 (관리자가 업로드한 경우) */}
      {introVideo && (
        <section className="bg-black px-6 pb-24">
          <Reveal>
            <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl">
              <video src={introVideo} controls playsInline className="aspect-video w-full bg-black" />
            </div>
          </Reveal>
        </section>
      )}

      {/* 콘텐츠 블록 */}
      {content.blocks.map((b) => (
        <Section key={b.id} block={b} />
      ))}

      {/* values (고정 브랜드 가치) */}
      <section className="px-6 py-28">
        <Reveal>
          <h2 className="text-center text-4xl font-bold tracking-tight sm:text-5xl">
            믿을 수 있게, 가볍게.
          </h2>
        </Reveal>
        <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-3">
          {[
            { icon: "📍", t: "위치정보 최소", d: "단말 GPS 좌표는 저장하지 않아요. 지도 이동에만 잠깐 사용." },
            { icon: "🪙", t: "포인트 적립", d: "제보하면 포인트가 쌓여요. 부정 적립은 자동 회수." },
            { icon: "🛡️", t: "신뢰 기반", d: "신고가 쌓이면 자동 숨김 + 관리자 검토로 깨끗하게." },
          ].map((v, i) => (
            <Reveal key={v.t} delay={i * 120}>
              <div className="rounded-3xl border border-gray-100 bg-gray-50 p-8 text-center transition-transform duration-500 hover:scale-[1.03]">
                <div className="text-4xl">{v.icon}</div>
                <h3 className="mt-4 text-lg font-semibold">{v.t}</h3>
                <p className="mt-2 text-sm text-gray-500">{v.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* closing CTA */}
      <section className="flex flex-col items-center justify-center bg-black px-6 py-32 text-center text-white">
        <Reveal>
          <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">{content.closing.title}</h2>
        </Reveal>
        <Reveal delay={150}>
          <Link
            href="/"
            className="mt-10 inline-block rounded-full bg-white px-8 py-3 text-base font-semibold text-black"
          >
            {content.closing.cta}
          </Link>
        </Reveal>
        <p className="mt-16 text-xs text-white/30">{content.closing.footer}</p>
      </section>

      {/* 관리자 인라인 편집 */}
      {isAdmin && <AboutEditor content={content} introVideo={introVideo} />}
    </div>
  );
}

function Section({ block }: { block: AboutBlock }) {
  const { title, desc, emoji, gradient, imageUrl, dark = false } = block;
  return (
    <section className={`px-6 py-28 text-center ${dark ? "bg-black text-white" : "bg-white text-black"}`}>
      <Reveal>
        <h2 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">{title}</h2>
      </Reveal>
      <Reveal delay={120}>
        <p className={`mx-auto mt-5 max-w-xl text-balance text-lg ${dark ? "text-white/65" : "text-gray-500"}`}>
          {desc}
        </p>
      </Reveal>
      <Reveal delay={220}>
        {imageUrl ? (
          <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="aspect-video w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
            />
          </div>
        ) : (
          <div
            className={`mx-auto mt-12 flex aspect-video max-w-3xl items-center justify-center rounded-3xl bg-gradient-to-br ${gradient} transition-transform duration-500 hover:scale-[1.02]`}
          >
            <span className="text-7xl drop-shadow sm:text-8xl">{emoji}</span>
          </div>
        )}
      </Reveal>
    </section>
  );
}
