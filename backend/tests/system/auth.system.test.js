process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/marketplace-system-test';
process.env.JWT_SECRET = 'system-test-jwt-secret-at-least-thirty-two-characters';
process.env.CLIENT_URL = 'http://localhost:5173';

jest.mock('../../src/models/User', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
}));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const app = require('../../src/app');

describe('system: buyer authentication journey', () => {
  const users = new Map();

  beforeEach(() => {
    users.clear();
    jest.clearAllMocks();
    User.create.mockImplementation(async (input) => {
      const user = {
        _id: 'buyer-system-1',
        id: 'buyer-system-1',
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
        status: 'active',
      };
      users.set(user.id, user);
      return user;
    });
    User.findOne.mockImplementation((query) => ({ select: async () => [...users.values()].find((user) => user.email === query.email) || null }));
    User.findById.mockImplementation((id) => ({ select: async () => users.get(String(id)) || null }));
  });

  test('registers, authenticates, reads session, and logs out', async () => {
    const registration = await request(app)
      .post('/api/auth/register')
      .send({ name: '  Test Buyer ', email: 'BUYER@example.com', password: 'secure-password-123', role: 'buyer' })
      .expect(201);

    expect(registration.body.success).toBe(true);
    expect(registration.body.data.user).toMatchObject({ name: 'Test Buyer', email: 'buyer@example.com', role: 'buyer' });
    expect(registration.headers['set-cookie']?.[0]).toContain('token=');
    expect(registration.body.data.user.passwordHash).toBeUndefined();
    expect(await bcrypt.compare('secure-password-123', users.get('buyer-system-1').passwordHash)).toBe(true);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: ' BUYER@example.com ', password: 'secure-password-123' })
      .expect(200);
    const cookie = login.headers['set-cookie']?.[0].split(';')[0];
    expect(cookie).toContain('token=');

    const session = await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(session.body.data.user).toMatchObject({ id: 'buyer-system-1', role: 'buyer' });

    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    await request(app).get('/api/auth/me').expect(401);
  });

  test('rejects incorrect credentials without issuing a session cookie', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    users.set('buyer-system-1', {
      _id: 'buyer-system-1', id: 'buyer-system-1', name: 'Test Buyer', email: 'buyer@example.com',
      passwordHash, role: 'buyer', status: 'active',
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'buyer@example.com', password: 'wrong-password' })
      .expect(401);

    expect(response.body.message).toBe('Incorrect email or password.');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
