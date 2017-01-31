var spawn = require('child_process').spawn;
var os = require('os');
var IpSubnetCalculator = require('ip-subnet-calculator');
var async = require('async');
var request = require('request');

var parseMACaddress = function(mac) {
    var bmac = []
    for (var i = 0; i < mac.split(":").length; i++) {
        var up = mac.split(":")[i].toUpperCase()
        bmac.push(((up.length < 2) ? 0 + up : up))
    }
    return bmac.join(":")
}


module.exports.availableInterfaces = function() {
    var ifaces = os.networkInterfaces();
    var validifaces = []
    for (var key in ifaces) {
        for (var i = 0; i < ifaces[key].length; i++) {
            if (ifaces[key][i]["internal"] == false && ifaces[key][i]["family"] == "IPv4") {
                validifaces.push(ifaces[key][i])
            }
        }
    }

    for (var i = 0; i < validifaces.length; i++) {
        var iface = validifaces[i]
        iface["net"] = IpSubnetCalculator.calculateCIDRPrefix(validifaces[i]["address"], validifaces[i]["netmask"])
        iface["net"]["validRange"] = []
        for (var i = iface["net"]["ipLow"] + 1; i <= iface["net"]["ipHigh"]; i++) {
            iface["net"]["validRange"].push(IpSubnetCalculator.toString(i))
        }
    }
    return validifaces
}


module.exports.aliveDevices = function(iface, cb) {
    var aliveIps = []

    async.each(iface["net"]["validRange"], function(ip, cb) {
        var ping = spawn("ping", ["-W", "1", "-c", "1", ip]);

        ping.on('close', function(code) {
            // if (code == 0 && ip != iface["address"] && ip != iface["net"]["ipHighStr"]) {
            if (code == 0 && ip != iface["net"]["ipHighStr"]) {
                var arp = spawn("arp", ["-n", ip]);
                var buffer = '';

                arp.stdout.on('data', function(data) {
                    buffer += data;
                });

                arp.on('close', function(code) {
                    var table = buffer.split('\n\r');
                    for (var l = 0; l < table.length; l++) {
                        if (table[l].indexOf(ip) > 0) {
                            var mac = parseMACaddress(table[l].split(" ")[3].replace(/-/g, ':'));

                            request('http://api.macvendors.com/' + mac, function(error, response, vendor) {
                                var v = null
                                if (!error && response.statusCode == 200) {
                                    v = vendor
                                }
                                aliveIps.push({
                                    "ip": ip,
                                    "mac": mac,
                                    "vendor": v
                                })
                                cb()

                            })
                        } else {
                            cb()
                        }
                    }
                })
            } else {
                cb()
            }
        })

    }, function(err) {
        cb(aliveIps);
    })
}
