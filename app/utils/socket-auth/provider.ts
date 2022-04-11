import { cuid } from "@ioc:Adonis/Core/Helpers";
import { ProviderToken } from "./token";
import Redis from '@ioc:Adonis/Addons/Redis'
import { safeEqual } from "@ioc:Adonis/Core/Helpers";
import { ProviderUser } from "./user";


type PersistedToken = {
    tokenHash: string
}


export class TokenProvider {
    private parseToken(token: string | null): null | PersistedToken {
        try {
            if(!token) {
                return null
            }
            let tokenObject = JSON.parse(token)
            return tokenObject
        } catch(e) {
            return null
        }
    }

    public async writeToken(token: ProviderToken): Promise<string> {
        let tokenId = cuid()
        let payload = {
            tokenHash: token.tokenHash
        }
        let ttl = Math.ceil(token.expiresAt.diffNow('seconds').seconds)

        await Redis.setex(
            "sockets:" + tokenId + token.userId.toString(),
            ttl, 
            JSON.stringify(payload)
        )

        return tokenId
    }

    public async readToken(userId: number, tokenId: string, tokenCheckHash: string): Promise<any> {
        let tokenObject = this.parseToken(await Redis.get("sockets:" + tokenId + userId.toString()))
        if(!tokenObject) {
            return null
        }

        if(!safeEqual(tokenObject.tokenHash, tokenCheckHash)) {
            return null
        }

        return tokenId
    }

    public async destroyToken(tokenId: string, userId: number): Promise<void> {
        await Redis.del("sockets:" + tokenId + userId)
    }
}


type PersistedUser = {
    socketId: string, 
    username: string
}


export class UserProvider {
    private parseUser(user: string | null): null | PersistedUser {
        try {
            if(!user) {
                return null
            }
            let userObject = JSON.parse(user)
            return userObject
        } catch(e) {
            return null
        }
    }

    public async writeUser(user: ProviderUser) {
        let { username, userId, socketId } = user
        let payload = {
            username, 
            socketId
        }

        await Redis.set(
            userId.toString(),
            JSON.stringify(payload)
        )

        return true
    }

    public async readUser(userId: number): Promise<PersistedUser | null> {
        let userObject = this.parseUser(await Redis.get(userId.toString()))
        if(!userObject) {
            return null
        }
        return userObject
    }

    public async destroyUser(userId: number): Promise<void> {
        await Redis.del(userId.toString())
    }
}