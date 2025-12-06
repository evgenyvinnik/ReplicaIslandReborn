/**
 * Options Menu Component
 * Settings and preferences screen for Replica Island Reborn
 * Ported from: Original/res/xml/preferences.xml, SetPreferencesActivity.java
 * 
 * Original structure:
 * - Game Settings (category)
 *   - Enable Sound
 *   - Configure Controls (sub-screen)
 *     - Click Attack
 *     - Configure Keyboard
 *     - Motion Sensitivity
 *     - On-Screen Controls
 * - Game Data (category)
 *   - Erase Saved Game
 * - About (category)
 *   - Go to website
 *   - More Information (sub-screen)
 *     - About, Thanks, License
 */

import React, { useState, useEffect } from 'react';
import { gameSettings, type GameSettings } from '../utils/GameSettings';
import { UIStrings } from '../data/strings';

interface OptionsMenuProps {
  onClose: () => void;
}

// Screen hierarchy: main -> controls -> keyboard | main -> about
type Screen = 'main' | 'controls' | 'keyboard' | 'about';

export function OptionsMenu({ onClose }: OptionsMenuProps): React.JSX.Element {
  const [settings, setSettings] = useState<GameSettings>(gameSettings.getAll());
  const [currentScreen, setCurrentScreen] = useState<Screen>('main');
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [showEraseToast, setShowEraseToast] = useState(false);
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

      gameSettings.setKeyBinding(keyBindingMode, [e.code]);
      setKeyBindingMode(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [keyBindingMode]);

  // Hide toast after 2 seconds
  useEffect(() => {
    if (showEraseToast) {
      const timer = setTimeout(() => setShowEraseToast(false), 2000);
      return (): void => clearTimeout(timer);
    }
  }, [showEraseToast]);

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]): void => {
    gameSettings.set(key, value);
  };

  const handleEraseSaveData = (): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('replica_island_save');
        window.localStorage.removeItem('replica_island_progress');
      }
    } catch {
      // Ignore errors
    }
    setShowEraseConfirm(false);
    setShowEraseToast(true);
  };

  const handleBack = (): void => {
    if (currentScreen === 'keyboard') {
      setCurrentScreen('controls');
    } else if (currentScreen === 'controls' || currentScreen === 'about') {
      setCurrentScreen('main');
    } else {
      onClose();
    }
  };

  // Shared styles
  const styles = {
    container: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#000000',
      display: 'flex',
      flexDirection: 'column' as const,
      zIndex: 1000,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: '1px solid #333333',
      backgroundColor: '#1a1a1a',
    },
    headerTitle: {
      flex: 1,
      margin: 0,
      color: '#ffffff',
      fontSize: '18px',
      fontFamily: 'sans-serif',
      fontWeight: 'normal' as const,
    },
    content: {
      flex: 1,
      overflowY: 'auto' as const,
    },
    category: {
      borderBottom: '1px solid #333333',
    },
    categoryTitle: {
      padding: '12px 16px 8px',
      color: '#8ab4f8',
      fontSize: '14px',
      fontFamily: 'sans-serif',
      fontWeight: 500,
    },
    preferenceItem: {
      display: 'block',
      width: '100%',
      padding: '12px 16px',
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: '1px solid #222222',
      cursor: 'pointer',
      textAlign: 'left' as const,
    },
    preferenceTitle: {
      color: '#ffffff',
      fontSize: '16px',
      fontFamily: 'sans-serif',
      marginBottom: '4px',
    },
    preferenceSummary: {
      color: '#9e9e9e',
      fontSize: '14px',
      fontFamily: 'sans-serif',
      lineHeight: 1.4,
    },
    checkbox: {
      width: '20px',
      height: '20px',
      borderRadius: '4px',
      border: '2px solid #8ab4f8',
      backgroundColor: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkmark: {
      color: '#8ab4f8',
      fontSize: '14px',
    },
  };

  // Checkbox preference component (matches Android CheckBoxPreference)
  const CheckBoxPreference = ({
    title,
    summary,
    checked,
    onChange,
  }: {
    title: string;
    summary: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }): React.JSX.Element => (
    <button
      onClick={(): void => onChange(!checked)}
      style={{
        ...styles.preferenceItem,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1, marginRight: '16px' }}>
        <div style={styles.preferenceTitle}>{title}</div>
        <div style={styles.preferenceSummary}>{summary}</div>
      </div>
      <div style={{
        ...styles.checkbox,
        backgroundColor: checked ? '#8ab4f8' : 'transparent',
        borderColor: checked ? '#8ab4f8' : '#666666',
      }}>
        {checked && <span style={{ ...styles.checkmark, color: '#000000' }}>✓</span>}
      </div>
    </button>
  );

  // Screen preference (navigates to sub-screen)
  const ScreenPreference = ({
    title,
    summary,
    onClick,
  }: {
    title: string;
    summary?: string;
    onClick: () => void;
  }): React.JSX.Element => (
    <button
      onClick={onClick}
      style={styles.preferenceItem}
    >
      <div style={styles.preferenceTitle}>{title}</div>
      {summary && <div style={styles.preferenceSummary}>{summary}</div>}
    </button>
  );

  // Static preference (non-interactive info display)
  const StaticPreference = ({
    title,
    summary,
  }: {
    title: string;
    summary: string;
  }): React.JSX.Element => (
    <div style={{ ...styles.preferenceItem, cursor: 'default' }}>
      <div style={styles.preferenceTitle}>{title}</div>
      <div style={styles.preferenceSummary}>{summary}</div>
    </div>
  );

  // Slider preference (matches Android SliderPreference)
  const SliderPreference = ({
    title,
    summary,
    value,
    minText,
    maxText,
    onChange,
  }: {
    title: string;
    summary: string;
    value: number;
    minText: string;
    maxText: string;
    onChange: (v: number) => void;
  }): React.JSX.Element => (
    <div style={{ ...styles.preferenceItem, cursor: 'default' }}>
      <div style={styles.preferenceTitle}>{title}</div>
      <div style={styles.preferenceSummary}>{summary}</div>
      <div style={{ marginTop: '12px' }}>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e): void => onChange(parseInt(e.target.value, 10))}
          style={{
            width: '100%',
            height: '4px',
            WebkitAppearance: 'none',
            appearance: 'none',
            backgroundColor: '#333333',
            borderRadius: '2px',
            outline: 'none',
            cursor: 'pointer',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ color: '#666666', fontSize: '12px' }}>{minText}</span>
          <span style={{ color: '#666666', fontSize: '12px' }}>{maxText}</span>
        </div>
      </div>
    </div>
  );

  // Key binding row for keyboard config
  const KeyBindingRow = ({
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
      <button
        onClick={(): void => setKeyBindingMode(isBinding ? null : action)}
        style={{
          ...styles.preferenceItem,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={styles.preferenceTitle}>{label}</span>
        <span style={{
          padding: '6px 16px',
          backgroundColor: isBinding ? '#8ab4f8' : '#333333',
          borderRadius: '4px',
          color: isBinding ? '#000000' : '#ffffff',
          fontSize: '14px',
          minWidth: '80px',
          textAlign: 'center',
        }}>
          {isBinding ? 'Press key...' : displayKey}
        </span>
      </button>
    );
  };

  // Header with back button
  const Header = ({ title }: { title: string }): React.JSX.Element => (
    <div style={styles.header}>
      <button
        onClick={handleBack}
        style={{
          padding: '8px',
          marginRight: '8px',
          backgroundColor: 'transparent',
          border: 'none',
          color: '#ffffff',
          fontSize: '20px',
          cursor: 'pointer',
        }}
        aria-label="Back"
      >
        ←
      </button>
      <h2 style={styles.headerTitle}>{title}</h2>
    </div>
  );

  // Main settings screen
  const MainScreen = (): React.JSX.Element => (
    <>
      <Header title="Settings" />
      <div style={styles.content}>
        {/* Game Settings Category */}
        <div style={styles.category}>
          <div style={styles.categoryTitle}>{UIStrings.preference_game_settings}</div>
          <CheckBoxPreference
            title={UIStrings.preference_enable_sound}
            summary={UIStrings.preference_enable_sound_summary}
            checked={settings.soundEnabled}
            onChange={(v): void => updateSetting('soundEnabled', v)}
          />
          <ScreenPreference
            title={UIStrings.preference_configure_controls}
            onClick={(): void => setCurrentScreen('controls')}
          />
        </div>

        {/* Game Data Category */}
        <div style={styles.category}>
          <div style={styles.categoryTitle}>{UIStrings.preference_save_game}</div>
          <button
            onClick={(): void => setShowEraseConfirm(true)}
            style={styles.preferenceItem}
          >
            <div style={styles.preferenceTitle}>{UIStrings.preference_erase_save_game}</div>
          </button>
        </div>

        {/* About Category */}
        <div style={styles.category}>
          <div style={styles.categoryTitle}>{UIStrings.preference_about}</div>
          <button
            onClick={(): void => { window.open('http://replicaisland.net', '_blank'); }}
            style={styles.preferenceItem}
          >
            <div style={styles.preferenceTitle}>{UIStrings.preference_visit_site}</div>
          </button>
          <ScreenPreference
            title={UIStrings.preference_misc}
            onClick={(): void => setCurrentScreen('about')}
          />
        </div>
      </div>
    </>
  );

  // Configure Controls sub-screen
  const ControlsScreen = (): React.JSX.Element => (
    <>
      <Header title={UIStrings.preference_configure_controls} />
      <div style={styles.content}>
        <CheckBoxPreference
          title={UIStrings.preference_enable_click_attack}
          summary={UIStrings.preference_enable_click_attack_summary}
          checked={settings.clickAttackEnabled}
          onChange={(v): void => updateSetting('clickAttackEnabled', v)}
        />
        <ScreenPreference
          title={UIStrings.preference_key_config}
          summary={UIStrings.preference_key_config_summary}
          onClick={(): void => setCurrentScreen('keyboard')}
        />
        <SliderPreference
          title={UIStrings.preference_movement_sensitivity}
          summary={UIStrings.preference_movement_sensitivity_summary}
          value={settings.movementSensitivity}
          minText={UIStrings.preference_movement_min}
          maxText={UIStrings.preference_movement_max}
          onChange={(v): void => updateSetting('movementSensitivity', v)}
        />
        <CheckBoxPreference
          title={UIStrings.preference_enable_screen_controls}
          summary={UIStrings.preference_enable_screen_controls_summary}
          checked={settings.onScreenControlsEnabled}
          onChange={(v): void => updateSetting('onScreenControlsEnabled', v)}
        />
      </div>
    </>
  );

  // Keyboard configuration sub-screen
  const KeyboardScreen = (): React.JSX.Element => (
    <>
      <Header title={UIStrings.preference_key_config_dialog_title} />
      <div style={styles.content}>
        <KeyBindingRow label={UIStrings.preference_key_config_left} action="left" />
        <KeyBindingRow label={UIStrings.preference_key_config_right} action="right" />
        <KeyBindingRow label={UIStrings.preference_key_config_jump} action="jump" />
        <KeyBindingRow label={UIStrings.preference_key_config_attack} action="attack" />
        <button
          onClick={(): void => gameSettings.resetKeyBindings()}
          style={{
            ...styles.preferenceItem,
            marginTop: '16px',
          }}
        >
          <div style={{ ...styles.preferenceTitle, color: '#8ab4f8' }}>Reset to Defaults</div>
        </button>
      </div>
    </>
  );

  // About / More Information sub-screen
  const AboutScreen = (): React.JSX.Element => (
    <>
      <Header title={UIStrings.preference_misc} />
      <div style={styles.content}>
        <StaticPreference
          title={UIStrings.preference_about_title}
          summary={UIStrings.preference_about_summary}
        />
        <StaticPreference
          title={UIStrings.preference_thanks_title}
          summary={UIStrings.preference_thanks_summary}
        />
        <StaticPreference
          title={UIStrings.preference_licence_title}
          summary={UIStrings.preference_licence_summary}
        />
        <StaticPreference
          title={UIStrings.preference_web_port_title}
          summary={UIStrings.preference_web_port_summary}
        />
      </div>
    </>
  );

  return (
    <div style={styles.container}>
      {currentScreen === 'main' && <MainScreen />}
      {currentScreen === 'controls' && <ControlsScreen />}
      {currentScreen === 'keyboard' && <KeyboardScreen />}
      {currentScreen === 'about' && <AboutScreen />}

      {/* Erase Confirmation Dialog */}
      {showEraseConfirm && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
        >
          <div
            style={{
              backgroundColor: '#2d2d2d',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '300px',
              width: '90%',
            }}
          >
            <h3
              style={{
                margin: '0 0 16px',
                color: '#ffffff',
                fontSize: '20px',
                fontFamily: 'sans-serif',
                fontWeight: 'normal',
              }}
            >
              {UIStrings.preference_erase_save_game_dialog_title}
            </h3>
            <p
              style={{
                margin: '0 0 24px',
                color: '#9e9e9e',
                fontSize: '14px',
                fontFamily: 'sans-serif',
                lineHeight: 1.5,
              }}
            >
              {UIStrings.preference_erase_save_game_dialog}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={(): void => setShowEraseConfirm(false)}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#8ab4f8',
                  fontSize: '14px',
                  fontFamily: 'sans-serif',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {UIStrings.preference_erase_save_game_dialog_cancel}
              </button>
              <button
                onClick={handleEraseSaveData}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#8ab4f8',
                  fontSize: '14px',
                  fontFamily: 'sans-serif',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {UIStrings.preference_erase_save_game_dialog_ok}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {showEraseToast && (
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#323232',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'sans-serif',
            zIndex: 1002,
          }}
        >
          {UIStrings.saved_game_erased_notification}
        </div>
      )}
    </div>
  );
}

export default OptionsMenu;
