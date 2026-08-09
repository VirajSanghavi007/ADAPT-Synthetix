"use client";

import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | ADAPT-Synthetix 2.0`;
  }, [title]);
}
