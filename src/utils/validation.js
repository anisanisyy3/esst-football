// ============================================================================
// VALIDATION HELPERS (pure functions - return i18n keys, no DOM)
// ============================================================================

/** True for 0, 1, 2, 3... (no decimals, no negatives). */
export function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

/** Convert a form value to a number, or null when empty. */
function toScore(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? NaN : n;
}

/**
 * Validate a match form payload.
 * Rules:
 *  - both teams selected and different (no team vs itself);
 *  - kickoff must be a valid date;
 *  - scores (when entered) must be non-negative integers;
 *  - live / finished matches must have both scores;
 *  - if only one score is entered -> error.
 * @returns {{ valid: boolean, errors: Object<string,string> }} errors map to i18n keys
 */
export function validateMatch(input) {
  const errors = {};

  if (!input.home_team_id || !input.away_team_id) {
    errors.teams = 'validation.selectTeams';
  } else if (input.home_team_id === input.away_team_id) {
    errors.teams = 'validation.sameTeams';
  }

  const kickoff = input.kickoff_at ? new Date(input.kickoff_at) : null;
  if (!kickoff || Number.isNaN(kickoff.getTime())) {
    errors.kickoff_at = 'validation.invalidDate';
  }

  const homeScore = toScore(input.home_score);
  const awayScore = toScore(input.away_score);
  const anyScoreEntered = homeScore !== null || awayScore !== null;
  const needsScores = input.status === 'live' || input.status === 'finished';

  if (anyScoreEntered || needsScores) {
    if (homeScore === null || awayScore === null) {
      errors.scores = needsScores ? 'validation.scoresRequired' : 'validation.scoresBoth';
    } else if (!isNonNegativeInteger(homeScore) || !isNonNegativeInteger(awayScore)) {
      errors.scores = 'validation.invalidScore';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Validate a team form payload. */
export function validateTeam(input) {
  const errors = {};

  const name = (input.name ?? '').trim();
  if (name.length < 2 || name.length > 60) {
    errors.name = 'validation.teamName';
  }

  const shortName = (input.short_name ?? '').trim();
  if (shortName.length < 2 || shortName.length > 6) {
    errors.short_name = 'validation.shortName';
  }

  const logoUrl = (input.logo_url ?? '').trim();
  if (logoUrl && !/^https?:\/\/.+/i.test(logoUrl)) {
    errors.logo_url = 'validation.logoUrl';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
