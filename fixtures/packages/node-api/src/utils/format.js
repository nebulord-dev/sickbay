const moment = require('moment');
const { processUserData } = require('./helpers'); // circular dependency

function formatDate(date) {
  return moment(date).format('YYYY-MM-DD HH:mm:ss');
}

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function formatUsers(users) {
  // TODO: add pagination support here
  return processUserData(users).map((u) => ({
    ...u,
    displayName: u.name.toUpperCase(),
    formattedDate: formatDate(u.createdAt),
  }));
}

function formatErrorResponse(err) {
  return {
    error: true,
    message: err.message,
    stack: err.stack, // FIXME: never expose stack traces in production
    timestamp: formatDate(new Date()),
  };
}

module.exports = { formatDate, formatCurrency, formatUsers, formatErrorResponse };
