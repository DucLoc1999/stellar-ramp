import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export async function errorHandler(app: FastifyInstance): Promise<void> {
  app.setErrorHandler(async (error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    app.log.error(error);

    const statusCode = error.statusCode ?? 500;
    const message = error.message ?? 'Internal server error';

    reply.status(statusCode).send({
      success: false,
      error: message,
    });
  });
}