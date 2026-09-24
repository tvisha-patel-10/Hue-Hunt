export interface ColorHSL {
  h: number;
  s: number;
  l: number;
}

export interface RoundResult {
  target: ColorHSL;
  guess: ColorHSL;
  score: number;
  accuracy: number;
}

export const FUN_MESSAGES = {
  perfect: ["Absolute Chrome Master!", "Are you a spectrophotometer?", "Flawless victory!"],
  good: ["So close! Next round?", "Great eye for detail.", "You've got the vision."],
  average: ["Not bad, but keep practicing.", "A bit off, but the spirit is there.", "Color me impressed... almost."],
  bad: ["Were you blinking?", "Maybe turn up your brightness?", "That's... certainly a color."],
};
