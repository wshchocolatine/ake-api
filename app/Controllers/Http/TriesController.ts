import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Redis from '@ioc:Adonis/Addons/Redis'

export default class TriesController {
    public async Redis({ response }: HttpContextContract) {
        await Redis.set('foo', 'bar')

        let g = await Redis.get('foo')

        return response.send(g)
    }
}
