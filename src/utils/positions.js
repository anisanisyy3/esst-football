// ============================================================================
// FOOTBALL DOMAIN CONSTANTS
// Shared by the lineup editor, profiles, OVR engine and the match report.
// Position keys are OVR categories: the 4 main football positions.
// ============================================================================

/** The 4 OVR positions (stored in profiles.main_position and lineups). */
export const POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'forward'];

/** Preferred feet. */
export const FEET = ['right', 'left', 'both'];

/** Match event types (the canonical list used by reports). */
export const EVENT_TYPES = ['goal', 'yellow', 'red', 'sub'];

/** Goal details: normal goal, penalty, own goal. */
export const GOAL_DETAILS = ['normal', 'penalty', 'own_goal'];

/** OVR engine constants (official ESST rules - do not change silently). */
export const OVR_START = 60;
export const OVR_MIN = 50;
export const OVR_MAX = 99;

/** Roster limits (official ESST rules). */
export const ROSTER_MAX = 45; // active players per team (captain included)
export const STARTERS_REQUIRED = 11;
export const SUBSTITUTES_MAX = 7;

/** Formation templates: slot -> suggested OVR position per player.
 *  Slots are purely visual placements on the pitch; the OVR category is the
 *  separate "match position" field the captain assigns (GK/DF/MF/FW). */
export const FORMATIONS = {
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'],
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'LW', 'CAM', 'RW', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '5-3-2': ['GK', 'LB', 'CB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'ST', 'ST'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
  '4-5-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST'],
};

/** Suggested OVR category for each pitch slot. */
export const SLOT_POSITION = {
  GK: 'goalkeeper',
  LB: 'defender',
  CB: 'defender',
  RB: 'defender',
  LM: 'midfielder',
  CM: 'midfielder',
  RM: 'midfielder',
  CAM: 'midfielder',
  LW: 'forward',
  RW: 'forward',
  ST: 'forward',
};

/** Staff access request tasks. */
export const STAFF_TASKS = [
  'match_scheduling',
  'score_reporting',
  'announcements',
  'news',
  'coordination',
  'statistics',
  'other',
];

/** Membership / request statuses. */
export const MEMBERSHIP_STATUS = ['active', 'left', 'transferred_out'];
export const MEMBERSHIP_ROLES = ['captain', 'player'];
