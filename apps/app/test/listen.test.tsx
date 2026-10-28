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
const VOICE = { identifier: "us", name: "Samantha", quality: VoiceQuality.Default, language: "en-US" };
const EXAMPLE = "Let's go home.";
let deckId: string;

beforeEach(async () => {
  jest.mocked(getAvailableVoicesAsync).mockResolvedValue([VOICE]);
  jest.mocked(speak).mockClear();
  const data = await testData();
  jest.mocked(openData).mockResolvedValue(data);
  const deck = await data.library.createDeck("Fiiller");
  deckId = deck.ok ? deck.id : "";
  await data.library.createCard(deckId, { front: "go", meanings: [{ tr: "gitmek" }], exampleEn: EXAMPLE });
});

const spoke = (text: string) => waitFor(() => expect(speak).toHaveBeenCalledWith(text, expect.anything()));

async function search(query: string, direction: string) {
  await renderRouter(APP, { initialUrl: "/dictionary" });
  await fireEvent.press(await screen.findByText(direction));
  await fireEvent.changeText(screen.getByLabelText("Sözlükte ara"), query);
}

describe("listen", () => {
  it("reads a card's front from the list without opening the card", async () => {
    await renderRouter(APP, { initialUrl: `/deck/${deckId}` });
    await fireEvent.press(await screen.findByLabelText("Dinle: go"));
    await spoke("go");
    expect(screen.queryByText("Ön yüz")).toBeNull();
  });

  it("reads the example sentence after the answer", async () => {
    await renderRouter(APP, { initialUrl: `/study?deckId=${deckId}` });
    await fireEvent.press(await screen.findByText("Anlam hatırlama"));
    await fireEvent.press(screen.getByText("Başla"));
    await fireEvent.press(await screen.findByText("Cevabı göster"));
    await fireEvent.press(await screen.findByLabelText(`Dinle: ${EXAMPLE}`));
    await spoke(EXAMPLE);
  });

  it("reads the English headword and only the English half of an example", async () => {
    await search("book", "EN→TR");
    await fireEvent.press((await screen.findAllByLabelText("Dinle: book"))[0]!);
    await spoke("book");
    await fireEvent.press((await screen.findAllByLabelText("Dinle: This book is mine."))[0]!);
    await spoke("This book is mine.");
  });

  it("reads the English sense, not the Turkish headword, from TR→EN", async () => {
    await search("kitaplarım", "TR→EN");
    await fireEvent.press((await screen.findAllByLabelText("Dinle: book"))[0]!);
    await spoke("book");
    expect(screen.queryByLabelText("Dinle: kitap")).toBeNull();
  });

  it("shows no speaker without an English voice", async () => {
    jest.mocked(getAvailableVoicesAsync).mockResolvedValue([]);
    await renderRouter(APP, { initialUrl: `/deck/${deckId}` });
    expect(await screen.findByText("go")).toBeOnTheScreen();
    expect(screen.queryAllByLabelText(/^Dinle:/)).toHaveLength(0);
  });
});
