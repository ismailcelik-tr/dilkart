import { Accent, CardState, Rating, Table, type UserSettings } from "@dilkart/core";
import { getAvailableVoicesAsync, speak, VoiceQuality } from "expo-speech";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { openData } from "@/services/openData";

import { testData } from "./testData";

jest.mock("@/services/openData", () => ({ openData: jest.fn() }));
jest.mock("expo-speech", () => ({
  ...jest.requireActual("expo-speech/build/Speech.types"),
  speak: jest.fn(),
  stop: jest.fn(async () => undefined),
  getAvailableVoicesAsync: jest.fn(),
}));

const APP = "./src/app";
const WORDS: [string, string][] = [
  ["go", "gitmek"],
  ["run", "koşmak"],
  ["see", "görmek"],
  ["eat", "yemek"],
];
const US_VOICE = { identifier: "us", name: "Samantha", quality: VoiceQuality.Default, language: "en-US" };
const GB_VOICE = { identifier: "gb", name: "Daniel", quality: VoiceQuality.Default, language: "en-GB" };

let data: Awaited<ReturnType<typeof testData>>;
let deckId: string;

async function setup(words = WORDS, settings: Partial<UserSettings> = {}) {
  data = await testData(settings);
  jest.mocked(openData).mockResolvedValue(data);
  const deck = await data.library.createDeck("Fiiller");
  deckId = deck.ok ? deck.id : "";
  const ids: string[] = [];
  for (const [front, tr] of words) {
    const card = await data.library.createCard(deckId, { front, meanings: [{ tr }] });
    ids.push(card.ok ? card.id : "");
  }
  return ids;
}

async function start(module: string) {
  await renderRouter(APP, { initialUrl: `/study?deckId=${deckId}` });
  await fireEvent.press(await screen.findByText(module));
  await fireEvent.press(screen.getByText("Başla"));
}

async function logsOf(cardId: string) {
  return data.store.select(Table.ReviewLogs, "card_id = ?", [cardId]);
}

beforeEach(() => {
  jest.mocked(getAvailableVoicesAsync).mockResolvedValue([US_VOICE]);
  jest.mocked(speak).mockClear();
});

describe("study start", () => {
  it("shows today's counts", async () => {
    await setup();
    await renderRouter(APP, { initialUrl: `/study?deckId=${deckId}` });
    expect(await screen.findByText("Yeni 4 · Tekrar 0 · Öğrenme 0")).toBeOnTheScreen();
  });

  it("offers practice when nothing is due", async () => {
    const [go = ""] = await setup(WORDS, { newPerDay: 0 });
    await renderRouter(APP, { initialUrl: `/study?deckId=${deckId}` });
    expect(await screen.findByText("Bugünlük bitti")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Serbest çalış"));
    await fireEvent.press(await screen.findByText("Cevabı göster"));
    await fireEvent.press(screen.getByText("Tekrar"));
    const logs = (await Promise.all((await data.library.cards(deckId)).map((c) => logsOf(c.id)))).flat();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ scheduled: false });
    expect((await data.library.card(go))?.fsrs).toBeUndefined();
  });

  it("disables listening without an English voice", async () => {
    jest.mocked(getAvailableVoicesAsync).mockResolvedValue([]);
    await setup();
    await renderRouter(APP, { initialUrl: `/study?deckId=${deckId}` });
    expect(await screen.findByText(/Cihazda İngilizce ses yok/)).toBeOnTheScreen();
  });

  it("disables matching below four cards", async () => {
    await setup(WORDS.slice(0, 3));
    await renderRouter(APP, { initialUrl: `/study?deckId=${deckId}` });
    expect(await screen.findByText("Eşleştirme için en az 4 kart gerekli.")).toBeOnTheScreen();
  });
});

