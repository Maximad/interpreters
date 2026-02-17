import '@fastify/jwt';
import type { MeiliSearch } from 'meilisearch';

type AppRole = 'CLIENT' | 'INTERPRETER' | 'ADMIN';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      sub: string;
      email: string;
      role: AppRole;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
    authorize: (roles: AppRole[]) => any;
    meiliClient: MeiliSearch;
    meiliIndexName: string;
  }
}
