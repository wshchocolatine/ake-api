import { DateTime } from 'luxon';
import { base64 } from '@ioc:Adonis/Core/Helpers';

export class OpaqueToken {
    public tokenHash: string;

    public expiresAt: DateTime;

    constructor(public token: string, public tokenId: string, public userId: number) {}

    public toJSON() {
        return {
            token: `${base64.urlEncode(this.tokenId)}:${this.token}`,
            expiresAt: this.expiresAt,
        };
    }
}

export class ProviderToken {
    public expiresAt: DateTime;

    constructor(public tokenHash: string, public userId: number) {}
}
