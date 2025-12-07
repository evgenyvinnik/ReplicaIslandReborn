/**
 * Dialog definitions for Replica Island Reborn
 * Ported from: Original/res/xml/level_*_dialog_*.xml
 */

import { getString, CharacterNames } from './strings';
import { assetPath } from '../utils/helpers';

// Character types
export type Character = 'Wanda' | 'Kyle' | 'Kabocha' | 'Rokudou';

// Dialog page definition
export interface DialogPage {
  character: Character;
  portrait: string;
  text: string;
}

// Conversation is a sequence of pages
export interface Conversation {
  pages: DialogPage[];
}

// Dialog is a sequence of conversations
export interface Dialog {
  conversations: Conversation[];
}

// Portrait image mappings - using dedicated closeup images from original
export const CharacterPortraits: Record<string, string> = {
  // Wanda portraits (original wanda_*.png files)
  'wanda_surprised': '/assets/sprites/wanda_surprised.png',
  'wanda_sad': '/assets/sprites/wanda_sad.png',
  'wanda_smile': '/assets/sprites/wanda_smile.png',
  'wanda_happy': '/assets/sprites/wanda_happy.png',
  // Kyle portraits (original kyle_closeup_*.png files)
  'kyle_closeup_neutral': '/assets/sprites/kyle_closeup_neutral.png',
  'kyle_closeup_angry': '/assets/sprites/kyle_closeup_angry.png',
  'kyle_closeup_noglasses': '/assets/sprites/kyle_closeup_noglasses.png',
  // Kabocha portraits (original kabocha_closeup_*.png files)
  'kabocha_closeup_normal': '/assets/sprites/kabocha_closeup_normal.png',
  'kabocha_closeup_concern': '/assets/sprites/kabocha_closeup_concern.png',
  'kabocha_closeup_lunatic': '/assets/sprites/kabocha_closeup_lunatic.png',
  'kabocha_closeup_lunatic_02': '/assets/sprites/kabocha_closeup_lunatic_02.png',
  // Rokudou portraits (original rokudou_closeup_*.png files)
  'rokudou_closeup_normal': '/assets/sprites/rokudou_closeup_normal.png',
  'rokudou_closeup_mask': '/assets/sprites/rokudou_closeup_mask.png',
};

// Get portrait image path for a character with optional specific portrait key
function getPortrait(character: Character, portraitKey?: string): string {
  // If a specific portrait key is provided, use it
  if (portraitKey && CharacterPortraits[portraitKey]) {
    return assetPath(CharacterPortraits[portraitKey]);
  }
  
  // Default portraits per character
  const defaultPortraits: Record<Character, string> = {
    Wanda: 'wanda_smile',
    Kyle: 'kyle_closeup_neutral',
    Kabocha: 'kabocha_closeup_normal',
    Rokudou: 'rokudou_closeup_normal',
  };
  
  const defaultKey = defaultPortraits[character];
  return assetPath(CharacterPortraits[defaultKey] || '/assets/sprites/enemy_wanda_stand.png');
}

// Helper to create a dialog page
// portraitKey should match keys in CharacterPortraits (e.g., 'wanda_surprised', 'kyle_closeup_angry')
function page(character: Character, textKey: string, portraitKey?: string): DialogPage {
  return {
    character,
    portrait: getPortrait(character, portraitKey),
    text: getString(textKey),
  };
}

