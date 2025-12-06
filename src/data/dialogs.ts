/**
 * Dialog definitions for Replica Island Reborn
 * Ported from: Original/res/xml/level_*_dialog_*.xml
 */

import { getString, CharacterNames } from './strings';

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

// Portrait image mappings
export const CharacterPortraits: Record<string, string> = {
  // Wanda portraits
  'wanda_surprised': '/assets/sprites/enemy_wanda_stand.png',
  'wanda_sad': '/assets/sprites/enemy_wanda_stand.png',
  'wanda_smile': '/assets/sprites/enemy_wanda_stand.png',
  'wanda_stand': '/assets/sprites/enemy_wanda_stand.png',
  // Kyle portraits
  'kyle_stand': '/assets/sprites/enemy_kyle_stand.png',
  'kyle_angry': '/assets/sprites/enemy_kyle_stand.png',
  // Kabocha portraits
  'kabocha_stand': '/assets/sprites/enemy_kabocha_stand.png',
  'kabocha_smile': '/assets/sprites/enemy_kabocha_stand.png',
  'kabocha_evil_stand': '/assets/sprites/enemy_kabocha_evil_stand.png',
  // Rokudou portraits  
  'rokudou_stand': '/assets/sprites/enemy_rokudou_fight_stand.png',
};

// Get portrait image path
function getPortrait(character: Character, _emotion?: string): string {
  const key = `${character.toLowerCase()}_stand`;
  return CharacterPortraits[key] || CharacterPortraits[`${character.toLowerCase()}_stand`];
}

