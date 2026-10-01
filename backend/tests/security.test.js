process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/marketplace-test';
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-thirty-two-characters';
process.env.CLIENT_URL = 'http://localhost:5173';

const request = require('supertest');
const app = require('../src/app');
const pagination = require('../src/utils/pagination');

describe('Phase 12 input and origin protections', () => {
  test('health endpoint reports API status without needing a database connection', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.database).toBe('disconnected');
  });

  test('rejects cookie-authenticated writes from an untrusted origin', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'token=placeholder')
      .set('Origin', 'https://attacker.example')
      .expect(403);

    expect(response.body.message).toBe('Request origin is not allowed.');
  });

  test('allows cookie-authenticated writes from the configured app origin', async () => {
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'token=placeholder')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
  });

  test('rejects invalid registration data before attempting database access', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short', role: 'admin' })
      .expect(400);

    expect(response.body.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['name', 'email', 'password', 'role'])
    );
  });

  test('does not reflect the requested URL in 404 responses', async () => {
    const response = await request(app).get('/api/private-route?token=do-not-reflect').expect(404);
    expect(response.body.message).toBe('Route not found.');
    expect(JSON.stringify(response.body)).not.toContain('do-not-reflect');
  });

  test.each([
    ['/api/products?page=0', 'page'],
    ['/api/products?limit=51', 'limit'],
    ['/api/products?sort=unknown', 'sort'],
    ['/api/products?minRating=6', 'minRating'],
  ])('rejects invalid public product query %s before database access', async (path, field) => {
    const response = await request(app).get(path).expect(400);
    expect(response.body.message).toContain(field);
  });

  test('requires an authenticated buyer session to access the cart', async () => {
    const response = await request(app).get('/api/cart').expect(401);
    expect(response.body.message).toContain('not logged in');
  });
});

describe('pagination bounds', () => {
  test('uses safe defaults and accepts an in-range page', () => {
    expect(pagination({})).toEqual({ page: 1, limit: 20 });
    expect(pagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10 });
  });

  test.each([
    [{ page: '1e8' }, 'page'],
    [{ page: '10001' }, 'page'],
    [{ limit: '51' }, 'limit'],
    [{ limit: ['10', '20'] }, 'limit'],
  ])('rejects excessive or malformed pagination %p', (query, field) => {
    expect(() => pagination(query)).toThrow(`${field} must`);
  });
});
