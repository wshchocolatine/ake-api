import Factory from '@ioc:Adonis/Lucid/Factory';
import { cuid } from '@ioc:Adonis/Core/Helpers'
import crypto from 'crypto';
import User from 'App/Models/User';
// import Conversation from 'App/Models/Conversation'
// import Key from 'App/Models/Key'
// import Participant from 'App/Models/Participant'
// import Message from 'App/Models/Message'
// import Message from 'App/Models/Message'

export const UserFactory = Factory.define(User, ({ faker }) => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return {
        id: cuid(),
        username: faker.internet.userName(),
        tag: faker.datatype.number(1000),
        email: faker.internet.email(),
        password: 'secret',
        description: faker.lorem.sentence(5),
        private_key: privateKey,
        public_key: publicKey,
    };
}).build();
