"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AdminNotice = {
  id: string;
  kind: "notice" | "event";
  title: string;
  body: string;
  pinned: boolean;
  active: boolean;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = { notice: "공지", event: "이벤트" };

/** 관리자 공지/이벤트 작성·수정·삭제. */
export function NoticeAdmin({ notices }: { notices: AdminNotice[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"notice" | "event">("notice");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim() || !body.trim()) return alert("제목과 내용을 입력해 주세요.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, body, pinned }),
      });
      if (res.ok) {
        setTitle("");
        setBody("");
        setPinned(false);
        router.refresh();
      } else alert("등록에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/notices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) router.refresh();
    else alert("변경에 실패했어요.");
  };

  const remove = async (id: string) => {
    if (!confirm("이 공지를 삭제할까요?")) return;
    const res = await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else alert("삭제에 실패했어요.");
  };

  const input = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-blue-500";

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-line p-4">
        <h2 className="mb-2 text-sm font-semibold">새 공지 / 이벤트</h2>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {(["notice", "event"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={[
                  "rounded-full border px-3 py-1 text-xs",
                  kind === k ? "border-blue-600 bg-brand text-white" : "border-line text-ink-2",
                ].join(" ")}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1 text-xs text-ink-3">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              상단 고정
            </label>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className={input} />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="내용"
            className={`${input} resize-none`}
          />
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="self-start rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-300"
          >
            {busy ? "등록 중…" : "등록"}
          </button>
        </div>
      </section>

      <ul className="flex flex-col gap-2">
        {notices.length === 0 && <p className="text-sm text-ink-3">등록된 공지가 없어요.</p>}
        {notices.map((n) => (
          <li key={n.id} className="rounded-xl border border-line p-3">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  n.kind === "event" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-brand-ink",
                ].join(" ")}
              >
                {KIND_LABEL[n.kind]}
              </span>
              {n.pinned && <span className="text-xs text-amber-600">📌 고정</span>}
              {!n.active && <span className="text-xs text-ink-3">숨김</span>}
              <span className="ml-auto text-xs text-ink-3">
                {new Date(n.createdAt).toLocaleDateString("ko-KR")}
              </span>
            </div>
            <p className="mt-1 font-medium">{n.title}</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-2">{n.body}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <button type="button" onClick={() => patch(n.id, { pinned: !n.pinned })} className="text-amber-600">
                {n.pinned ? "고정 해제" : "상단 고정"}
              </button>
              <button type="button" onClick={() => patch(n.id, { active: !n.active })} className="text-ink-2">
                {n.active ? "숨기기" : "노출하기"}
              </button>
              <button type="button" onClick={() => remove(n.id)} className="text-red-500">
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
