/**
 * Forms.gs — reads your Google Forms and submits answers to them.
 *
 * Submitting through the real form means your existing onFormSubmit
 * automation runs exactly as if the person had used the form directly.
 */

function formIdFromUrl_(url) {
  var m = /\/forms\/d\/(?!e\/)([A-Za-z0-9_-]{20,})/.exec(String(url || ''));
  return m ? m[1] : '';
}

function openForm_(kind, config) {
  var key = FORM_CONFIG_KEYS[kind];
  var id = formIdFromUrl_(config[key]);
  if (!id) {
    throw new Error('Add the form\'s edit link (…/forms/d/…/edit) to the "' + key + '" row on the hub\'s Config tab.');
  }
  return FormApp.openById(id);
}

function navOf_(type, page) {
  var T = FormApp.PageNavigationType;
  if (type === T.SUBMIT) return { type: 'SUBMIT' };
  if (type === T.RESTART) return { type: 'RESTART' };
  if (type === T.GO_TO_PAGE && page) return { type: 'GO_TO_PAGE', page: String(page.getId()) };
  return { type: 'CONTINUE' };
}

/** Turns a Google Form into plain data the app can render and validate. */
function describeForm_(form) {
  var T = FormApp.ItemType;
  var sections = [{ pageId: '', title: form.getTitle(), help: form.getDescription(), items: [], after: { type: 'CONTINUE' } }];

  form.getItems().forEach(function (item) {
    var type = item.getType();
    var base = { id: String(item.getId()), title: item.getTitle(), help: item.getHelpText() };
    var cur = sections[sections.length - 1];

    if (type === T.PAGE_BREAK) {
      var pb = item.asPageBreakItem();
      // A page break's navigation applies to the section BEFORE it.
      cur.after = navOf_(pb.getPageNavigationType(), pb.getGoToPage());
      sections.push({ pageId: base.id, title: base.title, help: base.help, items: [], after: { type: 'CONTINUE' } });
      return;
    }

    var out = null;
    if (type === T.TEXT) {
      out = { kind: 'short', required: item.asTextItem().isRequired() };
    } else if (type === T.PARAGRAPH_TEXT) {
      out = { kind: 'paragraph', required: item.asParagraphTextItem().isRequired() };
    } else if (type === T.DATE) {
      out = { kind: 'date', required: item.asDateItem().isRequired() };
    } else if (type === T.MULTIPLE_CHOICE) {
      var mc = item.asMultipleChoiceItem();
      out = { kind: 'radio', required: mc.isRequired(), other: mc.hasOtherOption(), choices: mc.getChoices().map(choiceOf_) };
    } else if (type === T.LIST) {
      var li = item.asListItem();
      out = { kind: 'dropdown', required: li.isRequired(), choices: li.getChoices().map(choiceOf_) };
    } else if (type === T.CHECKBOX) {
      var cb = item.asCheckboxItem();
      out = { kind: 'checkbox', required: cb.isRequired(), other: cb.hasOtherOption(), choices: cb.getChoices().map(function (c) { return { value: c.getValue() }; }) };
    } else if (type === T.SECTION_HEADER) {
      out = { kind: 'header', required: false };
    }
    if (!out) return; // file uploads, grids, etc. are not used by these forms
    for (var k in out) base[k] = out[k];
    cur.items.push(base);
  });

  // Last section always ends the form.
  sections[sections.length - 1].after = { type: 'SUBMIT' };
  return { title: form.getTitle(), description: form.getDescription(), sections: sections };
}

function choiceOf_(c) {
  var nav;
  try { nav = navOf_(c.getPageNavigationType(), c.getGotoPage()); } catch (e) { nav = { type: 'CONTINUE' }; }
  return { value: c.getValue(), nav: nav };
}

/**
 * Validates answers against the form's branching and submits them.
 * answers: { itemId: string | string[] } — dates as 'YYYY-MM-DD'.
 */
function submitForm_(form, answers) {
  var desc = describeForm_(form);
  var path = visibleSections(desc.sections, answers);
  if (!path.complete) throw new Error('Please answer every question that decides what comes next.');

  var visibleIds = {};
  var missing = [];
  path.indexes.forEach(function (i) {
    desc.sections[i].items.forEach(function (it) {
      visibleIds[it.id] = it;
      var v = answers[it.id];
      var empty = v === undefined || v === null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '');
      if (it.required && empty) missing.push(it.title);
    });
  });
  if (missing.length) throw new Error('Please fill in: ' + missing.join('; '));

  var T = FormApp.ItemType;
  var response = form.createResponse();
  form.getItems().forEach(function (item) {
    var id = String(item.getId());
    var meta = visibleIds[id];
    var v = answers[id];
    if (!meta || v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
    var type = item.getType();
    var r = null;
    if (type === T.TEXT) r = item.asTextItem().createResponse(String(v).slice(0, 2000));
    else if (type === T.PARAGRAPH_TEXT) r = item.asParagraphTextItem().createResponse(String(v).slice(0, 20000));
    else if (type === T.DATE) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
      if (!m) throw new Error('"' + meta.title + '" needs a date.');
      r = item.asDateItem().createResponse(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    } else if (type === T.MULTIPLE_CHOICE) {
      r = item.asMultipleChoiceItem().createResponse(checkChoice_(meta, String(v)));
    } else if (type === T.LIST) {
      r = item.asListItem().createResponse(checkChoice_(meta, String(v)));
    } else if (type === T.CHECKBOX) {
      var list = (Array.isArray(v) ? v : [v]).map(function (x) { return checkChoice_(meta, String(x)); });
      r = item.asCheckboxItem().createResponse(list);
    }
    if (r) response.withItemResponse(r);
  });
  response.submit();
}

function checkChoice_(meta, value) {
  var ok = (meta.choices || []).some(function (c) { return c.value === value; });
  if (!ok && !meta.other) throw new Error('"' + value + '" is not an option for "' + meta.title + '".');
  return value;
}

/** Prefill values for the signed-in person. */
function prefillFor_(desc, ctx) {
  var out = {};
  desc.sections.forEach(function (s) {
    s.items.forEach(function (it) {
      PREFILL.forEach(function (p) {
        if (p.pattern.test(String(it.title).trim()) && ctx[p.from]) {
          out[it.id] = { value: ctx[p.from], lock: !!p.lock };
        }
      });
    });
  });
  return out;
}
