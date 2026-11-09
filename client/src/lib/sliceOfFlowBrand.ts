// Approved public identity. The hero's proprietor plaque is decoration, not the only credit.
export const AUTHOR_NAME = 'Jeff Bourke';
export const AUTHOR_CREDENTIALS = 'MHA, PMP, SAFe RTE';
export const AUTHOR_LINKEDIN_URL = 'https://www.linkedin.com/in/jeffreybourke';
export const BUILT_BY = `Built by ${AUTHOR_NAME}, ${AUTHOR_CREDENTIALS}`;
export const HERO_IMAGE = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663079801262/cxzTZhjhGarRZAVw.webp';

export const ACCESS_SUMMARY = 'Free to play. No account required. No automatic game-results upload.';

export function getPrivacyDisclosure(analyticsConfigured: boolean): string {
  return 'Moves, scores, and results stay in this browser until you choose Share. Reloading resets game progress. Small browser-only storage flags remember the splash and tutorial. Hosting, Google Fonts, and image/CDN providers receive normal web requests and may keep request logs. ' + (analyticsConfigured
    ? 'Optional usage analytics is configured on this deployment.'
    : 'No usage analytics is configured on this deployment.');
}
