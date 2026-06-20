export function requiresManualReview(amount: number, threshold: number): boolean {
  return amount > threshold
}
