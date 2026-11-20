/**
 * People.gs — who's who. Roles: Communications (admin), Designer, Pastor, Staff.
 */

function readPeople_() {
  return readTable_(TABLES.PEOPLE).filter(function (p) {
    return p.email && !/^(no|false|n)$/i.test(p.active);
  }).map(function (p) { p.email = lc_(p.email); return p; });
}

function personByEmail_(email, people) {
  email = lc_(email);
  for (var i = 0; i < people.length; i++) if (people[i].email === email) return people[i];
  return null;
}

function roleHolder_(role, people) {
  for (var i = 0; i < people.length; i++) if (lc_(people[i].role) === lc_(role)) return people[i];
  return null;
}

function currentUser_(people) {
  if (!CURRENT_SESSION_) throw new Error('SIGNIN: Please sign in.');
  var email = lc_(CURRENT_SESSION_.email);
  var p = personByEmail_(email, people || readPeople_());
  var role = p ? p.role : ROLES.STAFF;
  return {
    email: email,
    name: p ? p.name : '',
    ministry: p ? p.ministry : '',
    role: role,
    known: !!(p && p.name),
    isAdmin: lc_(role) === lc_(ROLES.ADMIN),
    isDesigner: lc_(role) === lc_(ROLES.DESIGNER),
    isPastor: lc_(role) === lc_(ROLES.PASTOR)
  };
}

/** Email for a template owner ('Comms', 'Designer', 'Pastor', 'Leader'). */
function ownerEmail_(owner, request, people) {
  if (owner === 'Leader') return lc_(request.requesterEmail);
  var holder = roleHolder_(OWNER_ROLE[owner] || owner, people);
  if (holder) return holder.email;
  var admin = roleHolder_(ROLES.ADMIN, people);
  return admin ? admin.email : '';
}

function nameOf_(email, people) {
  var p = personByEmail_(email, people);
  return p && p.name ? p.name : String(email || '');
}

function emailsWithRole_(role, people) {
  return people.filter(function (p) { return lc_(p.role) === lc_(role); }).map(function (p) { return p.email; });
}
