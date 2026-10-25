import { DeckError } from "@dilkart/core";
import { useEffect, useState } from "react";

import { useLibrary } from "@/services/library";
import { Button, ButtonKind, Field, Screen } from "@/ui/components";
import { goBack } from "@/ui/navigation";

const MESSAGES: Record<DeckError, string> = {
  [DeckError.EmptyName]: "Deste adı boş olamaz.",
};

/** Creates a deck, or renames `deckId`. */
export function DeckNameScreen({ deckId }: { deckId?: string }) {
  const lib = useLibrary();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (deckId === undefined) {
      return;
    }
    lib.decks().then((decks) => setName(decks.find((d) => d.id === deckId)?.name ?? ""));
  }, [lib, deckId]);

  const save = async () => {
    const result = deckId === undefined ? await lib.createDeck(name) : await lib.renameDeck(deckId, name);
    if (!result.ok) {
      setError(result.errors.map((e) => MESSAGES[e]).join(" "));
      return;
    }
    goBack(deckId === undefined ? "/" : `/deck/${deckId}`);
  };

  return (
    <Screen>
      <Field label="Deste adı" value={name} onChangeText={setName} error={error} />
      <Button title="Kaydet" kind={ButtonKind.Primary} onPress={save} />
    </Screen>
  );
}
