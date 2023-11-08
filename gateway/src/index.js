import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import FileUploadDataSource from '@profusion/apollo-federation-upload';
import cors from 'cors';
import express from 'express';
import { expressjwt } from 'express-jwt';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';

const runServer = async () => {
  const port = 4000;
  const app = express();

  const server = new ApolloServer({
    gateway: new ApolloGateway({
      buildService: ({ url }) => new FileUploadDataSource.default({
        url,
        useChunkedTransfer: true,
        willSendRequest({ request, context }) {
          if (!request.http)
            request.http = { headers: Object.entries({
              user: context.user ? JSON.stringify(context.user) : undefined,
              'apollo-require-preflight': 'Hello world!',
            }) };
        }
      }),
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: [
          { name: "user", url: "http://localhost:4001/graphql" },
          { name: "post", url: "http://localhost:4002/graphql" },
        ]
      }),
    }),
    context: ({ req }) => {
      const user = req.auth || null;
      return { user };
    }
  });

  await server.start();

  app.use(
    '/graphql',
    cors(),
    express.json(),
    expressjwt({
      secret: "f1BtnWgD3VKY",
      algorithms: ["HS256"],
      credentialsRequired: false
    }),
    graphqlUploadExpress(),
    expressMiddleware(server)
  );

  app.listen({ port }, () =>
    console.log(`🚀  Server ready at http://localhost:${port}/graphql`)
  );
};

runServer().catch(error => {
  console.error('💥  Failed to start server:', error);
  process.exit(1);
});
