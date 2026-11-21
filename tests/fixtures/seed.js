// Sample data for previews: created through the app's own API.
const ADMIN = 'admin@church.test', DESIGNER = 'designer@church.test', PASTOR = 'pastor@church.test', KARA = 'kara@church.test', KEN = 'ken@church.test';

module.exports = function seed(g) {
  const as = (email, fn) => { g.__setUser(email); return fn(); };
  const parent = g.__drive.folder('Comms parent');
  as(ADMIN, () => {
    g.__api('apiSaveSettings', { 'Master calendar ID': 'master@group.calendar.google.com', 'Drive parent folder': parent.getUrl() });
    g.__api('apiSavePerson', { email: ADMIN, name: 'Michael Cole', role: 'Communications', ministry: 'Communications' });
    g.__api('apiSavePerson', { email: DESIGNER, name: 'Jamie Designer', role: 'Designer', ministry: 'Communications' });
    g.__api('apiSavePerson', { email: PASTOR, name: 'Pat Pastor', role: 'Pastor', ministry: 'Pastoral / Staff' });
    g.__api('apiSavePerson', { email: KARA, name: 'Kara Kids', role: 'Staff', ministry: 'Calvary Kids' });
    g.__api('apiSavePerson', { email: KEN, name: 'Ken Students', role: 'Staff', ministry: 'Calvary Students' });
  });
  const promo = (o) => Object.assign({
    kind: 'Promoting an event or ministry (communications, plus design if needed)', 'promo.reach': '25-49%', 'promo.bridge': 'No',
    'promo.nextStepType': 'Sign up / register', 'promo.oneNextStep': 'Register in Church Center.', 'promo.story': 'A real story.',
    'promo.registration': 'Yes', 'promo.needsDesign': 'Yes', 'promo.designItems': ['Main graphic / key art', 'Social graphics']
  }, o);
  as(ADMIN, () => g.__api('apiSubmitRequest', promo({ ministry: 'Pastoral / Staff', 'promo.title': 'Christmas at Calvary', 'promo.whoFor': 'Level 1 - Whole church + community', 'promo.reach': '80%+', 'promo.bridge': 'Yes', 'promo.eventDate': '2026-12-23', 'promo.nextStepType': 'Attend' }), []));
  as(PASTOR, () => g.__api('apiSubmitRequest', { ministry: 'Pastoral / Staff', kind: 'Sermon series', 'series.title': 'A New Thing Coming', 'series.bigIdea': "God is doing a new thing and we're not going back.", 'series.scripture': 'Isaiah 43:16-19', 'series.eventDate': '2027-01-03', 'series.seriesWeeks': '5', 'series.oneNextStep': 'Be willing to step into something new.', 'series.designItems': ['Series key art / main graphic', 'Social graphics (feed, story, banner)'], 'series.nextStepType': 'Take a challenge / do something this week' }, []));
  as(KEN, () => g.__api('apiSubmitRequest', promo({ ministry: 'Calvary Students', 'promo.title': 'Winter Retreat', 'promo.whoFor': 'Level 3 - All NextGen (Calvary Kids, Calvary Students, Calvary Young Adults)', 'promo.eventDate': '2027-01-29' }), []));
  as(KARA, () => g.__api('apiSubmitRequest', { ministry: 'Calvary Kids', kind: 'Graphic design only (t-shirt, logo, flyer, etc. - no communications plan)', 'design.title': 'CK Movie Night graphic', 'design.whoFor': 'Kids age 2 through 6th grade and their parents', 'design.designItems': ['Social graphic', 'Slide / screen graphic'], 'design.eventDate': '2026-12-04', 'design.textFinal': 'Yes' }, []));
  as(KARA, () => g.__api('apiSubmitRequest', promo({ ministry: 'Calvary Kids', 'promo.title': 'Easter Egg Hunt', 'promo.whoFor': 'Level 1 - Whole church + community', 'promo.reach': '50-79%', 'promo.bridge': 'Yes', 'promo.eventDate': '2027-03-27' }), []));
  as(ADMIN, () => {
    g.__api('apiReview', 'REQ-2026-001', { action: 'approve', tier: 'Level 1' });
    g.__api('apiReview', 'REQ-2026-002', { action: 'approve', tier: 'Series' });
    g.__api('apiReview', 'REQ-2026-003', { action: 'approve', tier: 'Level 3' });
    g.__api('apiReview', 'REQ-2026-004', { action: 'approve', tier: 'Design' });
    g.__api('apiUploadFiles', 'REQ-2026-004', [{ name: 'draft.png', data: 'eA==' }], 'draft');
  });
  as(KARA, () => g.__api('apiDesignFeedback', 'REQ-2026-004', { kind: 'Adding or removing something', text: 'Please add the date (12/18) and "Calvary Kids Christmas Movie Night".' }, []));
  as(ADMIN, () => g.__api('apiUploadFiles', 'REQ-2026-004', [{ name: 'round1.png', data: 'eA==' }], 'draft'));
  return { ADMIN, DESIGNER, PASTOR, KARA, KEN };
};
