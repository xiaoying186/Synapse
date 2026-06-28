import { useState } from "react";

export function useActivityLog(initialMessage: string) {
  const [activity, setActivity] = useState(initialMessage);

  return { activity, setActivity };
}
