-- M7(L2): 떨이 픽업 예약
-- Sale 에 예약 옵션 컬럼 추가 + Reservation 모델 + ReservationStatus enum.

-- 예약 상태 enum
CREATE TYPE "ReservationStatus" AS ENUM ('reserved', 'picked_up', 'canceled', 'no_show');

-- Sale: 픽업 예약 받기 옵션
ALTER TABLE "Sale" ADD COLUMN "reservable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Sale" ADD COLUMN "stockTotal" INTEGER;
ALTER TABLE "Sale" ADD COLUMN "pickupInfo" TEXT;

-- Reservation: 떨이 픽업 예약(현장결제 v1)
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceKrw" INTEGER NOT NULL,
    "amountKrw" INTEGER NOT NULL,
    "feeKrw" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'reserved',
    "pickupCode" TEXT NOT NULL,
    "canceledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickedUpAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Reservation_userId_idx" ON "Reservation"("userId");
CREATE INDEX "Reservation_storeId_status_idx" ON "Reservation"("storeId", "status");
CREATE INDEX "Reservation_saleId_status_idx" ON "Reservation"("saleId", "status");

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
