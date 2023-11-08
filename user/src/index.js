import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { buildSubgraphSchema } from '@apollo/subgraph';
import cors from 'cors';
import express from 'express';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import gql from 'graphql-tag';

const users = [
  { id: 'admin', name: 'admin' },
  { id: 'user', name: 'user' },
];

const typeDefs = gql`
  scalar Upload
  type User @key(fields: "id") {
    id: ID!
    name: String!
  }
  extend type Query {
    user(id: ID!): User
    users: [User!]!
  }
  extend type Mutation {
    fileSize(file: Upload!): Int!
  }
`;

const resolvers = {
  User: {
    __resolveReference(object) {
      return users.find(user => user.id === object.id);
    }
  },
  Query: {
    user(_parent, { id }) {
      return users.find(user => user.id === id);
    },
    users() {
      return users;
    },
  },
  Mutation: {
    fileSize(_parent, { file: { promise } }) {
      return (async () => {
        let file = await promise;
        if (file.promise)
        file = await file.promise;
        let size = 0;
        await new Promise((resolve) => {
          let readStream = file.createReadStream();
          readStream.on('data', (chunk) => {
            size += chunk.length;
          });
          readStream.on('end', resolve);
        });
        return size;
      })();
    }
  },
};

const schema = buildSubgraphSchema({ typeDefs, resolvers });

const runServer = async () => {
  const port = 4001;
  const app = express();

  const server = new ApolloServer({
    schema,
    context: ({ req }) => {
      const user = req.headers.user ? JSON.parse(req.headers.user) : null;
      return { user };
    },
    plugins: [ApolloServerPluginLandingPageLocalDefault({ footer: false })],
  });

  await server.start();

  app.use(
    '/graphql',
    cors(),
    express.json(),
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
