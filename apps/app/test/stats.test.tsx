import { GOAL_OFF, Rating, uuidv7 } from "@dilkart/core";
import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import { openData } from "@/services/openData";

import { testData } from "./testData";

jest.mock("@/services/openData", () => ({ openData: jest.fn() }));

const APP = "./src/app";
const SEC = 1_000;
const DAY = 86_400_000;
let data: Awaited<ReturnType<typeof testData>>;
let cardId: string;

beforeEach(async () => {
  data = await testData();
  jest.mocked(openData).mockResolvedValue(data);
  const deck = await data.library.createDeck("Fiiller");
  const created = await data.library.createCard(deck.ok ? deck.id : "", { front: "go", meanings: [{ tr: "gitmek" }] });
  cardId = created.ok ? created.id : "";
});

/** `count` answers, the newest `msAgo` before now. */
async function answers(count: number, msAgo = 0) {
  for (let i = 0; i < count; i++) {
    const at = Date.now() - msAgo - i * SEC;
    await data.store.append(uuidv7(at), {
      card_id: cardId,
      reviewed_at: new Date(at).toISOString(),
      rating: Rating.Good,
      mode: 1,
      tz_offset_min: 180,
      elapsed_ms: 1_000,
      scheduled: true,
    });
  }
}

describe("streak row", () => {
  it("invites to start a streak", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    expect(await screen.findByText("Seriyi başlat")).toBeOnTheScreen();
    expect(screen.getByText("Bugün 0/50 cevap")).toBeOnTheScreen();
    expect(screen.getByTestId("goal-progress")).toBeOnTheScreen();
  });

  it("shows progress toward the goal", async () => {
    await answers(2);
    await renderRouter(APP, { initialUrl: "/" });
    expect(await screen.findByText("🔥 1 gün seri")).toBeOnTheScreen();
    expect(screen.getByText("Bugün 2/50 cevap")).toBeOnTheScreen();
  });

  it("marks the goal done", async () => {
    await data.settings.set({ dailyGoal: 20 });
    await answers(20);
    await renderRouter(APP, { initialUrl: "/" });
    expect(await screen.findByText("Hedef tamam: 20/20 ✓")).toBeOnTheScreen();
  });

  it("keeps yesterday's streak alive", async () => {
    await answers(1, DAY);
    await renderRouter(APP, { initialUrl: "/" });
    expect(await screen.findByText("🔥 1 gün seri")).toBeOnTheScreen();
    expect(screen.getByText("Bugün çalışırsan 2 olur · 0/50")).toBeOnTheScreen();
  });

  it("drops the goal and the bar when the goal is off", async () => {
    await data.settings.set({ dailyGoal: GOAL_OFF });
    await answers(3);
    await renderRouter(APP, { initialUrl: "/" });
    expect(await screen.findByText("Bugün 3 cevap")).toBeOnTheScreen();
    expect(screen.queryByTestId("goal-progress")).toBeNull();
  });
});

describe("statistics page", () => {
  it("opens from the streak row", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    await fireEvent.press(await screen.findByText("Seriyi başlat"));
    expect(await screen.findByText("Önümüzdeki 7 gün")).toBeOnTheScreen();
  });

  it("opens from the home button", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    await fireEvent.press(await screen.findByText("İstatistikler"));
    expect(await screen.findByText("Önümüzdeki 7 gün")).toBeOnTheScreen();
  });

  it("says so before any study and still shows cards and forecast", async () => {
    await renderRouter(APP, { initialUrl: "/stats" });
    expect(await screen.findByText("Henüz çalışma yok")).toBeOnTheScreen();
    expect(screen.queryByText("Son 30 gün")).toBeNull();
    expect(screen.getByText("Yeni")).toBeOnTheScreen();
    expect(screen.getByText("Bugün")).toBeOnTheScreen();
    expect(screen.getByText("Yarın")).toBeOnTheScreen();
  });

  it("shows history after study", async () => {
    await answers(3);
    await renderRouter(APP, { initialUrl: "/stats" });
    expect(await screen.findByText("Son 30 gün")).toBeOnTheScreen();
    expect(screen.getByText("Toplam 3 · günlük ort. 0 · en yüksek 3")).toBeOnTheScreen();
    expect(screen.getAllByText("1 gün")).toHaveLength(2);
    expect(screen.getAllByText("%100 · 1 cevap")).toHaveLength(2);
    expect(screen.getByTestId("goal-line")).toBeOnTheScreen();
  });
});
