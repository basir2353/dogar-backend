type MatchInput = {
  ageA: number;
  ageB: number;
  sameCity: boolean;
  sameSect: boolean;
  educationCompatibility: number;
  professionCompatibility: number;
};

const weights = {
  ageGap: 0.25,
  location: 0.2,
  sect: 0.2,
  education: 0.2,
  profession: 0.15
};

export function compatibilityScore(input: MatchInput) {
  const ageDelta = Math.abs(input.ageA - input.ageB);
  const ageFactor = Math.max(0, 100 - ageDelta * 10);
  const cityFactor = input.sameCity ? 100 : 60;
  const sectFactor = input.sameSect ? 100 : 50;

  const score =
    ageFactor * weights.ageGap +
    cityFactor * weights.location +
    sectFactor * weights.sect +
    input.educationCompatibility * weights.education +
    input.professionCompatibility * weights.profession;

  return Math.round(score);
}
