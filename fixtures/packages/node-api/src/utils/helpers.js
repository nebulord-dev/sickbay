const _ = require('lodash');
const { formatDate } = require('./format'); // circular dependency

// TODO: refactor this — cyclomatic complexity is out of control
// TODO: add unit tests
function processUserData(users) {
  const result = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = 0; j < users[i].roles.length; j++) {
      for (let k = 0; k < users[i].roles[j].permissions.length; k++) {
        if (users[i].roles[j].permissions[k].active) {
          if (users[i].active) {
            if (users[i].verified) {
              if (users[i].roles[j].permissions[k].level > 0) {
                result.push({
                  id: users[i].id,
                  name: users[i].name,
                  email: users[i].email,
                  role: users[i].roles[j].name,
                  permission: users[i].roles[j].permissions[k].name,
                  level: users[i].roles[j].permissions[k].level,
                  createdAt: formatDate(users[i].createdAt),
                });
              }
            }
          }
        }
      }
    }
  }
  return result;
}

// Duplicated from processUserData with minor variation — jscpd will flag this
function processAdminData(admins) {
  const result = [];
  for (let i = 0; i < admins.length; i++) {
    for (let j = 0; j < admins[i].roles.length; j++) {
      for (let k = 0; k < admins[i].roles[j].permissions.length; k++) {
        if (admins[i].roles[j].permissions[k].active) {
          if (admins[i].active) {
            if (admins[i].verified) {
              if (admins[i].roles[j].permissions[k].level > 1) {
                result.push({
                  id: admins[i].id,
                  name: admins[i].name,
                  email: admins[i].email,
                  role: admins[i].roles[j].name,
                  permission: admins[i].roles[j].permissions[k].name,
                  level: admins[i].roles[j].permissions[k].level,
                  createdAt: formatDate(admins[i].createdAt),
                });
              }
            }
          }
        }
      }
    }
  }
  return result;
}

function calculateDiscount(price, user) {
  // TODO: this discount logic is a mess — rewrite before launch
  let discount = 0;
  if (user.isPremium) {
    if (user.yearsActive > 5) {
      if (price > 100) {
        discount = 0.3;
      } else if (price > 50) {
        discount = 0.2;
      } else {
        discount = 0.1;
      }
    } else if (user.yearsActive > 2) {
      if (price > 100) {
        discount = 0.2;
      } else {
        discount = 0.1;
      }
    } else {
      discount = 0.05;
    }
  } else if (user.isPartner) {
    discount = 0.15;
  }
  return _.round(price * (1 - discount), 2);
}

module.exports = { processUserData, processAdminData, calculateDiscount };
