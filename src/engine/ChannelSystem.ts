/**
 * Channel System - Simple event/messaging system between game objects
 * Ported from: Original/src/com/replica/replicaisland/ChannelSystem.java
 *
 * Provides a way for game objects to communicate through named channels.
 * Each channel can hold a value that other objects can read or modify.
 */

const MAX_CHANNELS = 8;

/**
 * A channel holds a name and a value that can be shared between objects
 */
export interface Channel<T = unknown> {
  name: string | null;
  value: T | null;
}

/**
 * Float value wrapper for channels
 */
export interface ChannelFloatValue {
  value: number;
}

/**
 * Boolean value wrapper for channels
 */
export interface ChannelBooleanValue {
  value: boolean;
}

/**
 * Channel System - manages named communication channels
 */
export class ChannelSystem {
  private channels: Channel[] = [];
  private registeredChannelCount: number = 0;

  constructor() {
    // Pre-allocate channels
    for (let i = 0; i < MAX_CHANNELS; i++) {
      this.channels.push({ name: null, value: null });
    }
  }

  /**
   * Reset all channels
   */
  reset(): void {
    for (let i = 0; i < MAX_CHANNELS; i++) {
      this.channels[i].name = null;
      this.channels[i].value = null;
    }
    this.registeredChannelCount = 0;
  }

  /**
   * Register a channel by name
   * Returns existing channel if name is already registered
   */
  registerChannel(name: string): Channel | null {
    // Check if channel already exists
    const existingIndex = this.channels.findIndex(
      (ch) => ch.name !== null && ch.name === name
    );

    if (existingIndex !== -1) {
      return this.channels[existingIndex];
    }

    // Add new channel if there's room
    if (this.registeredChannelCount >= MAX_CHANNELS) {
      console.log('ChannelSystem: Channel pool exhausted!');
      return null;
    }

    const channel = this.channels[this.registeredChannelCount];
    channel.name = name;
    this.registeredChannelCount++;

    // Sort channels by name for binary search
    this.channels.sort((a, b) => {
      if (a.name === null && b.name !== null) return 1;
      if (a.name !== null && b.name === null) return -1;
      if (a.name === null && b.name === null) return 0;
      return a.name!.localeCompare(b.name!);
    });

    return channel;
  }

  /**
   * Find a channel by name
   */
  findChannel(name: string): Channel | null {
    for (let i = 0; i < this.registeredChannelCount; i++) {
      if (this.channels[i].name === name) {
        return this.channels[i];
      }
    }
    return null;
  }

  /**
   * Get or create a channel with a specific value type
   */
  getOrCreateChannel<T>(name: string, initialValue?: T): Channel<T> {
    let channel = this.findChannel(name);
    if (!channel) {
      channel = this.registerChannel(name);
    }
    if (channel && initialValue !== undefined && channel.value === null) {
      channel.value = initialValue;
    }
    return channel as Channel<T>;
  }

  /**
   * Set a float value on a channel
   */
  setFloatValue(name: string, value: number): void {
    const channel = this.getOrCreateChannel<ChannelFloatValue>(name, { value: 0 });
    if (channel && channel.value) {
      channel.value.value = value;
    }
  }

  /**
   * Get a float value from a channel
   */
  getFloatValue(name: string): number {
    const channel = this.findChannel(name);
    if (channel && channel.value && typeof (channel.value as ChannelFloatValue).value === 'number') {
      return (channel.value as ChannelFloatValue).value;
    }
    return 0;
  }

  /**
   * Set a boolean value on a channel
   */
  setBooleanValue(name: string, value: boolean): void {
    const channel = this.getOrCreateChannel<ChannelBooleanValue>(name, { value: false });
    if (channel && channel.value) {
      channel.value.value = value;
    }
  }

  /**
   * Get a boolean value from a channel
   */
  getBooleanValue(name: string): boolean {
    const channel = this.findChannel(name);
    if (channel && channel.value && typeof (channel.value as ChannelBooleanValue).value === 'boolean') {
      return (channel.value as ChannelBooleanValue).value;
    }
    return false;
  }
}
