import { Rating, Table, uuidv7 } from "@dilkart/core";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { openData } from "@/services/openData";

import { testData } from "./testData";

jest.mock("@/services/openData", () => ({ openData: jest.fn() }));

const APP = "./src/app";
let data: Awaited<ReturnType<typeof testData>>;
let deckId: string;

beforeEach(async () => {
  data = await testData();
  jest.mocked(openData).mockResolvedValue(data);
  const deck = await data.library.createDeck("Fiiller");
  deckId = deck.ok ? deck.id : "";
});

async function card(front: string) {
  const r = await data.library.createCard(deckId, { front, meanings: [{ tr: `${front}-tr` }] });
  return r.ok ? r.id : "";
}

/** Three wrong answers in a row: enough for a suggestion. */
async function struggling(front: string) {
  const id = await card(front);
  for (let i = 3; i > 0; i--) {
    const at = Date.now() - i * 60_000;
    await data.store.append(uuidv7(at), {
      card_id: id,
      reviewed_at: new Date(at).toISOString(),
      rating: Rating.Again,
      mode: 1,
      tz_offset_min: 180,
      elapsed_ms: 1_000,
      scheduled: true,
    });
  }
  return id;
}

describe("weak strip", () => {
  it("stays hidden when nothing is weak", async () => {
    await card("go");
    await renderRouter(APP, { initialUrl: "/" });
    await screen.findByText("Fiiller");
    expect(screen.queryByText(/zayıf kelime|yeni öneri/)).toBeNull();
  });

  it("counts weak words and suggestions", async () => {
    const go = await struggling("go");
    await struggling("run");
    await data.weak.decide([go], []);

    await renderRouter(APP, { initialUrl: "/" });
    expect(await screen.findByText("1 zayıf kelime")).toBeOnTheScreen();
    expect(screen.getByText("1 yeni öneri")).toBeOnTheScreen();
  });
});

describe("suggestions", () => {
  it("accepts the checked words and rejects the unchecked ones", async () => {
    const go = await struggling("go");
    const run = await struggling("run");

    await renderRouter(APP, { initialUrl: "/weak/suggestions" });
    await fireEvent.press(await screen.findByText("run"));
    await fireEvent.press(screen.getByText("Onayla"));

    await waitFor(async () => expect((await data.library.card(go))?.isWeak).toBe(true));
    expect((await data.library.card(run))?.isWeak).toBe(false);
    expect((await data.store.read(Table.Cards, run))?.weak_dismissed_until).toEqual(expect.any(String));
  });

  it("says so when there is nothing to review", async () => {
    await renderRouter(APP, { initialUrl: "/weak/suggestions" });
    expect(await screen.findByText("Öneri yok")).toBeOnTheScreen();
  });
});

describe("weak session", () => {
  it("studies only weak words, as practice", async () => {
    const go = await struggling("go");
    await card("see");
    await data.weak.decide([go], []);

    await renderRouter(APP, { initialUrl: "/study?weak=1" });
    expect(await screen.findByText("Zayıf 1")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Anlam hatırlama"));
    await fireEvent.press(screen.getByText("Başla"));

    expect(await screen.findByText("go")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Cevabı göster"));
    await fireEvent.press(await screen.findByText("İyi"));

    expect(await screen.findByText("Oturum bitti")).toBeOnTheScreen();
    const logs = await data.store.select(Table.ReviewLogs, "card_id = ? AND rating = ?", [go, Rating.Good]);
    expect(logs).toMatchObject([{ scheduled: false }]);
  });
});
