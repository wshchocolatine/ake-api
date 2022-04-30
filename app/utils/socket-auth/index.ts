import { createHash } from 'crypto';
import { base64, string } from '@ioc:Adonis/Core/Helpers';
import { DateTime } from 'luxon';
import { OpaqueToken, ProviderToken } from './token';
import { TokenProvider, UserProvider } from './provider';
import { ProviderUser } from './user';

class SocketAuth {
    constructor(public providerToken: TokenProvider, public userProvider: UserProvider) {}

    private generateHash(token: string) {
        return createHash('sha256').update(token).digest('hex');
    }

    private generateToken(expiresIn: string) {
        const token = string.generateRandom(60);

        return {
            token,
            tokenHash: this.generateHash(token),
            expiresAt: this.getExpiresAt(expiresIn),
        };
    }

    private getExpiresAt(expiresIn: string) {
        if (!expiresIn) {
            return;
        }

        const milliseconds = string.toMs(expiresIn);
        return DateTime.local().plus({ milliseconds });
    }

    /**
     *
     * TOKEN
     *
     *
     **/

    public async loginToken(userId: number, expiresIn: string) {
        const { token, tokenHash, expiresAt } = this.generateToken(expiresIn);
        if (!expiresAt) {
            return null;
        }
        const providerToken = new ProviderToken(tokenHash, userId);
        providerToken.expiresAt = expiresAt;
        providerToken.tokenHash = tokenHash;

        const tokenId = await this.providerToken.writeToken(providerToken);

        const opaqueToken = new OpaqueToken(token, tokenId, userId);
        opaqueToken.expiresAt = expiresAt;

        return opaqueToken;
    }

    public async authenticateToken(token: string, userId: number) {
        try {
            if (!token) {
                return null;
            }

            const parts = token.split(':');

            const tokenId = base64.urlDecode(parts[0]);
            const value = parts[1];

            const response = await this.providerToken.readToken(userId, tokenId, this.generateHash(value));
            if (!response) {
                return null;
            }
            return tokenId;
        } catch (e) {
            return null;
        }
    }

    public async destroyToken(tokenId: string, userId: number) {
        await this.providerToken.destroyToken(tokenId, userId);
    }

    /**
     *
     * USER
     *
     */

    public async loginUser(socketId: string, userId: number, username: string) {
        const user = new ProviderUser(socketId, userId, username);
        const response = await this.userProvider.writeUser(user);
        if (response !== true) {
            return null;
        }
        return true;
    }

    public async readUser(userId: number) {
        const persistedUser = await this.userProvider.readUser(userId);
        if (!persistedUser) {
            return null;
        }
        return persistedUser;
    }

    public async destroyUser(userId: number) {
        await this.userProvider.destroyUser(userId);
    }
}

export const socketAuth = new SocketAuth(new TokenProvider(), new UserProvider());
