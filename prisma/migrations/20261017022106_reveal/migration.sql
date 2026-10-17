-- AlterEnum
ALTER TYPE "RoundStatus" ADD VALUE 'REVEALED';

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "revealedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "estimate" TEXT,
ADD COLUMN     "estimatedAt" TIMESTAMP(3),
ADD COLUMN     "estimatedById" TEXT;

-- CreateTable
CREATE TABLE "RevealEntry" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "card" TEXT,

    CONSTRAINT "RevealEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RevealEntry_roundId_participantId_key" ON "RevealEntry"("roundId", "participantId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_estimatedById_fkey" FOREIGN KEY ("estimatedById") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevealEntry" ADD CONSTRAINT "RevealEntry_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevealEntry" ADD CONSTRAINT "RevealEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
