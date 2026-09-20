import { DiaryEntries, LevelDiaryIds, type DiaryEntry } from '../data/diaries';
import { levelIdToResource } from '../data/levelTree';
import { useGameStore } from './useGameStore';

/** Each level owns a specific log, independent of campaign or collection order. */
export function collectLevelDiary(levelId: number): DiaryEntry | null {
  const state = useGameStore.getState();
  if (state.progress.levels[levelId]?.diariesCollected.length) return null;
  const diaryId = LevelDiaryIds[levelIdToResource[levelId]];
  const entry = DiaryEntries.find((diary) => diary.id === diaryId);
  if (!entry) return null;
  state.collectDiary(levelId, entry.id);
  return entry;
}
