-- CreateTable
CREATE TABLE "_saved_articles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_saved_articles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_saved_articles_B_index" ON "_saved_articles"("B");

-- AddForeignKey
ALTER TABLE "_saved_articles" ADD CONSTRAINT "_saved_articles_A_fkey" FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_saved_articles" ADD CONSTRAINT "_saved_articles_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
