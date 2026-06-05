/**
 * 동영상 임베드 (YouTube/Vimeo 링크 → iframe, 그 외 → <video>).
 * 외부 링크만 다루므로 저장 부담 없음.
 */
function parse(url: string): { kind: "youtube" | "vimeo" | "file"; src: string } | null {
  const u = url.trim();
  if (!u) return null;
  // YouTube
  const yt =
    u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/)?.[1];
  if (yt) return { kind: "youtube", src: `https://www.youtube.com/embed/${yt}` };
  // Vimeo
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
  if (vm) return { kind: "vimeo", src: `https://player.vimeo.com/video/${vm}` };
  // 직접 파일(mp4/webm/mov 등)
  if (/^https?:\/\//.test(u)) return { kind: "file", src: u };
  return null;
}

export function VideoEmbed({ url, className = "" }: { url: string; className?: string }) {
  const v = parse(url);
  if (!v) return null;
  return (
    <div className={`aspect-video w-full overflow-hidden bg-black ${className}`}>
      {v.kind === "file" ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={v.src} controls playsInline className="h-full w-full" />
      ) : (
        <iframe
          src={v.src}
          title="동영상"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      )}
    </div>
  );
}
