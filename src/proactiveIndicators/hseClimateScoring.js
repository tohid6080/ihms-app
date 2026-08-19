import { HSE_CLIMATE_DIMENSIONS } from './hseClimateData.js';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function scoreHseClimate(answers) {
  const dimensions = HSE_CLIMATE_DIMENSIONS.map((dimension) => {
    const rawScores = dimension.questions.map((q) => {
      const raw = Number(answers[q]);
      if (!Number.isFinite(raw) || raw < 1 || raw > 5) {
        throw new Error(`Missing/invalid answer for question ${q}`);
      }
      return dimension.reverseQuestions.includes(q) ? 6 - raw : raw;
    });

    const total = rawScores.reduce((sum, value) => sum + value, 0);
    const max = rawScores.length * 5;
    const score = (total / max) * 10;

    return {
      id: dimension.id,
      title: dimension.title,
      score: Number(score.toFixed(2)),
      level: getHseClimateLevel(score),
    };
  });

  // Excel model: each dimension is 0-10, final Climate = sum of 9 dimensions (0-90).
  const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0);
  return {
    totalScore: Number(totalScore.toFixed(2)),
    level: getHseClimateTotalLevel(totalScore),
    dimensions,
  };
}

export function getHseClimateLevel(score) {
  if (score < 4) return 'پایین';
  if (score < 8) return 'متوسط';
  return 'بالا';
}

export function getHseClimateTotalLevel(score) {
  if (score < 36) return 'پایین';
  if (score < 72) return 'متوسط';
  return 'بالا';
}

export function isCompleteHseClimate(answers) {
  return Object.keys(answers || {}).length === 43 &&
    Object.values(answers).every((v) => [1,2,3,4,5].includes(Number(v)));
}
