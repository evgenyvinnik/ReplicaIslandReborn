/**
 * Options Menu Component
 * Settings and preferences screen for Replica Island Reborn
 * Ported from: Original/res/xml/preferences.xml, SetPreferencesActivity.java
 * 
 * Styled to match Android 2.x (Gingerbread/Froyo) era PreferenceActivity
 * - Gray color scheme with orange accents (#FF7700)
 * - Inline slider layout (Min [====] Max)
 * - 2-column keyboard config dialog
 */

import React, { useState, useEffect } from 'react';
import { useGameStore, type GameSettings, type KeyBindings } from '../stores/useGameStore';
import { UIStrings } from '../data/strings';

interface OptionsMenuProps {
  onClose: () => void;
}

// Screen hierarchy: main -> controls | main -> about
// Keyboard config is shown as a dialog overlay
type Screen = 'main' | 'controls' | 'about';

// 2010-era Android color scheme
const COLORS = {
  background: '#000000',
  headerBg: '#222222',
  headerText: '#ffffff',
  categoryText: '#ff7700', // Orange accent - matches original
  itemBg: '#000000',
  itemBgPressed: '#333333',
  titleText: '#ffffff',
  summaryText: '#aaaaaa',
  divider: '#333333',
  checkboxBorder: '#666666',
  checkboxChecked: '#ff7700',
  sliderTrack: '#444444',
  sliderThumb: '#ff7700',
  keyBg: 'rgba(153, 153, 153, 0.6)', // #99999999 from original
  keyBgActive: 'rgba(255, 119, 0, 0.6)', // #99FF7700 from original
  dialogBg: '#1a1a1a',
  dialogBorder: '#444444',
  buttonText: '#ffffff',
};

