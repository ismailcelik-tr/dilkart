import { confirm } from "@/ui/confirm.web";

describe("confirm on web", () => {
  it("asks the browser and resolves its answer", async () => {
    window.confirm = jest.fn(() => true);
    await expect(confirm("Desteyi sil", "Fiiller silinecek.", "Sil")).resolves.toBe(true);
    expect(window.confirm).toHaveBeenCalledWith("Desteyi sil\n\nFiiller silinecek.");
  });
});
