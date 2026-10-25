import { Direction } from "@dilkart/core";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { openData } from "@/services/openData";

import { testData } from "./testData";

jest.mock("@/services/openData", () => ({ openData: jest.fn() }));

const APP = "./src/app";
let data: Awaited<ReturnType<typeof testData>>;

beforeEach(async () => {
  data = await testData();
  jest.mocked(openData).mockResolvedValue(data);
});

async function search(query: string, direction = "EN→TR") {
  await renderRouter(APP, { initialUrl: "/dictionary" });
  await fireEvent.press(await screen.findByText(direction));
  await fireEvent.changeText(screen.getByLabelText("Sözlükte ara"), query);
}

async function deck(name: string) {
  const r = await data.library.createDeck(name);
  return r.ok ? r.id : "";
}

describe("dictionary panel", () => {
  it("finds a word through its inflection", async () => {
    await search("went");
    expect(await screen.findByText("gitmek")).toBeOnTheScreen();
  });

  it("searches Turkish words", async () => {
    await search("kitaplarım", "TR→EN");
    expect(await screen.findByText("book")).toBeOnTheScreen();
  });

  it("adds a sense to the fallback deck with one tap", async () => {
    await search("run");
    await fireEvent.press(await screen.findByLabelText("Karta ekle: koşmak"));

    expect(await screen.findByText("Sözlükten destesine eklendi")).toBeOnTheScreen();
    const [target] = await data.library.decks();
    expect(target?.name).toBe("Sözlükten");
    expect(await data.library.cards(target?.id ?? "")).toEqual([
      expect.objectContaining({ front: "run", meanings: [{ tr: "koşmak", pos: "verb" }] }),
    ]);
  });

  it("warns instead of adding the same sense twice", async () => {
    await search("run");
    const add = await screen.findByLabelText("Karta ekle: koşmak");
    await fireEvent.press(add);
    await screen.findByText("Sözlükten destesine eklendi");
    await fireEvent.press(add);

    expect(await screen.findByText("Bu anlam zaten Sözlükten destesinde")).toBeOnTheScreen();
    expect((await data.library.allCards()).length).toBe(1);
  });

  it("lets a long press choose the deck and remembers it", async () => {
    const verbs = await deck("Fiiller");
    await deck("Tekrar");
    await search("run");
    await fireEvent(await screen.findByLabelText("Karta ekle: koşmak"), "longPress");
    await fireEvent.press(await screen.findByText("Fiiller"));
    expect(await screen.findByText("Fiiller destesine eklendi")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("Karta ekle: işletmek"));
    await screen.findByText("Fiiller destesine eklendi");
    expect((await data.library.cards(verbs)).map((c) => c.meanings[0]?.tr).sort()).toEqual(["işletmek", "koşmak"]);
  });

  it("shows recent searches and repeats one", async () => {
    await data.recent.add("kitap", Direction.TrEn);
    await renderRouter(APP, { initialUrl: "/dictionary" });
    await fireEvent.press(await screen.findByText("kitap"));
    expect(await screen.findByText("book")).toBeOnTheScreen();
  });

  it("records a search when it is submitted", async () => {
    await search("run");
    await fireEvent(screen.getByLabelText("Sözlükte ara"), "submitEditing");
    await waitFor(async () => expect(await data.recent.list()).toEqual([{ query: "run", direction: "en-tr" }]));
  });
});

describe("about", () => {
  it("opens from the deck list and lists every source of the pack", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    await fireEvent.press(await screen.findByText("Hakkında"));
    expect(await screen.findByText(/^DilKart/)).toBeOnTheScreen();
    for (const name of ["Vikisözlük", "English Wiktionary", "Open English WordNet", "Tatoeba"]) {
      expect(await screen.findByText(name)).toBeOnTheScreen();
    }
    expect(screen.getAllByText(/CC BY-SA 4.0/).length).toBeGreaterThanOrEqual(3);
  });
});
