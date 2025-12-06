/**
 * Level Tree - Level progression structure matching the original Replica Island
 * 
 * The level tree defines all levels, their order, timestamps, and unlock logic.
 * Levels are grouped together; completing any level in a group unlocks the next group.
 */

export interface Level {
  /** Level resource identifier (e.g., 'level_0_1_sewer') */
  resource: string;
  /** Display name (e.g., 'Memory #000') */
  name: string;
  /** Timestamp shown in level select (e.g., '+ 07:12:03') */
  timeStamp: string;
  /** Whether this level takes place in the past (flashback) */
  inThePast: boolean;
  /** Whether this level is completed */
  completed: boolean;
  /** Whether this level restarts on death */
  restartable: boolean;
  /** Whether to show a wait message when loading */
  showWaitMessage: boolean;
  /** Row index in the level tree */
  row: number;
  /** Index within the row */
  index: number;
}

/**
 * Map from resource name to numeric level ID (used by LevelSystem)
 */
export const resourceToLevelId: Record<string, number> = {
  'level_0_1_sewer': 1,
  'level_0_2_lab': 2,
  'level_0_3_lab': 3,
  'level_1_1_island': 4,
  'level_1_2_island': 5,
  'level_1_3_island': 6,
  'level_1_4_island': 7,
  'level_1_5_island': 8,
  'level_1_6_island': 9,
  'level_1_8_island': 10,
  'level_1_9_island': 11,
  'level_2_1_grass': 12,
  'level_2_2_grass': 13,
  'level_2_3_grass': 14,
  'level_2_4_grass': 15,
  'level_2_5_grass': 16,
  'level_2_6_grass': 17,
  'level_2_7_grass': 18,
  'level_2_8_grass': 19,
  'level_2_9_grass': 20,
  'level_3_0_sewer': 21,
  'level_3_1_grass': 22,
  'level_3_2_sewer': 23,
  'level_3_3_sewer': 24,
  'level_3_4_sewer': 25,
  'level_3_5_sewer': 26,
  'level_3_6_sewer': 27,
  'level_3_7_sewer': 28,
  'level_3_8_sewer': 29,
  'level_3_9_sewer': 30,
  'level_3_10_sewer': 31,
  'level_3_11_sewer': 32,
  'level_4_1_underground': 33,
  'level_4_2_underground': 34,
  'level_4_3_underground': 35,
  'level_4_4_underground': 36,
  'level_4_5_underground': 37,
  'level_4_7_underground': 38,
  'level_4_8_underground': 39,
  'level_4_9_underground': 40,
  'level_final_boss_lab': 41,
  // Special Kyle/Wanda versions - these might not have separate IDs
  'level_0_1_sewer_kyle': 1,
  'level_0_1_sewer_wanda': 1,
};

export interface LevelGroup {
  levels: Level[];
}

/**
 * Complete level tree structure matching the original game
 * Each group represents a set of levels that can be played after completing the previous group
 */
