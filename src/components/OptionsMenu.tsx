/**
 * Options Menu Component
 * Settings and preferences screen for Replica Island Reborn
 * Ported from: Original/res/xml/preferences.xml, SetPreferencesActivity.java
 */

import React, { useState, useEffect } from 'react';
import { gameSettings, type GameSettings } from '../utils/GameSettings';
import { UIStrings } from '../data/strings';

interface OptionsMenuProps {
  onClose: () => void;
}

type SettingsTab = 'sound' | 'controls' | 'game' | 'data';

export function OptionsMenu({ onClose }: OptionsMenuProps): React.JSX.Element {
  const [settings, setSettings] = useState<GameSettings>(gameSettings.getAll());
  const [activeTab, setActiveTab] = useState<SettingsTab>('sound');
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [keyBindingMode, setKeyBindingMode] = useState<keyof GameSettings['keyBindings'] | null>(null);

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = gameSettings.subscribe(setSettings);
    return unsubscribe;
  }, []);

  // Handle key binding capture
  useEffect(() => {
    if (!keyBindingMode) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.key === 'Escape') {
        setKeyBindingMode(null);
        return;
      }

      // Set the new key binding
      gameSettings.setKeyBinding(keyBindingMode, [e.code]);
      setKeyBindingMode(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [keyBindingMode]);

  // Update a setting
  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]): void => {
    gameSettings.set(key, value);
  };

  // Handle save data erase
  const handleEraseSaveData = (): void => {
    // Clear game progress from localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('replica_island_save');
        window.localStorage.removeItem('replica_island_progress');
      }
    } catch {
      // Ignore errors
    }
    setShowEraseConfirm(false);
  };

  // Tab button component
  const TabButton = ({ tab, label }: { tab: SettingsTab; label: string }): React.JSX.Element => (
    <button
      onClick={(): void => setActiveTab(tab)}
      style={{
        flex: 1,
        padding: '8px 4px',
        backgroundColor: activeTab === tab ? '#446688' : 'rgba(0, 0, 0, 0.3)',
        border: 'none',
        borderBottom: activeTab === tab ? '2px solid #88aacc' : '2px solid transparent',
        color: activeTab === tab ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
        fontSize: '11px',
        fontFamily: 'monospace',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  );

  // Toggle setting component
  const ToggleSetting = ({
    label,
    description,
    value,
    onChange,
  }: {
    label: string;
    description?: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }): React.JSX.Element => (
    <div style={{ marginBottom: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
          {label}
        </span>
        <button
          onClick={(): void => onChange(!value)}
          style={{
            width: '48px',
            height: '24px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: value ? '#4488aa' : '#444444',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '10px',
              backgroundColor: '#ffffff',
              position: 'absolute',
              top: '2px',
              left: value ? '26px' : '2px',
              transition: 'left 0.2s',
            }}
          />
        </button>
      </div>
      {description && (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '10px',
            fontFamily: 'monospace',
            marginTop: '4px',
          }}
        >
          {description}
        </div>
      )}
    </div>
  );

  // Slider setting component
  const SliderSetting = ({
    label,
    description,
    value,
    min = 0,
    max = 100,
    onChange,
  }: {
    label: string;
    description?: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (v: number) => void;
  }): React.JSX.Element => (
    <div style={{ marginBottom: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <span style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
          {label}
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '11px', fontFamily: 'monospace' }}>
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e): void => onChange(parseInt(e.target.value, 10))}
        style={{
          width: '100%',
          height: '8px',
          WebkitAppearance: 'none',
          appearance: 'none',
          backgroundColor: '#333',
          borderRadius: '4px',
          outline: 'none',
          cursor: 'pointer',
        }}
      />
      {description && (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '10px',
            fontFamily: 'monospace',
            marginTop: '4px',
          }}
        >
          {description}
        </div>
      )}
    </div>
  );

  // Key binding setting component
  const KeyBindingSetting = ({
    label,
    action,
  }: {
    label: string;
    action: keyof GameSettings['keyBindings'];
  }): React.JSX.Element => {
    const isBinding = keyBindingMode === action;
    const currentKey = settings.keyBindings[action][0] || 'None';
    const displayKey = currentKey.replace('Key', '').replace('Arrow', '');

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <span style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
          {label}
        </span>
        <button
          onClick={(): void => setKeyBindingMode(isBinding ? null : action)}
          style={{
            padding: '4px 12px',
            backgroundColor: isBinding ? '#884444' : 'rgba(0, 0, 0, 0.3)',
            border: `1px solid ${isBinding ? '#aa6666' : '#446688'}`,
            borderRadius: '4px',
            color: '#ffffff',
            fontSize: '11px',
            fontFamily: 'monospace',
            cursor: 'pointer',
            minWidth: '80px',
          }}
        >
          {isBinding ? 'Press key...' : displayKey}
        </button>
      </div>
    );
  };

  // Difficulty option component
  const DifficultyOption = ({
    difficulty,
    label,
    description,
  }: {
    difficulty: GameSettings['difficulty'];
    label: string;
    description: string;
  }): React.JSX.Element => (
    <button
      onClick={(): void => updateSetting('difficulty', difficulty)}
      style={{
        display: 'block',
        width: '100%',
        padding: '8px 12px',
        marginBottom: '8px',
        backgroundColor:
          settings.difficulty === difficulty ? 'rgba(68, 136, 170, 0.5)' : 'rgba(0, 0, 0, 0.3)',
        border: `1px solid ${settings.difficulty === difficulty ? '#88aacc' : '#446688'}`,
        borderRadius: '4px',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
        {label}
      </div>
      <div
        style={{
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '10px',
          fontFamily: 'monospace',
          marginTop: '2px',
        }}
      >
        {description}
      </div>
    </button>
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #446688',
        }}
      >
        <h2
          style={{
            margin: 0,
            color: '#88aacc',
            fontSize: '16px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
          }}
        >
          OPTIONS
        </h2>
        <button
          onClick={onClose}
          style={{
            padding: '4px 12px',
            backgroundColor: 'transparent',
            border: '1px solid #446688',
            borderRadius: '4px',
            color: '#88aacc',
            fontSize: '12px',
            fontFamily: 'monospace',
            cursor: 'pointer',
          }}
        >
          CLOSE
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #446688' }}>
        <TabButton tab="sound" label="SOUND" />
        <TabButton tab="controls" label="CONTROLS" />
        <TabButton tab="game" label="GAME" />
        <TabButton tab="data" label="DATA" />
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
        }}
      >
        {/* Sound Tab */}
        {activeTab === 'sound' && (
          <>
            <ToggleSetting
              label={UIStrings.preference_enable_sound}
              description={UIStrings.preference_enable_sound_summary}
              value={settings.soundEnabled}
              onChange={(v): void => updateSetting('soundEnabled', v)}
            />
            <SliderSetting
              label="Sound Volume"
              value={settings.soundVolume}
              onChange={(v): void => updateSetting('soundVolume', v)}
            />
          </>
        )}

        {/* Controls Tab */}
        {activeTab === 'controls' && (
          <>
            <ToggleSetting
              label={UIStrings.preference_enable_click_attack}
              description={UIStrings.preference_enable_click_attack_summary}
              value={settings.clickAttackEnabled}
              onChange={(v): void => updateSetting('clickAttackEnabled', v)}
            />
            <ToggleSetting
              label={UIStrings.preference_enable_screen_controls}
              description={UIStrings.preference_enable_screen_controls_summary}
              value={settings.onScreenControlsEnabled}
              onChange={(v): void => updateSetting('onScreenControlsEnabled', v)}
            />
            <SliderSetting
              label={UIStrings.preference_movement_sensitivity}
              description={UIStrings.preference_movement_sensitivity_summary}
              value={settings.movementSensitivity}
              onChange={(v): void => updateSetting('movementSensitivity', v)}
            />
            
            <div
              style={{
                marginTop: '16px',
                marginBottom: '8px',
                color: '#88aacc',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              KEYBOARD BINDINGS
            </div>
            <KeyBindingSetting label="Move Left" action="left" />
            <KeyBindingSetting label="Move Right" action="right" />
            <KeyBindingSetting label="Jump / Fly" action="jump" />
            <KeyBindingSetting label="Attack / Stomp" action="attack" />
            <KeyBindingSetting label="Pause" action="pause" />
            
            <button
              onClick={(): void => gameSettings.resetKeyBindings()}
              style={{
                marginTop: '8px',
                padding: '8px 16px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid #446688',
                borderRadius: '4px',
                color: '#88aacc',
                fontSize: '11px',
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              Reset to Defaults
            </button>
          </>
        )}

        {/* Game Tab */}
        {activeTab === 'game' && (
          <>
            <div
              style={{
                marginBottom: '12px',
                color: '#88aacc',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              DIFFICULTY
            </div>
            <DifficultyOption
              difficulty="baby"
              label="Baby"
              description={UIStrings.baby_description}
            />
            <DifficultyOption
              difficulty="kids"
              label="Kids"
              description={UIStrings.kids_description}
            />
            <DifficultyOption
              difficulty="adults"
              label="Adults"
              description={UIStrings.adults_description}
            />
            
            <div style={{ marginTop: '16px' }}>
              <ToggleSetting
                label="Show FPS"
                value={settings.showFPS}
                onChange={(v): void => updateSetting('showFPS', v)}
              />
              <ToggleSetting
                label="Pixel Perfect Rendering"
                value={settings.pixelPerfect}
                onChange={(v): void => updateSetting('pixelPerfect', v)}
              />
            </div>
          </>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
          <>
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid #446688',
                borderRadius: '4px',
              }}
            >
              <div
                style={{
                  color: '#ffffff',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  marginBottom: '8px',
                }}
              >
                {UIStrings.preference_erase_save_game}
              </div>
              <div
                style={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  marginBottom: '12px',
                }}
              >
                This will delete all your progress including completed levels and collected items.
              </div>
              <button
                onClick={(): void => setShowEraseConfirm(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#884444',
                  border: '1px solid #aa6666',
                  borderRadius: '4px',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                Erase Save Data
              </button>
            </div>

            <button
              onClick={(): void => {
                gameSettings.reset();
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid #446688',
                borderRadius: '4px',
                color: '#88aacc',
                fontSize: '11px',
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              Reset All Settings to Defaults
            </button>
          </>
        )}
      </div>

      {/* Erase Confirmation Dialog */}
      {showEraseConfirm && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
        >
          <div
            style={{
              backgroundColor: '#1a2a3a',
              border: '2px solid #446688',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '280px',
              textAlign: 'center',
            }}
          >
            <h3
              style={{
                margin: '0 0 12px',
                color: '#ffaa88',
                fontSize: '14px',
                fontFamily: 'monospace',
              }}
            >
              {UIStrings.preference_erase_save_game_dialog_title}
            </h3>
            <p
              style={{
                margin: '0 0 16px',
                color: '#ffffff',
                fontSize: '11px',
                fontFamily: 'monospace',
                lineHeight: '1.5',
              }}
            >
              {UIStrings.preference_erase_save_game_dialog}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={(): void => setShowEraseConfirm(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid #446688',
                  borderRadius: '4px',
                  color: '#88aacc',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                {UIStrings.preference_erase_save_game_dialog_cancel}
              </button>
              <button
                onClick={handleEraseSaveData}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#884444',
                  border: '1px solid #aa6666',
                  borderRadius: '4px',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                {UIStrings.preference_erase_save_game_dialog_ok}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OptionsMenu;
