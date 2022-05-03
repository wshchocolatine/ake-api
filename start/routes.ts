/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| This file is dedicated for defining HTTP routes. A single file is enough
| for majority of projects, however you can define routes in different
| files and just make sure to import them inside this file. For example
|
| Define routes in following two files
| ├── start/routes/cart.ts
| ├── start/routes/customer.ts
|
| and then import them inside `start/routes.ts` as follows
|
| import './routes/cart'
| import './routes/customer'
|
*/

import Route from '@ioc:Adonis/Core/Route';

Route.post('register', 'AuthController.Register');
Route.post('login', 'AuthController.Login');
Route.get('logout', 'AuthController.Logout');
Route.get('/auth/sockets/token', 'AuthController.SocketToken').middleware('auth:api,web');

/**
 * Conversations routes
 */

Route.group(() => {
    Route.post('/conversations/new', 'ConversationsController.New');
    Route.get('/conversations/get/:offset?', 'ConversationsController.Get');
    Route.get('/conversations/search/:query?:offset?', 'ConversationsController.Search');
}).middleware('auth:api,web');

/**
 * User routes
 */

Route.group(() => {
    Route.get('/user/account/informations', 'UsersController.AccountInformations');
    Route.post('/user/description', 'UsersController.ChangeDescription');
    Route.post('/user/username', 'UsersController.ChangeUsername');
    /*     Route.post('/user/picture', 'UsersController.Store_Profile_Picture')
    Route.get('user/picture', 'UsersController.Get_Profile_Picture') */
}).middleware('auth:api,web');

/**
 *  Messages routes
 */

Route.group(() => {
    Route.post('/message/send', 'MessagesController.Send');
    Route.get('/message/get', 'MessagesController.Get');
    Route.get('/message/read/:msgId?', 'MessagesController.Read');
}).middleware('auth:api,web');

Route.get('/', () => {
    return "Hey!! Welcome to Ake's api. Hope you will enjoy the trip :)";
});