export const levelTree: LevelGroup[] = [
  // Group 0: Tutorial - Memory #000
  {
    levels: [
      {
        resource: 'level_0_1_sewer',
        name: 'Memory #000',
        timeStamp: '+ 07:12:03',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: true,
        row: 0,
        index: 0,
      },
    ],
  },
  // Group 1: Memory #001
  {
    levels: [
      {
        resource: 'level_0_2_lab',
        name: 'Memory #001',
        timeStamp: '+ 00:00:00',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 1,
        index: 0,
      },
    ],
  },
  // Group 2: Memory #025
  {
    levels: [
      {
        resource: 'level_3_5_sewer',
        name: 'Memory #025',
        timeStamp: '+ 07:19:59',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 2,
        index: 0,
      },
    ],
  },
  // Group 3: Memory #002
  {
    levels: [
      {
        resource: 'level_0_3_lab',
        name: 'Memory #002',
        timeStamp: '+ 00:06:26',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 3,
        index: 0,
      },
    ],
  },
  // Group 4: Memory #026
  {
    levels: [
      {
        resource: 'level_3_6_sewer',
        name: 'Memory #026',
        timeStamp: '+ 07:36:17',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 4,
        index: 0,
      },
    ],
  },
  // Group 5: Memory #003
  {
    levels: [
      {
        resource: 'level_1_1_island',
        name: 'Memory #003',
        timeStamp: '+ 00:34:10',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 5,
        index: 0,
      },
    ],
  },
  // Group 6: Memory #004, #005
  {
    levels: [
      {
        resource: 'level_1_2_island',
        name: 'Memory #004',
        timeStamp: '+ 00:44:46',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 6,
        index: 0,
      },
      {
        resource: 'level_1_3_island',
        name: 'Memory #005',
        timeStamp: '+ 00:52:16',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 6,
        index: 1,
      },
    ],
  },
  // Group 7: Memory #027
  {
    levels: [
      {
        resource: 'level_3_7_sewer',
        name: 'Memory #027',
        timeStamp: '+ 07:51:24',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 7,
        index: 0,
      },
    ],
  },
  // Group 8: Memory #012
  {
    levels: [
      {
        resource: 'level_2_1_grass',
        name: 'Memory #012',
        timeStamp: '+ 02:25:18',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 8,
        index: 0,
      },
    ],
  },
  // Group 9: Memory #028
  {
    levels: [
      {
        resource: 'level_3_8_sewer',
        name: 'Memory #028',
        timeStamp: '+ 08:16:55',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 9,
        index: 0,
      },
    ],
  },
  // Group 10: Memory #007, #013, #014
  {
    levels: [
      {
        resource: 'level_1_5_island',
        name: 'Memory #007',
        timeStamp: '+ 01:07:24',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 10,
        index: 0,
      },
      {
        resource: 'level_2_2_grass',
        name: 'Memory #013',
        timeStamp: '+ 02:37:20',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 10,
        index: 1,
      },
      {
        resource: 'level_2_3_grass',
        name: 'Memory #014',
        timeStamp: '+ 02:40:13',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 10,
        index: 2,
      },
    ],
  },
  // Group 11: Memory #029
  {
    levels: [
      {
        resource: 'level_3_9_sewer',
        name: 'Memory #029',
        timeStamp: '+ 08:35:12',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 11,
        index: 0,
      },
    ],
  },
  // Group 12: Memory #024
  {
    levels: [
      {
        resource: 'level_3_4_sewer',
        name: 'Memory #024',
        timeStamp: '+ 04:59:06',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 12,
        index: 0,
      },
    ],
  },
  // Group 13: Memory #024.3
  {
    levels: [
      {
        resource: 'level_0_1_sewer_kyle',
        name: 'Memory #024.3',
        timeStamp: '+ 04:59:06',
        inThePast: true,
        completed: false,
        restartable: false,
        showWaitMessage: false,
        row: 13,
        index: 0,
      },
    ],
  },
  // Group 14: Memory #024.7
  {
    levels: [
      {
        resource: 'level_0_1_sewer_wanda',
        name: 'Memory #024.7',
        timeStamp: '+ 07:12:03',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: true,
        row: 14,
        index: 0,
      },
    ],
  },
  // Group 15: Memory #030
  {
    levels: [
      {
        resource: 'level_3_10_sewer',
        name: 'Memory #030',
        timeStamp: '+ 08:50:36',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 15,
        index: 0,
      },
    ],
  },
  // Group 16: Memory #030.5
  {
    levels: [
      {
        resource: 'level_3_11_sewer',
        name: 'Memory #030.5',
        timeStamp: '+ 08:55:54',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 16,
        index: 0,
      },
    ],
  },
  // Group 17: Memory #031
  {
    levels: [
      {
        resource: 'level_4_1_underground',
        name: 'Memory #031',
        timeStamp: '+ 09:10:01',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 17,
        index: 0,
      },
    ],
  },
  // Group 18: Memory #008, #015, #021
  {
    levels: [
      {
        resource: 'level_1_6_island',
        name: 'Memory #008',
        timeStamp: '+ 01:23:38',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 18,
        index: 0,
      },
      {
        resource: 'level_2_4_grass',
        name: 'Memory #015',
        timeStamp: '+ 02:51:09',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 18,
        index: 1,
      },
      {
        resource: 'level_3_1_grass',
        name: 'Memory #021',
        timeStamp: '+ 04:07:10',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 18,
        index: 2,
      },
    ],
  },
  // Group 19: Memory #032
  {
    levels: [
      {
        resource: 'level_4_2_underground',
        name: 'Memory #032',
        timeStamp: '+ 09:42:40',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 19,
        index: 0,
      },
    ],
  },
  // Group 20: Memory #016
  {
    levels: [
      {
        resource: 'level_2_5_grass',
        name: 'Memory #016',
        timeStamp: '+ 03:01:55',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 20,
        index: 0,
      },
    ],
  },
  // Group 21: Memory #033
  {
    levels: [
      {
        resource: 'level_4_3_underground',
        name: 'Memory #033',
        timeStamp: '+ 09:58:11',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 21,
        index: 0,
      },
    ],
  },
  // Group 22: Memory #017, #022
  {
    levels: [
      {
        resource: 'level_2_6_grass',
        name: 'Memory #017',
        timeStamp: '+ 03:16:28',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 22,
        index: 0,
      },
      {
        resource: 'level_3_2_sewer',
        name: 'Memory #022',
        timeStamp: '+ 04:18:42',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 22,
        index: 1,
      },
    ],
  },
  // Group 23: Memory #034
  {
    levels: [
      {
        resource: 'level_4_4_underground',
        name: 'Memory #034',
        timeStamp: '+ 10:27:36',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 23,
        index: 0,
      },
    ],
  },
  // Group 24: Memory #018, #010
  {
    levels: [
      {
        resource: 'level_2_7_grass',
        name: 'Memory #018',
        timeStamp: '+ 03:33:12',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 24,
        index: 0,
      },
      {
        resource: 'level_1_8_island',
        name: 'Memory #010',
        timeStamp: '+ 01:42:00',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 24,
        index: 1,
      },
    ],
  },
  // Group 25: Memory #035
  {
    levels: [
      {
        resource: 'level_4_5_underground',
        name: 'Memory #035',
        timeStamp: '+ 10:52:10',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 25,
        index: 0,
      },
    ],
  },
  // Group 26: Memory #019, #023
  {
    levels: [
      {
        resource: 'level_2_8_grass',
        name: 'Memory #019',
        timeStamp: '+ 03:46:07',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 26,
        index: 0,
      },
      {
        resource: 'level_3_3_sewer',
        name: 'Memory #023',
        timeStamp: '+ 04:45:15',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 26,
        index: 1,
      },
    ],
  },
  // Group 27: Memory #037
  {
    levels: [
      {
        resource: 'level_4_7_underground',
        name: 'Memory #037',
        timeStamp: '+ 11:39:04',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 27,
        index: 0,
      },
    ],
  },
  // Group 28: Memory #038
  {
    levels: [
      {
        resource: 'level_4_8_underground',
        name: 'Memory #038',
        timeStamp: '+ 11:55:00',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 28,
        index: 0,
      },
    ],
  },
  // Group 29: Memory #020, #011
  {
    levels: [
      {
        resource: 'level_2_9_grass',
        name: 'Memory #020',
        timeStamp: '+ 03:54:29',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 29,
        index: 0,
      },
      {
        resource: 'level_1_9_island',
        name: 'Memory #011',
        timeStamp: '+ 01:56:44',
        inThePast: true,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 29,
        index: 1,
      },
    ],
  },
  // Group 30: Memory #039
  {
    levels: [
      {
        resource: 'level_4_9_underground',
        name: 'Memory #039',
        timeStamp: '+ 12:10:00',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 30,
        index: 0,
      },
    ],
  },
  // Group 31: Memory #040 - Final Boss
  {
    levels: [
      {
        resource: 'level_final_boss_lab',
        name: 'Memory #040',
        timeStamp: '+ 12:30:00',
        inThePast: false,
        completed: false,
        restartable: true,
        showWaitMessage: false,
        row: 31,
        index: 0,
      },
    ],
  },
];