// Helper to create a dialog page
function page(character: Character, textKey: string, portrait?: string): DialogPage {
  return {
    character,
    portrait: portrait || getPortrait(character),
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
          page('Wanda', 'Wanda_0_1_1_1'),
        ],
      },
      {
        pages: [
          page('Wanda', 'Wanda_0_1_1_2'),
          page('Wanda', 'Wanda_0_1_1_3'),
        ],
      },
    ],
  },

  // Tutorial Level 0-2: Kabocha
  'level_0_2_dialog_kabocha': {
    conversations: [
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_1_1'),
          page('Kabocha', 'Kabocha_0_2_1_2'),
          page('Kabocha', 'Kabocha_0_2_1_3'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_2_1'),
          page('Kabocha', 'Kabocha_0_2_2_2'),
          page('Kabocha', 'Kabocha_0_2_2_3'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_3_1'),
          page('Kabocha', 'Kabocha_0_2_3_2'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_4_1'),
          page('Kabocha', 'Kabocha_0_2_4_2'),
          page('Kabocha', 'Kabocha_0_2_4_3'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_5_1'),
          page('Kabocha', 'Kabocha_0_2_5_2'),
          page('Kabocha', 'Kabocha_0_2_5_3'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_2_6_1'),
          page('Kabocha', 'Kabocha_0_2_6_2'),
          page('Kabocha', 'Kabocha_0_2_6_3'),
        ],
      },
    ],
  },

  // Tutorial Level 0-3: Kabocha
  'level_0_3_dialog_kabocha': {
    conversations: [
      {
        pages: [
          page('Kabocha', 'Kabocha_0_3_1_1'),
          page('Kabocha', 'Kabocha_0_3_1_2'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_3_2_1'),
          page('Kabocha', 'Kabocha_0_3_2_2'),
          page('Kabocha', 'Kabocha_0_3_2_3'),
        ],
      },
      {
        pages: [
          page('Kabocha', 'Kabocha_0_3_3_1'),
          page('Kabocha', 'Kabocha_0_3_3_2'),
        ],
      },
    ],
  },

  // World 1 Level 1: Wanda
  'level_1_1_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_1_1_1_1'),
          page('Wanda', 'Wanda_1_1_1_2'),
          page('Wanda', 'Wanda_1_1_1_3'),
        ],
      },
    ],
  },

  // World 1 Level 5: Wanda
  'level_1_5_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_1_5_1_1'),
          page('Wanda', 'Wanda_1_5_1_2'),
          page('Wanda', 'Wanda_1_5_1_3'),
          page('Wanda', 'Wanda_1_5_1_4'),
        ],
      },
    ],
  },

  // World 1 Level 6: Wanda
  'level_1_6_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_1_6_1_1'),
          page('Wanda', 'Wanda_1_6_1_2'),
        ],
      },
    ],
  },

  // World 1 Level 9: Wanda
  'level_1_9_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_1_9_1_1'),
        ],
      },
    ],
  },

  // World 2 Level 1: Kyle
  'level_2_1_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_1_1_1'),
          page('Kyle', 'Kyle_2_1_1_2'),
          page('Kyle', 'Kyle_2_1_1_3'),
        ],
      },
    ],
  },

  // World 2 Level 3: Kyle
  'level_2_3_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_3_1_1'),
          page('Kyle', 'Kyle_2_3_1_2'),
          page('Kyle', 'Kyle_2_3_1_3'),
        ],
      },
    ],
  },

  // World 2 Level 4: Kyle
  'level_2_4_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_4_1_1'),
          page('Kyle', 'Kyle_2_4_1_2'),
        ],
      },
    ],
  },

  // World 2 Level 5: Kyle
  'level_2_5_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_5_1_1'),
          page('Kyle', 'Kyle_2_5_1_2'),
        ],
      },
    ],
  },

  // World 2 Level 6: Wanda
  'level_2_6_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_2_6_1_1'),
        ],
      },
      {
        pages: [
          page('Wanda', 'Wanda_2_6_2_1'),
          page('Wanda', 'Wanda_2_6_2_2'),
          page('Wanda', 'Wanda_2_6_2_3'),
        ],
      },
    ],
  },

  // World 2 Level 7: Kyle
  'level_2_7_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_7_1_1'),
          page('Kyle', 'Kyle_2_7_1_2'),
          page('Kyle', 'Kyle_2_7_1_3'),
        ],
      },
    ],
  },

  // World 2 Level 8: Kyle
  'level_2_8_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_2_8_1_1'),
        ],
      },
    ],
  },

  // World 2 Level 9: Kyle and Wanda
  'level_2_9_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_2_9_1_1'),
          page('Wanda', 'Wanda_2_9_1_2'),
        ],
      },
    ],
  },

  // World 3 Level 3: Wanda
  'level_3_3_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_3_3_1_1'),
          page('Wanda', 'Wanda_3_3_1_2'),
          page('Wanda', 'Wanda_3_3_1_3'),
        ],
      },
    ],
  },

  // World 3 Level 4: Kyle
  'level_3_4_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_3_4_1_1'),
          page('Kyle', 'Kyle_3_4_1_2'),
        ],
      },
    ],
  },

  // World 3 Level 5: Wanda (present time starts here)
  'level_3_5_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_3_5_1_1'),
          page('Wanda', 'Wanda_3_5_1_2'),
          page('Wanda', 'Wanda_3_5_1_3'),
        ],
      },
    ],
  },

  // World 3 Level 7: Wanda
  'level_3_7_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_3_7_1_1'),
          page('Wanda', 'Wanda_3_7_1_2'),
          page('Wanda', 'Wanda_3_7_1_3'),
        ],
      },
    ],
  },

  // World 3 Level 8: Kyle
  'level_3_8_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_3_8_1_1'),
          page('Kyle', 'Kyle_3_8_1_2'),
          page('Kyle', 'Kyle_3_8_1_3'),
        ],
      },
      {
        pages: [
          page('Kyle', 'Kyle_3_8_2_1'),
        ],
      },
    ],
  },

  // World 3 Level 9: Kyle and Rokudou
  'level_3_9_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_3_9_1_1'),
          page('Kyle', 'Kyle_3_9_1_2'),
        ],
      },
    ],
  },

  'level_3_9_dialog_rokudou': {
    conversations: [
      {
        pages: [
          page('Rokudou', 'Rokudou_3_9_1_1'),
          page('Rokudou', 'Rokudou_3_9_1_2'),
          page('Rokudou', 'Rokudou_3_9_1_3'),
          page('Rokudou', 'Rokudou_3_9_1_4'),
          page('Rokudou', 'Rokudou_3_9_1_5'),
        ],
      },
    ],
  },

  // World 3 Level 10: Kyle
  'level_3_10_dialog_kyle': {
    conversations: [
      {
        pages: [
          page('Kyle', 'Kyle_3_10_1_1'),
        ],
      },
    ],
  },

  // World 3 Level 11: Wanda (Kyle fight)
  'level_3_11_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_3_11_1_1'),
        ],
      },
      {
        pages: [
          page('Wanda', 'Wanda_3_11_2_1'),
        ],
      },
    ],
  },

  // World 4 Level 1: Wanda and Rokudou
  'level_4_1_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_4_1_1_1'),
        ],
      },
    ],
  },

  'level_4_1_dialog_rokudou': {
    conversations: [
      {
        pages: [
          page('Rokudou', 'Rokudou_4_1_1_1'),
          page('Rokudou', 'Rokudou_4_1_1_2'),
          page('Rokudou', 'Rokudou_4_1_1_3'),
        ],
      },
    ],
  },

  // World 4 Level 2: Wanda
  'level_4_2_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_4_2_1_1'),
          page('Wanda', 'Wanda_4_2_1_2'),
        ],
      },
    ],
  },

  // World 4 Level 4: Rokudou
  'level_4_4_dialog_rokudou': {
    conversations: [
      {
        pages: [
          page('Rokudou', 'Rokudou_4_4_1_1'),
        ],
      },
    ],
  },

  // World 4 Level 5: Wanda
  'level_4_5_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_4_5_1_1'),
          page('Wanda', 'Wanda_4_5_1_2'),
          page('Wanda', 'Wanda_4_5_1_3'),
        ],
      },
    ],
  },

  // World 4 Level 7: Wanda and Rokudou
  'level_4_7_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_4_7_1_1'),
          page('Wanda', 'Wanda_4_7_1_2'),
          page('Wanda', 'Wanda_4_7_1_3'),
          page('Wanda', 'Wanda_4_7_1_4'),
        ],
      },
    ],
  },

  'level_4_7_dialog_rokudou': {
    conversations: [
      {
        pages: [
          page('Rokudou', 'Rokudou_4_7_1_1'),
          page('Rokudou', 'Rokudou_4_7_1_2'),
        ],
      },
    ],
  },

  // World 4 Level 9: Wanda
  'level_4_9_dialog_wanda': {
    conversations: [
      {
        pages: [
          page('Wanda', 'Wanda_4_9_1_1'),
          page('Wanda', 'Wanda_4_9_1_2'),
          page('Wanda', 'Wanda_4_9_1_3'),
        ],
      },
    ],
  },

  // Final Boss: Rokudou
  'level_final_boss_dialog': {
    conversations: [
      {
        pages: [
          page('Rokudou', 'Rokudou_final_boss_1_1'),
          page('Rokudou', 'Rokudou_final_boss_1_2'),
          page('Rokudou', 'Rokudou_final_boss_1_3'),
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
  const prefix = levelId.replace('.bin', '').replace('level_', 'level_');
  
  for (const key of Object.keys(LevelDialogs)) {
    if (key.startsWith(prefix.replace(/_(island|grass|sewer|underground|lab)$/, ''))) {
      dialogs.push(LevelDialogs[key]);
    }
  }
  
  return dialogs;
}
