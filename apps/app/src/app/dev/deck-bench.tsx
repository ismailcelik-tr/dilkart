import type { Card } from "@dilkart/core";
import { useEffect, useRef, useState } from "react";

import { CardList } from "@/features/cards/CardList";
import { useLibrary } from "@/services/library";
import { Empty } from "@/ui/components";

const BENCH_DECK = "Ölçüm (1.000 kart)";
const CARDS = 1_000;
const PROGRESS_STEP = 100;

/** Plan section 12: a 1,000-card deck list opens within 300 ms. Result: `DECK_BENCH` log line. */
export default function DeckBench() {
  const lib = useLibrary();
  const [status, setStatus] = useState("Hazırlanıyor");
  const [cards, setCards] = useState<Card[]>();
  const [result, setResult] = useState<string>();
  const run = useRef({ started: 0, queryMs: 0, seeded: false, reported: false });

  useEffect(() => {
    (async () => {
      let deck = (await lib.decks()).find((d) => d.name === BENCH_DECK);
      if (deck === undefined) {
        const created = await lib.createDeck(BENCH_DECK);
        if (!created.ok) {
          throw new Error("bench deck");
        }
        for (let i = 0; i < CARDS; i++) {
          await lib.createCard(created.id, { front: `word ${i}`, meanings: [{ tr: `kelime ${i}` }] });
          if (i % PROGRESS_STEP === 0) {
            setStatus(`Kart oluşturuluyor: ${i}`);
          }
        }
        run.current.seeded = true;
        deck = { id: created.id, name: BENCH_DECK, cardCount: CARDS };
      }

      run.current.started = performance.now();
      const list = await lib.cards(deck.id);
      run.current.queryMs = performance.now() - run.current.started;
      setCards(list);
    })().catch((e) => console.error("DECK_BENCH", e));
  }, [lib]);

  const rendered = () => {
    const r = run.current;
    if (r.reported) {
      return;
    }
    r.reported = true;
    const report = { cards: cards?.length, seeded: r.seeded, queryMs: r.queryMs, openMs: performance.now() - r.started };
    console.log("DECK_BENCH", JSON.stringify(report));
    setResult(`${report.cards} kart · sorgu ${report.queryMs.toFixed(0)} ms · açılış ${report.openMs.toFixed(0)} ms`);
  };

  if (cards === undefined) {
    return <Empty text={status} />;
  }
  return <CardList cards={cards} footer={result ? <Empty text={result} /> : undefined} onContentSizeChange={rendered} />;
}
