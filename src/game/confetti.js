import confetti from 'canvas-confetti';

export function fireRecordConfetti() {
  try {
    if (typeof window !== 'undefined' && typeof confetti === 'function') {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.65 },
      });
    }
  } catch {
    // В тестовой среде без Canvas тихо игнорируем
  }
}
