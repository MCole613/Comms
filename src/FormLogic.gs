/**
 * FormLogic.gs — follows a Google Form's section branching.
 *
 * This one function runs on the server (to validate) AND is injected into the
 * browser (to show/hide sections as people answer), so both always agree.
 *
 * sections: [{ pageId, items: [{ id, kind, required, choices: [{ value, nav: {type, page} }] }],
 *              after: {type: 'CONTINUE'|'GO_TO_PAGE'|'SUBMIT'|'RESTART', page} }]
 * answers:  { itemId: string | string[] }
 *
 * Returns { indexes: [visible section indexes], complete: bool }.
 * "complete" is false while a branching question on the path is unanswered.
 */
function visibleSections(sections, answers) {
  var out = [];
  var i = 0;
  var guard = 0;
  while (i >= 0 && i < sections.length && guard++ < 100) {
    if (out.indexOf(i) >= 0) break;
    out.push(i);
    var sec = sections[i];
    var nav = sec.after || { type: 'CONTINUE' };
    var pending = false;
    for (var k = 0; k < sec.items.length; k++) {
      var item = sec.items[k];
      if (item.kind !== 'radio' && item.kind !== 'dropdown') continue;
      var branches = (item.choices || []).some(function (c) { return c.nav && c.nav.type !== 'CONTINUE'; });
      if (!branches) continue;
      var value = answers[item.id];
      var choice = null;
      for (var c = 0; c < item.choices.length; c++) {
        if (item.choices[c].value === value) choice = item.choices[c];
      }
      if (!choice) { pending = true; break; }
      if (choice.nav && choice.nav.type !== 'CONTINUE') nav = choice.nav;
    }
    if (pending) return { indexes: out, complete: false };
    if (nav.type === 'SUBMIT' || nav.type === 'RESTART') break;
    if (nav.type === 'GO_TO_PAGE') {
      var target = -1;
      for (var s = 0; s < sections.length; s++) if (sections[s].pageId === nav.page) target = s;
      i = target;
    } else {
      i = i + 1;
    }
  }
  return { indexes: out, complete: true };
}

if (typeof module !== 'undefined') module.exports = { visibleSections: visibleSections };
