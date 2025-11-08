PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    "userId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Assignment" ("id", "userId", "experimentId", "variantId", "createdAt")
SELECT
    COALESCE(NULLIF("id", ''), lower(hex(randomblob(16)))),
    "userId",
    "experimentId",
    "variantId",
    "createdAt"
FROM "Assignment";

DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";

CREATE UNIQUE INDEX "Assignment_experimentId_userId_key" ON "Assignment"("experimentId", "userId");
PRAGMA foreign_keys=ON;
