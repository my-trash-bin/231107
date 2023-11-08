import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { buildSubgraphSchema } from '@apollo/subgraph';
import cors from 'cors';
import express from 'express';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import gql from 'graphql-tag';

const posts = [
  { id: '1', authorId: 'admin', content: 'hello' },
  { id: '2', authorId: 'user', content: 'world' },
];

const typeDefs = gql`
  scalar Upload
  type Post @key(fields: "id") {
    id: ID!
    content: String!
    author: User!
  }
  extend type User @key(fields: "id") {
    id: ID! @external
    posts: [Post!]!
  }
  extend type Query {
    post(id: ID!): Post
    posts: [Post!]!
    myPosts: [Post!]
  }
`;

const resolvers = {
  User: {
    posts(parent) {
      return posts.filter(post => post.authorId === parent.id);
    }
  },
  Post: {
    __resolveReference(object) {
      return posts.find(post => post.id === object.id);
    },
    author(parent) {
      return { __typename: 'User', id: parent.authorId };
    }
  },
  Query: {
    post(_parent, { id }) {
      return posts.find(post => post.id === id);
    },
    posts() {
      return posts;
    },
    myPosts(_parent, _args, context) {
      if (!context.user)
        return null;
      return posts.filter(post => post.authorId === context.user.id);
    }
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
  const port = 4002;
  const app = express();

  const server = new ApolloServer({
    schema,
    plugins: [ApolloServerPluginLandingPageLocalDefault({ footer: false })],
  });

  await server.start();

  app.use(
    '/graphql',
    cors(),
    express.json(),
    graphqlUploadExpress(),
    expressMiddleware(server, {
      context: ({ req }) => {
        const user = req.headers.user ? JSON.parse(req.headers.user) : null;
        return { user };
      },
    })
  );

  app.listen({ port }, () =>
    console.log(`🚀  Server ready at http://localhost:${port}/graphql`)
  );
};

runServer().catch(error => {
  console.error('💥  Failed to start server:', error);
  process.exit(1);
});