export function OptionsMenu({ onClose }: OptionsMenuProps): React.JSX.Element {
  // Use Zustand store directly for settings
  const settings = useGameStore((state) => state.settings);
  const setSetting = useGameStore((state) => state.setSetting);
  const setKeyBinding = useGameStore((state) => state.setKeyBinding);
  const resetKeyBindings = useGameStore((state) => state.resetKeyBindings);
  const resetEverything = useGameStore((state) => state.resetEverything);
  
  const [currentScreen, setCurrentScreen] = useState<Screen>('main');
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [showKeyboardConfig, setShowKeyboardConfig] = useState(false);
  const [showEraseToast, setShowEraseToast] = useState(false);
  const [keyBindingMode, setKeyBindingMode] = useState<keyof KeyBindings | null>(null);

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

      setKeyBinding(keyBindingMode, [e.code]);
      setKeyBindingMode(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [keyBindingMode, setKeyBinding]);

  // Hide toast after 2 seconds
  useEffect(() => {
    if (showEraseToast) {
      const timer = setTimeout(() => setShowEraseToast(false), 2000);
      return (): void => clearTimeout(timer);
    }
  }, [showEraseToast]);

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]): void => {
    setSetting(key, value);
  };

  const handleEraseSaveData = (): void => {
    // Use Zustand's resetEverything to clear all data
    resetEverything();
    setShowEraseConfirm(false);
    setShowEraseToast(true);
  };

  const handleBack = (): void => {
    if (currentScreen === 'controls' || currentScreen === 'about') {
      setCurrentScreen('main');
    } else {
      onClose();
    }
  };

  // Category header (uppercase, orange text - matches Android 2.x style)
  const CategoryHeader = ({ title }: { title: string }): React.JSX.Element => (
    <div
      style={{
        padding: '8px 8px 4px 8px',
        backgroundColor: COLORS.background,
        borderBottom: `1px solid ${COLORS.divider}`,
      }}
    >
      <span
        style={{
          color: COLORS.categoryText,
          fontSize: '12px',
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {title}
      </span>
    </div>
  );

  // Preference item base
  const PreferenceItem = ({
    children,
    onClick,
    disabled = false,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }): React.JSX.Element => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'block',
        width: '100%',
        padding: '12px 8px',
        backgroundColor: COLORS.itemBg,
        border: 'none',
        borderBottom: `1px solid ${COLORS.divider}`,
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );

  // Checkbox preference (Android 2.x style - checkbox on right)
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
    <PreferenceItem onClick={(): void => onChange(!checked)}>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, marginRight: '12px' }}>
          <div style={{ color: COLORS.titleText, fontSize: '16px', fontFamily: 'sans-serif' }}>
            {title}
          </div>
          <div style={{ color: COLORS.summaryText, fontSize: '13px', fontFamily: 'sans-serif', marginTop: '2px' }}>
            {summary}
          </div>
        </div>
        {/* Android 2.x style checkbox */}
        <div
          style={{
            width: '18px',
            height: '18px',
            border: `2px solid ${checked ? COLORS.checkboxChecked : COLORS.checkboxBorder}`,
            borderRadius: '3px',
            backgroundColor: checked ? COLORS.checkboxChecked : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '2px',
          }}
        >
          {checked && (
            <span style={{ color: '#000000', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
          )}
        </div>
      </div>
    </PreferenceItem>
  );

  // Screen preference (navigates to sub-screen, shows > arrow)
  const ScreenPreference = ({
    title,
    summary,
    onClick,
  }: {
    title: string;
    summary?: string;
    onClick: () => void;
  }): React.JSX.Element => (
    <PreferenceItem onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: COLORS.titleText, fontSize: '16px', fontFamily: 'sans-serif' }}>
            {title}
          </div>
          {summary && (
            <div style={{ color: COLORS.summaryText, fontSize: '13px', fontFamily: 'sans-serif', marginTop: '2px' }}>
              {summary}
            </div>
          )}
        </div>
        <span style={{ color: COLORS.summaryText, fontSize: '16px' }}>›</span>
      </div>
    </PreferenceItem>
  );

  // Static preference (non-interactive info)
  const StaticPreference = ({
    title,
    summary,
  }: {
    title: string;
    summary: string;
  }): React.JSX.Element => (
    <PreferenceItem disabled>
      <div style={{ color: COLORS.titleText, fontSize: '16px', fontFamily: 'sans-serif' }}>
        {title}
      </div>
      <div style={{ color: COLORS.summaryText, fontSize: '13px', fontFamily: 'sans-serif', marginTop: '2px' }}>
        {summary}
      </div>
    </PreferenceItem>
  );

  // Slider preference - inline layout like original: Min [====slider====] Max
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
    <div
      style={{
        padding: '12px 8px',
        backgroundColor: COLORS.itemBg,
        borderBottom: `1px solid ${COLORS.divider}`,
      }}
    >
      <div style={{ color: COLORS.titleText, fontSize: '16px', fontFamily: 'sans-serif' }}>
        {title}
      </div>
      <div style={{ color: COLORS.summaryText, fontSize: '13px', fontFamily: 'sans-serif', marginTop: '2px' }}>
        {summary}
      </div>
      {/* Inline slider: Min [====] Max - matches original layout */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '12px',
          gap: '10px',
        }}
      >
        <span style={{ color: COLORS.summaryText, fontSize: '13px', fontFamily: 'sans-serif' }}>
          {minText}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e): void => onChange(parseInt(e.target.value, 10))}
          style={{
            width: '100px',
            height: '16px',
            WebkitAppearance: 'none',
            appearance: 'none',
            backgroundColor: COLORS.sliderTrack,
            borderRadius: '8px',
            outline: 'none',
            cursor: 'pointer',
          }}
        />
        <span style={{ color: COLORS.summaryText, fontSize: '13px', fontFamily: 'sans-serif' }}>
          {maxText}
        </span>
      </div>
    </div>
  );

  // Header with title
  const Header = ({ title }: { title: string }): React.JSX.Element => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 8px',
        backgroundColor: COLORS.headerBg,
        borderBottom: `1px solid ${COLORS.divider}`,
      }}
    >
      <button
        onClick={handleBack}
        style={{
          padding: '4px 8px',
          marginRight: '8px',
          backgroundColor: 'transparent',
          border: 'none',
          color: COLORS.headerText,
          fontSize: '18px',
          cursor: 'pointer',
        }}
        aria-label="Back"
      >
        ‹
      </button>
      <span
        style={{
          color: COLORS.headerText,
          fontSize: '18px',
          fontFamily: 'sans-serif',
        }}
      >
        {title}
      </span>
    </div>
  );

  // 2-column keyboard config dialog (matches original key_config.xml layout)
  const KeyboardConfigDialog = (): React.JSX.Element => {
    const getDisplayKey = (action: keyof GameSettings['keyBindings']): string => {
      const key = settings.keyBindings[action][0] || 'None';
      return key.replace('Key', '').replace('Arrow', '');
    };

    const KeyButton = ({
      label,
      action,
    }: {
      label: string;
      action: keyof GameSettings['keyBindings'];
    }): React.JSX.Element => {
      const isActive = keyBindingMode === action;
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <span
            style={{
              width: '50px',
              color: COLORS.titleText,
              fontSize: '14px',
              fontFamily: 'sans-serif',
            }}
          >
            {label}
          </span>
          <button
            onClick={(): void => setKeyBindingMode(isActive ? null : action)}
            style={{
              width: '120px',
              padding: '7px',
              backgroundColor: isActive ? COLORS.keyBgActive : COLORS.keyBg,
              border: 'none',
              borderRadius: '10px',
              color: COLORS.titleText,
              fontSize: '14px',
              fontFamily: 'sans-serif',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            {isActive ? 'Press...' : getDisplayKey(action)}
          </button>
        </div>
      );
    };

    return (
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
            backgroundColor: COLORS.dialogBg,
            border: `1px solid ${COLORS.dialogBorder}`,
            borderRadius: '8px',
            padding: '20px',
            minWidth: '320px',
          }}
        >
          {/* Dialog title */}
          <div
            style={{
              color: COLORS.titleText,
              fontSize: '18px',
              fontFamily: 'sans-serif',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            {UIStrings.preference_key_config_dialog_title}
          </div>

          {/* 2-column grid layout (matches original key_config.xml) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
            }}
          >
            {/* Left column */}
            <div>
              <KeyButton label={UIStrings.preference_key_config_left} action="left" />
              <KeyButton label={UIStrings.preference_key_config_right} action="right" />
            </div>
            {/* Right column */}
            <div>
              <KeyButton label={UIStrings.preference_key_config_jump} action="jump" />
              <KeyButton label={UIStrings.preference_key_config_attack} action="attack" />
            </div>
          </div>

          {/* Dialog buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '16px',
              marginTop: '24px',
              borderTop: `1px solid ${COLORS.divider}`,
              paddingTop: '16px',
            }}
          >
            <button
              onClick={(): void => {
                resetKeyBindings();
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                color: COLORS.categoryText,
                fontSize: '14px',
                fontFamily: 'sans-serif',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              Reset
            </button>
            <button
              onClick={(): void => {
                setKeyBindingMode(null);
                setShowKeyboardConfig(false);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                color: COLORS.categoryText,
                fontSize: '14px',
                fontFamily: 'sans-serif',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {UIStrings.preference_key_config_dialog_ok}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Erase confirmation dialog (Android AlertDialog style)
  const EraseConfirmDialog = (): React.JSX.Element => (
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
          backgroundColor: COLORS.dialogBg,
          border: `1px solid ${COLORS.dialogBorder}`,
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '300px',
          width: '90%',
        }}
      >
        <div
          style={{
            color: COLORS.titleText,
            fontSize: '18px',
            fontFamily: 'sans-serif',
            marginBottom: '12px',
          }}
        >
          {UIStrings.preference_erase_save_game_dialog_title}
        </div>
        <div
          style={{
            color: COLORS.summaryText,
            fontSize: '14px',
            fontFamily: 'sans-serif',
            lineHeight: 1.5,
            marginBottom: '20px',
          }}
        >
          {UIStrings.preference_erase_save_game_dialog}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '16px',
            borderTop: `1px solid ${COLORS.divider}`,
            paddingTop: '16px',
          }}
        >
          <button
            onClick={(): void => setShowEraseConfirm(false)}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: 'none',
              color: COLORS.buttonText,
              fontSize: '14px',
              fontFamily: 'sans-serif',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {UIStrings.preference_erase_save_game_dialog_cancel}
          </button>
          <button
            onClick={handleEraseSaveData}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: 'none',
              color: COLORS.categoryText,
              fontSize: '14px',
              fontFamily: 'sans-serif',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {UIStrings.preference_erase_save_game_dialog_ok}
          </button>
        </div>
      </div>
    </div>
  );

  // Main settings screen
  const MainScreen = (): React.JSX.Element => (
    <>
      <Header title="Settings" />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Game Settings Category */}
        <CategoryHeader title={UIStrings.preference_game_settings} />
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

        {/* Game Data Category */}
        <CategoryHeader title={UIStrings.preference_save_game} />
        <PreferenceItem onClick={(): void => setShowEraseConfirm(true)}>
          <div style={{ color: COLORS.titleText, fontSize: '16px', fontFamily: 'sans-serif' }}>
            {UIStrings.preference_erase_save_game}
          </div>
        </PreferenceItem>

        {/* About Category */}
        <CategoryHeader title={UIStrings.preference_about} />
        <PreferenceItem onClick={(): void => { window.open('http://replicaisland.net', '_blank'); }}>
          <div style={{ color: COLORS.titleText, fontSize: '16px', fontFamily: 'sans-serif' }}>
            {UIStrings.preference_visit_site}
          </div>
        </PreferenceItem>
        <ScreenPreference
          title={UIStrings.preference_misc}
          onClick={(): void => setCurrentScreen('about')}
        />
      </div>
    </>
  );

  // Configure Controls sub-screen
  const ControlsScreen = (): React.JSX.Element => (
    <>
      <Header title={UIStrings.preference_configure_controls} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <CheckBoxPreference
          title={UIStrings.preference_enable_click_attack}
          summary={UIStrings.preference_enable_click_attack_summary}
          checked={settings.clickAttackEnabled}
          onChange={(v): void => updateSetting('clickAttackEnabled', v)}
        />
        <ScreenPreference
          title={UIStrings.preference_key_config}
          summary={UIStrings.preference_key_config_summary}
          onClick={(): void => setShowKeyboardConfig(true)}
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

  // About / More Information sub-screen
  const AboutScreen = (): React.JSX.Element => (
    <>
      <Header title={UIStrings.preference_misc} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
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
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.background,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      {currentScreen === 'main' && <MainScreen />}
      {currentScreen === 'controls' && <ControlsScreen />}
      {currentScreen === 'about' && <AboutScreen />}

      {/* Keyboard Config Dialog */}
      {showKeyboardConfig && <KeyboardConfigDialog />}

      {/* Erase Confirmation Dialog */}
      {showEraseConfirm && <EraseConfirmDialog />}

      {/* Toast notification (Android style) */}
      {showEraseToast && (
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#444444',
            color: COLORS.titleText,
            padding: '10px 20px',
            borderRadius: '20px',
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
