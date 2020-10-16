const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const request = require('request');
const fs = require('fs');

const config = require('./config.json');
const log = require('./logger');
// The account file name is requiered in parameter. Ex : node index.js example
const accountFilename = process.argv[2];
const accountFile = './accounts/' + accountFilename + '.json';
if (accountFilename == undefined || !fs.existsSync(accountFile)) {
    log.logError("Account filename is missing or file doesn't exist.", accountFilename);
    log.logError("Use the format 'node index.js account1' where file accounts/account1.json exists", accountFilename);
    process.exit(1);
}
const account = require(accountFile);

let client = new SteamUser();
let manager = new TradeOfferManager({
	"steam": client, // Polling every 30 seconds is fine since we get notifications from Steam
	"domain": "localhost", // Localhost
	"language": "en" // We want English item descriptions
});

// Steam logon options
let logOnOptions = {
	"accountName": account.username,
	"password": account.password,
	"twoFactorCode": SteamTotp.getAuthCode(account.steamSharedSecret)
};

if (fs.existsSync(account.username + '_polldata.json')) {
	manager.pollData = JSON.parse(fs.readFileSync(account.username + '_polldata.json').toString('utf8'));
}

function startMessage() {
    process.stdout.write('\033c');
    log.log("");
    log.logMagenta("\t\tSteam Gift Receiver");
    log.log("");
}
startMessage();

client.logOn(logOnOptions);

client.on('loggedOn', function() {
	log.logGreen("Logged into Steam as " + logOnOptions.accountName, accountFilename);
});

client.on('webSession', function(sessionID, cookies) {
	manager.setCookies(cookies, function(err) {
		if (err) {
            log.logError(err, accountFilename);
			process.exit(1); // Fatal error since we couldn't get our API key
		}

        log.log("API key: " + manager.apiKey, accountFilename);
        log.log("");
        //log.log(" Offer ID   | User ID64        | Item Name")
        log.log("------------------------------------------------------------------")
	});
});

// Test
client.on('disconnected', function(eresult, msg) {
    log.logError("Client disconnected : " + eresult + " " + msg, accountFilename);
});
client.on('loginKey', function(key) {
    log.logError("New loginKey : " + key, accountFilename);
});

// New trade offer received
manager.on('newOffer', function(offer) {
    // Check that it's a gift to us
    if (offer.itemsToGive.length == 0) {
        const itemNames = [];
        for (var key in offer.itemsToReceive) {
            itemNames.push(offer.itemsToReceive[key].market_hash_name);
        }
        var res = {};
        var id64 = offer.partner.getSteamID64();
        getUserLevel(id64, res).then(res => {
            if (config.checkLevel && res.level < config.minimumLevel) {
                log.logError("#" + offer.id + "  " + id64 + "  User level is " + res.level + ". Min req is " + config.minimumLevel, accountFilename);
                return;
            }
            getUserData(id64, res).then(res => {
                var profilAge = Math.floor((Date.now()/1000 - res.creationdate) / 86400);
                if (config.checkAccountCreationDate && profilAge < config.minimumDays) {
                    log.logError("#" + offer.id + "  " + id64 + "  Account created " + profilAge + " days ago. Min req is " + config.minimumDays, accountFilename);
                    return;
                }
                if (config.checkProfileSet && res.profileset != 1) {
                    log.logError("#" + offer.id + "  " + id64 + "  User don't have a Steam Community profile.", accountFilename);
                    return;
                }
                if (config.checkProfilePublic && res.visibility != 3) {
                    log.logError("#" + offer.id + "  " + id64 + "  User profile is not public.", accountFilename);
                    return;
                }
                getOwnedGameCount(id64, res).then(res => {
                    if (config.checkOwnedGame && res.gameCount < config.minimumGame) {
                        log.logError("#" + offer.id + "  " + id64 + "  " + res.gameCount + " non F2P games owned. Min req is " + config.minimumGame, accountFilename);
                        return;
                    }
                    offer.accept(function (err) {
                        if (!err) log.log("#" + offer.id + "  " + id64 + "  " + itemNames.join(', '), accountFilename);
                        else log.logError("Error accepting trade : " + err, accountFilename);
                    });
                });
            });
        });
    }
});

// Return Steam level for a given user id64
function getUserLevel(id64, res) {
    return new Promise((resolve, reject) => {
        if (!config.checkLevel) {
            resolve(res);
            return;
        }
        client.getSteamLevels([id64], function(err, usersLevel) {
            if (!err) res.level = usersLevel[id64];
            else log.logError(err, accountFilename);
            resolve(res);
        });
    });
}

// Checking user data
function getUserData(id64, res) {
    return new Promise((resolve, reject) => {
        if (!config.checkProfilePublic && !config.checkProfileSet && !config.checkAccountCreationDate) {
            resolve(res);
            return;
        }
        var url = "http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=" + manager.apiKey + "&steamids=" + id64;
        request(url, function (error, response, body) {
            if (response.statusCode == 200) {
                var user = JSON.parse(body).response.players[0];
                res.visibility = user.communityvisibilitystate; // 3 account is public, 1 not public (private or friends only)
                res.profileset = user.profilestate;   // 1 if user has a community profile
                res.creationdate = user.timecreated;  // Account creation date
            } else {
                log.logError("Error getting user data. Code=" + response.statusCode + ((error != null) ? " Error=" + error : ""), accountFilename);
            }
            resolve(res);
        });
    });
}

// Get the number of non F2P games owned by the user
function getOwnedGameCount(id64, res) {
    return new Promise((resolve, reject) => {
        if (!config.checkOwnedGame) {
            resolve(res);
            return;
        }
        var url = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=" + manager.apiKey + "&steamid=" + id64;
        request(url, function (error, response, body) {
            if (response.statusCode == 200) {
                res.gameCount = JSON.parse(body).response.game_count;   // Number of non F2P games owned
            } else {
                log.logError("Error getting user data. Code=" + response.statusCode + ((error != null) ? " Error=" + error : ""), accountFilename);
            }
            resolve(res);
        });
    });
}

manager.on('pollData', function(pollData) {
	fs.writeFileSync(account.username + '_polldata.json', JSON.stringify(pollData));
});