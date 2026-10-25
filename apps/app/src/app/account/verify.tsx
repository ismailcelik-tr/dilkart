import { useLocalSearchParams } from "expo-router";

import { VerifyScreen } from "@/features/account/VerifyScreen";
import { CodeKind } from "@/services/account";

export default function Verify() {
  const p = useLocalSearchParams<{ email: string; kind: string }>();
  return <VerifyScreen email={p.email} kind={p.kind === CodeKind.Recovery ? CodeKind.Recovery : CodeKind.SignUp} />;
}
