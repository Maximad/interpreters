import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';

type AppRole = 'CLIENT' | 'INTERPRETER' | 'ADMIN';

export default fp(async function authPlugin(fastify) {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED'
      ) {
        return reply.status(401).send({ message: 'Unauthorized' });
      }

      return reply.status(401).send({ message: 'Unauthorized' });
    }
  });

  fastify.decorate('authorize', (roles: AppRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;

      if (!roles.includes(request.user.role)) {
        return reply.status(403).send({ message: 'Forbidden' });
      }
    };
  });
});
