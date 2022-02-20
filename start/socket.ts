import Ws from 'App/Services/Ws'
Ws.boot()
import Redis from '@ioc:Adonis/Addons/Redis'
import { DateTime } from 'luxon'
import { socketAuth } from '../app/utils/socket-auth/index'

//Listen for connections
Ws.io.on('connection', async(socket) => {
    //Getting data
    let socket_id_connected = socket.id
    let { user_id, username, token } = socket.handshake.auth

    //Trying to auth token
    let tokenId = await socketAuth.authenticateToken(token, user_id)

    //Check if everything good + destroy auth token
    if(!tokenId) {
        return
    }
    await socketAuth.destroyToken(tokenId, user_id) 

    //Setting the user as connected
    let response = await socketAuth.loginUser(socket_id_connected, user_id, username)
    if(!response) {
        return null
    }

    socket.on('message', async({ content, to }) => {
        let date = DateTime.now()
        if(await Redis.exists(to) === 1) {
            let persistedUser = await socketAuth.readUser(to)
            if(!persistedUser) {
                return 
            }
            let { socketId } = persistedUser
            socket.to(socketId).emit('message', { content: content, date: date })
        }
    })

    socket.on('disconnect', async() => {
        await socketAuth.destroyUser(user_id)
    })
})