import { DiaryEntries, type DiaryEntry } from '../data/diaries';
import { useGameStore } from './useGameStore';

/** Diary order belongs to the save, not the inventory that resets each level. */
export function collectNextDiary(levelId: number): DiaryEntry | null {
  const state = useGameStore.getState();
  if (state.progress.levels[levelId]?.diariesCollected.length) return null;
  const entry = DiaryEntries.find((diary) => !state.progress.diariesCollected.includes(diary.id));
  if (!entry) return null;
  state.collectDiary(levelId, entry.id);
  return entry;
}