describe("recall", () => {
  it("runs until every new card graduates", async () => {
    const [go = ""] = await setup(WORDS.slice(0, 2));
    await start("Anlam hatırlama");
    expect(await screen.findByText("go")).toBeOnTheScreen();
    for (let i = 0; i < 4; i++) {
      await fireEvent.press(await screen.findByText("Cevabı göster"));
      await fireEvent.press(screen.getByText("İyi"));
    }
    expect(await screen.findByText("Oturum bitti")).toBeOnTheScreen();
    expect((await data.library.card(go))?.fsrs?.state).toBe(CardState.Review);
  });

  it("shows the next interval under each rating", async () => {
    await setup(WORDS.slice(0, 1));
    await start("Anlam hatırlama");
    await fireEvent.press(await screen.findByText("Cevabı göster"));
    expect(screen.getByText("1 dk")).toBeOnTheScreen();
    expect(screen.getByText("10 dk")).toBeOnTheScreen();
  });
});

describe("typing", () => {
  it("shows the right spelling and counts a wrong answer as Again", async () => {
    const [go = ""] = await setup();
    await start("Yazarak");
    expect(await screen.findByText("gitmek")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText("Cevabın"), "went");
    await fireEvent.press(screen.getByText("Kontrol et"));
    expect(await screen.findByText("Yanlış")).toBeOnTheScreen();
    expect(screen.getByText("go")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Devam"));
    expect(await logsOf(go)).toEqual([expect.objectContaining({ rating: Rating.Again, mode: 3, scheduled: true })]);
  });

  it("accepts a near miss as Hard", async () => {
    const [go = ""] = await setup();
    await start("Yazarak");
    await fireEvent.changeText(await screen.findByLabelText("Cevabın"), "goo");
    await fireEvent.press(screen.getByText("Kontrol et"));
    expect(await screen.findByText("Neredeyse doğru")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Devam"));
    expect(await logsOf(go)).toEqual([expect.objectContaining({ rating: Rating.Hard })]);
  });
});

describe("listening", () => {
  it("speaks the word with the accent's voice", async () => {
    await setup();
    await start("Dinleyip yazma");
    await screen.findByLabelText("Cevabın");
    await waitFor(() => expect(speak).toHaveBeenCalledWith("go", expect.objectContaining({ language: "en-US", voice: "us" })));
  });

  it("speaks with the chosen accent", async () => {
    jest.mocked(getAvailableVoicesAsync).mockResolvedValue([US_VOICE, GB_VOICE]);
    await setup(WORDS, { accent: Accent.GB });
    await start("Dinleyip yazma");
    await waitFor(() => expect(speak).toHaveBeenCalledWith("go", expect.objectContaining({ language: "en-GB", voice: "gb" })));
    expect(speak).not.toHaveBeenCalledWith("go", expect.objectContaining({ language: "en-US" }));
  });

  it("speaks in silent mode", async () => {
    await setup();
    await start("Dinleyip yazma");
    await waitFor(() =>
      expect(speak).toHaveBeenCalledWith("go", expect.objectContaining({ useApplicationAudioSession: false })),
    );
  });
});

describe("matching", () => {
  it("logs each pair as practice and finishes the round", async () => {
    const ids = await setup();
    await start("Eşleştirme");
    for (const [front, tr] of WORDS) {
      await fireEvent.press(await screen.findByText(front));
      await fireEvent.press(screen.getByText(tr));
    }
    expect(await screen.findByText("Tur bitti")).toBeOnTheScreen();
    for (const id of ids) {
      expect(await logsOf(id)).toEqual([expect.objectContaining({ rating: Rating.Good, mode: 5, scheduled: false })]);
    }
  });

  it("logs a wrong pick as Again", async () => {
    const [go = ""] = await setup();
    await start("Eşleştirme");
    await fireEvent.press(await screen.findByText("go"));
    await fireEvent.press(screen.getByText("koşmak"));
    expect(await logsOf(go)).toEqual([expect.objectContaining({ rating: Rating.Again, scheduled: false })]);
  });
});
