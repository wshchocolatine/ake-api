import Factory from '@ioc:Adonis/Lucid/Factory'
import crypto from 'crypto'
import User from 'App/Models/User'


export const UserFactory = Factory 
    .define(User, ({ faker }) => {

        let { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        })

        console.log(privateKey)

        return { 
            username: faker.internet.userName(), 
            tag: faker.datatype.number(1000), 
            email: faker.internet.email(), 
            password: 'secret', 
            description: faker.lorem.sentence(5), 
            private_key: privateKey, 
            public_key: publicKey
        }
    })
    .before('create', (_, model) => {
        console.log(model.private_key)
    })
    .build()


