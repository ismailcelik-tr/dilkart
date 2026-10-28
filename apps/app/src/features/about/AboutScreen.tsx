import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Linking, Text } from "react-native";

import { useDictionary } from "@/services/library";
import { Empty, Group, Row, Screen } from "@/ui/components";
import { IS_WEB } from "@/ui/platform";
import { useTheme } from "@/ui/theme";

interface Source {
  name: string;
  url: string;
  license: string;
  via: string | null;
}

/** CC BY-SA and CC BY require crediting every source of the bundled pack. */
export function AboutScreen() {
  const { dictionary } = useDictionary();
  const theme = useTheme();
  // Web has no dictionary pack, so nothing to credit.
  const [sources, setSources] = useState<Source[] | undefined>(IS_WEB ? [] : undefined);
  const [version, setVersion] = useState<string>();

  useEffect(() => {
    if (IS_WEB) {
      return;
    }
    (async () => {
      const rows = await (await dictionary()).all<{ key: string; value: string }>(
        "SELECT key, value FROM meta WHERE key IN ('attribution', 'pack_version')",
        [],
      );
      const meta = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      setSources(JSON.parse(meta.attribution ?? "[]") as Source[]);
      setVersion(meta.pack_version);
    })();
  }, [dictionary]);

  if (sources === undefined) {
    return null;
  }
  return (
    <Screen>
      <Empty text={`DilKart ${Constants.expoConfig?.version ?? ""}`} />
      {IS_WEB ? (
        <Text style={{ color: theme.text }}>Uygulamanın kaynak kodu MIT lisanslıdır.</Text>
      ) : (
        <>
          <Text style={{ color: theme.text }}>
            Sözlük paketi (sürüm {version}) CC BY-SA 4.0 lisanslıdır ve aşağıdaki kaynaklardan derlenmiştir.
            Uygulamanın kaynak kodu MIT lisanslıdır.
          </Text>
          <Group>
            {sources.map((s) => (
              <Row
                key={s.name}
                title={s.name}
                subtitle={[s.license, s.via && `${s.via} üzerinden`].filter(Boolean).join(" · ")}
                onPress={() => Linking.openURL(s.url)}
              />
            ))}
          </Group>
        </>
      )}
      <Empty text="github.com/ismailcelik-tr/dilkart" />
    </Screen>
  );
}