// Level dialogs - organized by level
export const LevelDialogs: Record<string, Dialog> = {
  // Tutorial Level 0-1: Wanda
  'level_0_1_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_0_1_1_1', 'wanda_surprised'),
        ],
      },
      {
        pages: [
          page('Wanda', 'Wanda_0_1_1_2', 'wanda_sad'),
          page('Wanda', 'Wanda_0_1_1_3', 'wanda_smile'),
        ],
      },
    ],
  },

  // Tutorial Level 0-2: Kabocha
  'level_0_2_dialog_kabocha': {
    conversations: [
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_1_1', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_2_1_2', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_2_1_3', 'kabocha_closeup_normal'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_2_1', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_2_2_2', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_2_2_3', 'kabocha_closeup_normal'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_3_1', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_2_3_2', 'kabocha_closeup_normal'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_4_1', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_2_4_2', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_2_4_3', 'kabocha_closeup_normal'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_5_1', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_2_5_2', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_2_5_3', 'kabocha_closeup_normal'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_6_1', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_2_6_2', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_2_6_3', 'kabocha_closeup_normal'),
        ],
      },
    ],
  },

  // Tutorial Level 0-3: Kabocha
  'level_0_3_dialog_kabocha': {
    conversations: [
      {
        pages: [
          page('Kabocha', 'Kabocha_0_3_1_1', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_3_1_2', 'kabocha_closeup_normal'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_3_2_1', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_3_2_2', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_3_2_3', 'kabocha_closeup_normal'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_3_3_1', 'kabocha_closeup_normal'),
          page('Kabocha', 'Kabocha_0_3_3_2', 'kabocha_closeup_normal'),
        ],
      },
    ],
  },

  // World 1 Level 1: Wanda
  'level_1_1_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_1_1_1_1', 'wanda_surprised'),
          page('Wanda', 'Wanda_1_1_1_2', 'wanda_smile'),
          page('Wanda', 'Wanda_1_1_1_3', 'wanda_smile'),
        ],
      },
    ],
  },

  // World 1 Level 5: Wanda
  'level_1_5_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_1_5_1_1', 'wanda_smile'),
          page('Wanda', 'Wanda_1_5_1_2', 'wanda_smile'),
          page('Wanda', 'Wanda_1_5_1_3', 'wanda_smile'),
          page('Wanda', 'Wanda_1_5_1_4', 'wanda_happy'),
        ],
      },
    ],
  },

  // World 1 Level 6: Wanda
  'level_1_6_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_1_6_1_1', 'wanda_happy'),
          page('Wanda', 'Wanda_1_6_1_2', 'wanda_happy'),
        ],
      },
    ],
  },

  // World 1 Level 9: Wanda
  'level_1_9_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_1_9_1_1', 'wanda_surprised'),
        ],
      },
    ],
  },

  // World 2 Level 1: Kyle
  'level_2_1_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_1_1_1', 'kyle_closeup_neutral'),
          page('Kyle', 'Kyle_2_1_1_2', 'kyle_closeup_neutral'),
          page('Kyle', 'Kyle_2_1_1_3', 'kyle_closeup_neutral'),
        ],
      },
    ],
  },

  // World 2 Level 3: Kyle
  'level_2_3_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_3_1_1', 'kyle_closeup_angry'),
          page('Kyle', 'Kyle_2_3_1_2', 'kyle_closeup_neutral'),
          page('Kyle', 'Kyle_2_3_1_3', 'kyle_closeup_neutral'),
        ],
      },
    ],
  },

  // World 2 Level 4: Kyle
  'level_2_4_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_4_1_1', 'kyle_closeup_neutral'),
          page('Kyle', 'Kyle_2_4_1_2', 'kyle_closeup_neutral'),
        ],
      },
    ],
  },

  // World 2 Level 5: Kyle
  'level_2_5_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_5_1_1', 'kyle_closeup_noglasses'),
          page('Kyle', 'Kyle_2_5_1_2', 'kyle_closeup_noglasses'),
        ],
      },
    ],
  },

  // World 2 Level 6: Wanda
  'level_2_6_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_2_6_1_1', 'wanda_smile'),
        ],
      },
      {
        pages: [
          page('Wanda', 'Wanda_2_6_2_1', 'wanda_smile'),
          page('Wanda', 'Wanda_2_6_2_2', 'wanda_smile'),
          page('Wanda', 'Wanda_2_6_2_3', 'wanda_smile'),
        ],
      },
    ],
  },

  // World 2 Level 7: Kyle
  'level_2_7_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_7_1_1', 'kyle_closeup_neutral'),
          page('Kyle', 'Kyle_2_7_1_2', 'kyle_closeup_neutral'),
          page('Kyle', 'Kyle_2_7_1_3', 'kyle_closeup_neutral'),
        ],
      },
    ],
  },

  // World 2 Level 8: Kyle
  'level_2_8_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_8_1_1', 'kyle_closeup_noglasses'),
        ],
      },
    ],
  },

  // World 2 Level 9: Kyle and Wanda
  'level_2_9_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_2_9_1_1', 'wanda_smile'),
          page('Wanda', 'Wanda_2_9_1_2', 'wanda_happy'),
        ],
      },
    ],
  },

  // World 3 Level 3: Wanda
  'level_3_3_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_3_3_1_1', 'wanda_happy'),
          page('Wanda', 'Wanda_3_3_1_2', 'wanda_smile'),
          page('Wanda', 'Wanda_3_3_1_3', 'wanda_smile'),
        ],
      },
    ],
  },

  // World 3 Level 4: Kyle
  'level_3_4_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_3_4_1_1', 'kyle_closeup_angry'),
          page('Kyle', 'Kyle_3_4_1_2', 'kyle_closeup_angry'),
        ],
      },
    ],
  },

  // World 3 Level 5: Wanda (present time starts here)
  'level_3_5_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_3_5_1_1', 'wanda_smile'),
          page('Wanda', 'Wanda_3_5_1_2', 'wanda_smile'),
          page('Wanda', 'Wanda_3_5_1_3', 'wanda_smile'),
        ],
      },
    ],
  },

  // World 3 Level 7: Wanda
  'level_3_7_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_3_7_1_1', 'wanda_smile'),
          page('Wanda', 'Wanda_3_7_1_2', 'wanda_smile'),
          page('Wanda', 'Wanda_3_7_1_3', 'wanda_smile'),
        ],
      },
    ],
  },

  // World 3 Level 8: Kyle
  'level_3_8_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_3_8_1_1', 'kyle_closeup_neutral'),
          page('Kyle', 'Kyle_3_8_1_2', 'kyle_closeup_neutral'),
          page('Kyle', 'Kyle_3_8_1_3', 'kyle_closeup_neutral'),
        ],
      },
      {
        pages: [
          page('Kyle', 'Kyle_3_8_2_1', 'kyle_closeup_neutral'),
        ],
      },
    ],
  },

  // World 3 Level 9: Kyle and Rokudou
  'level_3_9_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_3_9_1_1', 'kyle_closeup_neutral'),
          page('Kyle', 'Kyle_3_9_1_2', 'kyle_closeup_angry'),
        ],
      },
    ],
  },

  'level_3_9_dialog_rokudou': {
    conversations: [
      {
        pages: [
          page('Rokudou', 'Rokudou_3_9_1_1', 'rokudou_closeup_normal'),
          page('Rokudou', 'Rokudou_3_9_1_2', 'rokudou_closeup_normal'),
          page('Rokudou', 'Rokudou_3_9_1_3', 'rokudou_closeup_normal'),
          page('Rokudou', 'Rokudou_3_9_1_4', 'rokudou_closeup_normal'),
          page('Rokudou', 'Rokudou_3_9_1_5', 'rokudou_closeup_normal'),
        ],
      },
    ],
  },

  // World 3 Level 10: Kyle
  'level_3_10_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_3_10_1_1', 'kyle_closeup_angry'),
        ],
      },
    ],
  },

  // World 3 Level 11: Wanda (Kyle fight)
  'level_3_11_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_3_11_1_1', 'wanda_surprised'),
        ],
      },
      {
        pages: [
          page('Wanda', 'Wanda_3_11_2_1', 'wanda_surprised'),
        ],
      },
    ],
  },

  // World 4 Level 1: Wanda and Rokudou
  'level_4_1_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_4_1_1_1', 'wanda_sad'),
        ],
      },
    ],
  },

  'level_4_1_dialog_rokudou': {
    conversations: [
      {
        pages: [
          page('Rokudou', 'Rokudou_4_1_1_1', 'rokudou_closeup_normal'),
          page('Rokudou', 'Rokudou_4_1_1_2', 'rokudou_closeup_normal'),
          page('Rokudou', 'Rokudou_4_1_1_3', 'rokudou_closeup_normal'),
        ],
      },
    ],
  },

  // World 4 Level 2: Wanda
  'level_4_2_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_4_2_1_1', 'wanda_sad'),
          page('Wanda', 'Wanda_4_2_1_2', 'wanda_sad'),
        ],
      },
    ],
  },

  // World 4 Level 3: Kabocha (reveals true intentions)
  'level_4_3_dialog_kabocha': {
    conversations: [
      {
        pages: [
          page('Kabocha', 'Kabocha_4_3_1_1', 'kabocha_closeup_concern'),
          page('Kabocha', 'Kabocha_4_3_1_2', 'kabocha_closeup_lunatic'),
          page('Kabocha', 'Kabocha_4_3_1_3', 'kabocha_closeup_lunatic_02'),
          page('Kabocha', 'Kabocha_4_3_1_4', 'kabocha_closeup_concern'),
        ],
      },
    ],
  },

  // World 4 Level 4: Rokudou
  'level_4_4_dialog_rokudou': {
    conversations: [
      {
        pages: [
          page('Rokudou', 'Rokudou_4_4_1_1', 'rokudou_closeup_normal'),
        ],
      },
    ],
  },

  // World 4 Level 5: Wanda
  'level_4_5_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_4_5_1_1', 'wanda_sad'),
          page('Wanda', 'Wanda_4_5_1_2', 'wanda_sad'),
          page('Wanda', 'Wanda_4_5_1_3', 'wanda_sad'),
        ],
      },
    ],
  },

  // World 4 Level 7: Wanda and Rokudou
  'level_4_7_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_4_7_1_1', 'wanda_sad'),
          page('Wanda', 'Wanda_4_7_1_2', 'wanda_sad'),
          page('Wanda', 'Wanda_4_7_1_3', 'wanda_sad'),
          page('Wanda', 'Wanda_4_7_1_4', 'wanda_sad'),
        ],
      },
    ],
  },

  'level_4_7_dialog_rokudou': {
    conversations: [
      {
        pages: [
          page('Rokudou', 'Rokudou_4_7_1_1', 'rokudou_closeup_normal'),
          page('Rokudou', 'Rokudou_4_7_1_2', 'rokudou_closeup_normal'),
        ],
      },
    ],
  },

  // World 4 Level 9: Wanda
  'level_4_9_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_4_9_1_1', 'wanda_sad'),
          page('Wanda', 'Wanda_4_9_1_2', 'wanda_sad'),
          page('Wanda', 'Wanda_4_9_1_3', 'wanda_sad'),
        ],
      },
    ],
  },

  // Final Boss: Rokudou and Kabocha
  'level_final_boss_dialog': {
    conversations: [
      {
        pages: [
          page('Rokudou', 'Rokudou_final_boss_1_1', 'rokudou_closeup_mask'),
          page('Rokudou', 'Rokudou_final_boss_1_2', 'rokudou_closeup_mask'),
          page('Kabocha', 'Kabocha_final_boss_1_1', 'kabocha_closeup_lunatic'),
          page('Kabocha', 'Kabocha_final_boss_1_2', 'kabocha_closeup_concern'),
          page('Kabocha', 'Kabocha_final_boss_1_3', 'kabocha_closeup_lunatic_02'),
          page('Rokudou', 'Rokudou_final_boss_1_3', 'rokudou_closeup_mask'),
        ],
      },
    ],
  },
};

// Get dialog for a level
export function getDialog(dialogId: string): Dialog | null {
  return LevelDialogs[dialogId] || null;
}

// Get character display name
export function getCharacterName(character: Character): string {
  return CharacterNames[character] || character;
}

// Get all dialogs for a level (may have multiple characters)
export function getDialogsForLevel(levelId: string): Dialog[] {
  const dialogs: Dialog[] = [];
  // Extract the level prefix like "level_0_1" from "level_0_1_sewer.bin" or "level_0_1_sewer"
  const cleanId = levelId.replace('.bin', '');
  // Match pattern: level_X_Y_type -> level_X_Y
  const match = cleanId.match(/^(level_\d+_\d+)/);
  if (!match) return dialogs;
  
  const prefix = match[1];
  
  // Find all dialogs that start with this level prefix
  for (const key of Object.keys(LevelDialogs)) {
    // Dialog keys are like "level_0_1_dialog_wanda"
    if (key.startsWith(prefix + '_dialog')) {
      dialogs.push(LevelDialogs[key]);
    }
  }
  
  return dialogs;
}
