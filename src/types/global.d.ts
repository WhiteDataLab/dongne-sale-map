// 카카오맵 JS SDK 는 공식 타입을 제공하지 않는 서드파티 SDK 다.
// 최소 ambient 선언만 두고, 인스턴스는 any 로 다룬다. (any 사유: 무타입 SDK)
declare global {
  interface Window {
    kakao: any;
  }
}

export {};
