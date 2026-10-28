import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { download } from "@/drivers/download";
import { GUEST_DB, userDb } from "@/services/databases";
import { openData } from "@/services/openData";

import { FakeSupabase } from "./fakeSupabase";
import { testData } from "./testData";

const mockSupabase = new FakeSupabase();
jest.mock("@/drivers/supabase", () => ({ createSupabase: () => mockSupabase }));
jest.mock("@/services/openData", () => ({ openData: jest.fn(), deleteData: jest.fn() }));
jest.mock("@/drivers/download", () => ({ download: jest.fn() }));
jest.mock("@/ui/platform", () => ({ IS_WEB: true }));

const EMAIL = "ali@example.com";
const PASSWORD = "pass1234";

it("downloads the account's data on the web", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dilkart-"));
  const files = new Map<string, Awaited<ReturnType<typeof testData>>>();
  jest.mocked(openData).mockImplementation(async (name = GUEST_DB) => {
    const data = await testData(undefined, name, join(dir, name));
    files.set(name, data);
    return data;
  });
  const uid = mockSupabase.user(EMAIL, PASSWORD);

  await renderRouter("./src/app", { initialUrl: "/account" });
  await fireEvent.press(await screen.findByText("Giriş yap"));
  await fireEvent.changeText(await screen.findByLabelText("E-posta"), EMAIL);
  await fireEvent.changeText(screen.getByLabelText("Şifre"), PASSWORD);
  await fireEvent.press(screen.getByText("Giriş yap"));
  await screen.findByText(/Son eşitleme: /);
  await files.get(userDb(uid))?.library.createDeck("Fiiller");

  await fireEvent.press(screen.getByText("Verilerimi indir"));
  await waitFor(() =>
    expect(download).toHaveBeenCalledWith(expect.stringMatching(/^dilkart-\d{4}-\d{2}-\d{2}\.json$/), expect.stringContaining('"Fiiller"')),
  );
});
