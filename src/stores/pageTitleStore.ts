import { create } from "zustand";

interface PageTitleStore {
  title: string | null;
  setPageTitle: (title: string | null) => void;
}

export const usePageTitleStore = create<PageTitleStore>((set) => ({
  title: null,
  setPageTitle: (title) => set({ title }),
}));
