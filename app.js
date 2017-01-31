var _ = require('lodash');
var TelegramBot = require('node-telegram-bot-api');
var ns = require('./networkScanner.js');
const low = require('lowdb')
const db = low('db.json')

var netInterface = ns.availableInterfaces()[0]

var token = '327960093:AAGPU9yM9wwCEuKNVEhk8N55iCwHvdTpfQc';

var bot = new TelegramBot(token, {
    polling: true
});

bot.sendMessageMultiple = function(ids, msg) {
    ids.forEach(function(id) {
        bot.sendMessage(id, msg);
    })
}

bot.on('text', function(msg) {
    var chatId = msg.chat.id;
    console.log(msg);
    if (msg.text.toLowerCase() == '/help') {
        bot.sendMessage(chatId, 'Select an action:', {
            reply_markup: {
                keyboard: [
                    [{
                        text: '/check'
                    }, {
                        text: '/append'
                    }],
                    [{
                        text: '/join'
                    }],
                    [{
                        text: '/leave'
                    }]
                ],
                one_time_keyboard: false,
                resize_keyboard: false
            }
        })
    } else if (db.get('notificationChats').includes(chatId).value()) {
        if (msg.text.toLowerCase() == '/check') {
            bot.sendMessage(chatId, 'Processing your request, wait a moment...')
            ns.aliveDevices(netInterface, function(aliveDevices) {
                var s = ''
                for (var i = 0; i < aliveDevices.length; i++) {
                    var name = db.get('users').find(function(user) {
                        return _.includes(user.mac, aliveDevices[i].mac)
                    }).get('name').value() || 'Not identified';

                    s += '*' + name + '*:  ' +
                        aliveDevices[i].mac + ' -> ' +
                        aliveDevices[i].ip +
                        ((aliveDevices[i].vendor ? ' (_' + aliveDevices[i].vendor + '_): ' : ': ')) +
                        '\n'
                }
                bot.sendMessage(chatId, s, {
                    parse_mode: 'Markdown'
                })
            })
        } else if (msg.text.toLowerCase() == '/leave') {
            db.get('notificationChats').pull(chatId).value()
            bot.sendMessage(chatId, 'Successfully removed from notification list')

        } else if (msg.text.toLowerCase() == '/append') {
            ns.aliveDevices(netInterface, function(aliveDevices) {

                bot.on('callback_query', function handler(msg) {
                    console.log(msg); // msg.data refers to the callback_data
                    if (bot.answerCallbackQuery(msg.id)) {
                        bot.sendMessage(chatId, msg.data + ' ready for be added. Set a name for it.', {
                            reply_markup: {
                                force_reply: true
                            }
                        })
                    }
                    setTimeout(function() {
                        bot.removeListener('callback_query', handler)
                    }, 60000)
                });

                bot.sendMessage(chatId, 'Select an address to append:', {
                    reply_markup: {
                        inline_keyboard: _.difference(_.map(aliveDevices, 'mac'), db.get('users').map('mac').flatten().value()).map(function(newMAC) {
                            var vendor = _.find(aliveDevices,{"mac":newMAC}).vendor
                            return [{
                                text: newMAC + ((vendor ? ' (' + vendor + '): ' : '')),
                                callback_data: newMAC
                            }]
                        })
                    }
                })
            })
        } else if (msg.hasOwnProperty("reply_to_message")) {
            if (!db.get('users').find({
                    name: msg.text
                }).get('mac').push(msg.reply_to_message.text.split(" ")[0]).value()) {
                db.get('users').push({
                    "name": msg.text,
                    "mac": [msg.reply_to_message.text.split(" ")[0]],
                    "active": false
                }).value()
            }
        }
    } else {
        if (msg.text.toLowerCase() == '/join') {
            db.get('notificationChats').push(chatId).value()
            bot.sendMessage(chatId, 'Successfully added to notification list')

        }
    }
});

// db.get('users').forEach(function(user) {
//     user.active = false
// }).value()


setInterval(function() {
    ns.aliveDevices(netInterface, function(aliveDevices) {
        console.log('Checking network');

        db.get('users').filter({
            active: false
        }).filter(function(disconnectedUser) {
            if (_.difference(disconnectedUser.mac, _.map(aliveDevices, 'mac')).length != disconnectedUser.mac.length) {
                return true
            }
        }).forEach(function(discoveredUser) {
            _.assign(discoveredUser, {
                'active': true
            })
            bot.sendMessageMultiple(db.get('notificationChats').value(), '⚠️ ' + discoveredUser.name + ' has arrived! ⚠️');
        }).value()

        db.get('users').filter({
            active: true
        }).filter(function(disconnectedUser) {
            if (_.difference(disconnectedUser.mac, _.map(aliveDevices, 'mac')).length == disconnectedUser.mac.length) {
                return true
            }
        }).forEach(function(discoveredUser) {
            _.assign(discoveredUser, {
                'active': false
            })
            bot.sendMessageMultiple(db.get('notificationChats').value(), '⚠️ ' + discoveredUser.name + ' has left! ⚠️');
        }).value()

    });
}, 5000)



//
// var options = {
//     reply_markup: JSON.stringify({
//         inline_keyboard: [
//             [{
//                 text: 'Some button text 1',
//                 callback_data: '1'
//             }],
//             [{
//                 text: 'Some button text 2',
//                 callback_data: '2'
//             }],
//             [{
//                 text: 'Some button text 3',
//                 callback_data: '3'
//             }]
//         ]
//     })
// };
