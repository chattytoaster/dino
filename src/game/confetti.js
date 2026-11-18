import confetti from 'canvas-confetti';

export function fireRecordConfetti() {
  if (typeof window !== 'undefined' && typeof confetti === 'function') {
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.65 },
    });
  }
}
