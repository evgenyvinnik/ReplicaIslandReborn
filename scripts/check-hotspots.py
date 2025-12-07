#!/usr/bin/env python3
import json
import sys

level_file = sys.argv[1] if len(sys.argv) > 1 else 'public/assets/levels/level_0_1_sewer.json'

with open(level_file) as f:
    d = json.load(f)

hot_spot_names = {
    0: 'NONE',
    1: 'GO_RIGHT', 2: 'GO_LEFT', 3: 'GO_UP', 4: 'GO_DOWN', 
    5: 'GO_UP_RIGHT', 6: 'GO_UP_LEFT', 7: 'GO_DOWN_RIGHT', 8: 'GO_DOWN_LEFT',
    9: 'WAIT_SHORT', 10: 'WAIT_MEDIUM', 11: 'WAIT_LONG',
    12: 'ATTACK', 13: 'TALK', 14: 'WALK_AND_TALK',
    15: 'TAKE_CAMERA_FOCUS', 16: 'RELEASE_CAMERA_FOCUS',
    17: 'END_LEVEL', 18: 'GAME_EVENT',
    -2: 'DEATH', -3: 'COLLECT',
}

for layer in d['layers']:
    if layer['type'] == 'hot_spots':
        print(f'Hot spots in {level_file}:')
        count = 0
        for row_idx, row in enumerate(layer['world']['tiles']):
            for col_idx, val in enumerate(row):
                if val != -1 and val != 0:
                    name = hot_spot_names.get(val, f'TYPE_{val}')
                    pixel_x = col_idx * 32
                    pixel_y = row_idx * 32
                    print(f'  [{row_idx}][{col_idx}] = {val} ({name}) -> pixel ({pixel_x}, {pixel_y})')
                    count += 1
        print(f'Total: {count} hot spots')
