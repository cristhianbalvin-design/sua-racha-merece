import type { ReactNode } from "react";
import { IS_NATIVE } from "@/lib/platform";
import { OpenInApp } from "./OpenInApp";

export function NativeOnly({ path, children, native = IS_NATIVE }: { path: string; children: ReactNode; native?: boolean }) {
  return native ? <>{children}</> : <OpenInApp path={path} />;
}