/**
 * Represents a flattened level entry with unlock state
 */
export interface LevelMetaData {
  level: Level;
  row: number;
  index: number;
  enabled: boolean;
}

/**
 * Generate the level list for display
 * @param completedLevels Set of completed level resources
 * @param onlyAllowThePast If true, only show past levels plus the next unlocked present level
 */
export function generateLevelList(
  completedLevels: Set<string>,
  onlyAllowThePast: boolean = true
): LevelMetaData[] {
  const result: LevelMetaData[] = [];
  let oneBranchUnlocked = false;

  for (let x = 0; x < levelTree.length; x++) {
    const group = levelTree[x];
    let anyUnlocksThisBranch = false;

    for (let y = 0; y < group.levels.length; y++) {
      const level = { ...group.levels[y] };
      level.completed = completedLevels.has(level.resource);

      let enabled = false;
      if (!level.completed && !oneBranchUnlocked) {
        enabled = true;
        anyUnlocksThisBranch = true;
      }

      // Add level if it's enabled, completed, or passes the filter
      if (
        enabled ||
        level.completed ||
        !onlyAllowThePast ||
        (onlyAllowThePast && level.inThePast)
      ) {
        result.push({
          level,
          row: x,
          index: y,
          enabled,
        });
      }
    }

    if (anyUnlocksThisBranch) {
      oneBranchUnlocked = true;
    }
  }

  return result;
}

/**
 * Sort level list by timestamp (chronological order)
 */
export function sortLevelsByTime(levels: LevelMetaData[]): LevelMetaData[] {
  return [...levels].sort((a, b) => {
    return a.level.timeStamp.localeCompare(b.level.timeStamp);
  });
}

/**
 * Get a specific level by row and index
 */
export function getLevel(row: number, index: number): Level | null {
  if (row >= 0 && row < levelTree.length) {
    const group = levelTree[row];
    if (index >= 0 && index < group.levels.length) {
      return group.levels[index];
    }
  }
  return null;
}

/**
 * Check if a level exists
 */
export function levelIsValid(row: number, index: number): boolean {
  return getLevel(row, index) !== null;
}
