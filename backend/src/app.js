const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiters');
const csrfProtection = require('./middleware/csrfProtection');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const stripePayment = require('./controllers/payment.controller');

const app = express();

app.disable('x-powered-by');
if (env.trustProxy !== false) app.set('trust proxy', env.trustProxy);
app.use(helmet());
app.use(
  cors({
    origin: env.clientOrigin, // exact origin, never '*' when credentials are on
    credentials: true,
  })
);

if (env.nodeEnv !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'));

// Stripe signature verification needs the unparsed request bytes.
app.post('/api/payments/stripe/webhook', apiLimiter, express.raw({ type: 'application/json' }), stripePayment.webhook);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips $ and . operators from input (NoSQL injection)
app.use(hpp()); // HTTP parameter pollution

// Cookie-authenticated writes must originate from the configured browser app.
// The Stripe webhook is mounted above this middleware and uses signature auth.
app.use('/api', csrfProtection);
app.use('/api', apiLimiter);
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
