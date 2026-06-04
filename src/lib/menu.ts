/**
 * 메뉴(상품) 관리 권한 (스펙 Phase 7b).
 * - 관리자: 항상 가능
 * - 소유자(owner) 있는 가게: 소유자만
 * - 소유자 없는(소비자 등록) 가게: 로그인한 누구나 (커뮤니티 방식)
 */
export function canManageMenu(
  store: { ownerId: string | null },
  user: { id: string; role: "user" | "admin" | "merchant" } | null,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (store.ownerId) return store.ownerId === user.id;
  return true;
}
