/**
 * Audio Chime Synthesizer using Web Audio API
 * Generates instant, crystal-clear mobile notification sounds without external audio assets.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a notification chime according to alert severity
 * @param {'info' | 'warning' | 'critical'} severity 
 */
export function playAlertNotificationSound(severity = 'info') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (severity === 'critical') {
      // Urgent, crisp 3-tone attention chime
      const tones = [
        { freq: 880, start: 0, duration: 0.12 },     // A5
        { freq: 698.46, start: 0.14, duration: 0.12 },  // F5
        { freq: 1046.5, start: 0.28, duration: 0.25 }  // C6
      ];

      tones.forEach(({ freq, start, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.28, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } else if (severity === 'warning') {
      // Warm, distinct 2-tone alert
      const tones = [
        { freq: 659.25, start: 0, duration: 0.14 },    // E5
        { freq: 880, start: 0.15, duration: 0.22 }      // A5
      ];

      tones.forEach(({ freq, start, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.22, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } else {
      // Gentle, friendly 2-tone mobile app chime (iOS/Android feel)
      const tones = [
        { freq: 587.33, start: 0, duration: 0.12 },     // D5
        { freq: 880, start: 0.12, duration: 0.25 }      // A5
      ];

      tones.forEach(({ freq, start, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.18, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    }
  } catch (err) {
    console.debug('[Sound] Audio play prevented by browser autoplay policy:', err);
  }
}
