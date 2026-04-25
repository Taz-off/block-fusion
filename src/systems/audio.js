(function attachAudio(global) {
  'use strict';

  const namespace = global.FusionBlocks;

  class SoundBoard {
    constructor(settings) {
      this.context = null;
      this.volume = settings.volume;
    }

    setVolume(volume) {
      this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    }

    ensureContext() {
      if (!this.context) {
        const AudioContext = global.AudioContext || global.webkitAudioContext;
        if (!AudioContext) {
          return null;
        }
        this.context = new AudioContext();
      }

      if (this.context.state === 'suspended') {
        this.context.resume();
      }

      return this.context;
    }

    play(name) {
      if (this.volume <= 0) {
        return;
      }

      const context = this.ensureContext();
      if (!context) {
        return;
      }

      const now = context.currentTime;
      const volume = this.volume;

      if (name === 'placement') {
        this.playTone(360, now, 0.08, 'triangle', 0.22 * volume);
        this.playTone(540, now + 0.04, 0.08, 'sine', 0.12 * volume);
      }

      if (name === 'merge') {
        this.playTone(520, now, 0.09, 'sine', 0.18 * volume);
        this.playTone(780, now + 0.07, 0.12, 'sine', 0.2 * volume);
      }

      if (name === 'combo') {
        [520, 660, 880, 1040].forEach((frequency, index) => {
          this.playTone(frequency, now + index * 0.045, 0.09, 'triangle', 0.16 * volume);
        });
      }

      if (name === 'clear') {
        this.playNoise(now, 0.18, 0.18 * volume);
        this.playTone(240, now, 0.1, 'sawtooth', 0.08 * volume);
        this.playTone(720, now + 0.08, 0.12, 'sine', 0.16 * volume);
      }

      if (name === 'defeat') {
        [360, 280, 180].forEach((frequency, index) => {
          this.playTone(frequency, now + index * 0.12, 0.16, 'sine', 0.15 * volume);
        });
      }

      if (name === 'milestone') {
        [660, 990, 1320, 1760].forEach((frequency, index) => {
          this.playTone(frequency, now + index * 0.06, 0.16, 'sine', 0.16 * volume);
        });
      }
    }

    playTone(frequency, startTime, duration, type, gainValue) {
      const context = this.context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.frequency.setValueAtTime(frequency, startTime);
      oscillator.type = type;

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.02);
    }

    playNoise(startTime, duration, gainValue) {
      const context = this.context;
      const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const output = buffer.getChannelData(0);

      for (let index = 0; index < bufferSize; index += 1) {
        output[index] = (Math.random() * 2 - 1) * (1 - index / bufferSize);
      }

      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(gainValue, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      source.connect(gain);
      gain.connect(context.destination);
      source.start(startTime);
      source.stop(startTime + duration);
    }
  }

  namespace.SoundBoard = SoundBoard;
})(window);
