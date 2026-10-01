const AppError = require('./AppError');

function parsePositiveInteger(value, field, fallback, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new AppError(`${field} must be a positive whole number.`, 400);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new AppError(`${field} must be between 1 and ${maximum}.`, 400);
  }
  return parsed;
}

module.exports = function pagination(query, { defaultLimit = 20, maxLimit = 50, maxPage = 10000 } = {}) {
  return {
    page: parsePositiveInteger(query.page, 'page', 1, maxPage),
    limit: parsePositiveInteger(query.limit, 'limit', defaultLimit, maxLimit),
  };
};
