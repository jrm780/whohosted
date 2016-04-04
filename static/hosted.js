
Twitch.init({clientId: '3jfmlnr9zm42l7k34aah95xgc7ugtyj'}, function(error, status) {
    if (error) {
        // error encountered while loading
        console.log(error);
    }
    
    if (!status.authenticated) {
        $('.twitch-connect').show();
    }
    else {
        var token = Twitch.getToken();
        $.get('https://api.twitch.tv/kraken', {oauth_token: token}, function(data) {
            connect(data.token.user_name, token);
        });
    }
});

$('.twitch-connect').click(function() {
    Twitch.login({
        redirect_uri: 'http://localhost:8888',
        scope: ['chat_login']
    });
});

var storageIndex = 0;
function getStoredHosts() {
    var records = [];
    var data = localStorage.getItem('table:hosts:' + storageIndex);
    while (data != null) {
        var record = JSON.parse(data);
        records.push(record);
        data = localStorage.getItem('table:hosts:' + storageIndex++);
    }
    return records;
}

function connect(nick, token) {
    var ws = new WebSocket('ws://irc-ws.chat.twitch.tv:80');
    var nick = nick;
    var auth = 'oauth:' + token;
    var channel = nick;

    ws.onopen = function open() {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
        ws.send('PASS ' + auth);
        ws.send('NICK ' + nick);
        ws.send('JOIN #' + channel);
    };

    ws.addEventListener('message', function(data) {
        console.log(data.data);
        
        if (data.data.lastIndexOf('PING', 0) === 0) {
            ws.send('PONG :tmi.twitch.tv');
            console.log('PONG Sent\r\n');
        }
        else {
            var m = parse(data.data);
            if (m.prefix && m.command == 'PRIVMSG') {
                var nick = m.prefix.split('!')[0];
                var tokens = m.params[1].split(' ');
                if (tokens.length >= 5 && tokens[3] == 'hosting') {
                    var host = tokens[0];
                    var viewers = (tokens.length > 5) ? tokens[6] : 0;
                    addRow([displayTime(), host, viewers]);
                }
            }
        }
    });
}

var table;
$(document).ready(function() {
    table = $('#records').DataTable( {
        paging: false,
        stateSave: true,
        searching: false,
        data: getStoredHosts(),
        language: {
            info: '_TOTAL_ hosts recorded',
            infoEmpty: '',
            emptyTable: 'No hosts recorded'
        },
        columns: [
            { title: "Date" },
            { title: "Host" },
            { title: "Viewers" }
        ]
    } );
} );

function addRow(data) {
    table.row.add(data).draw(false);
    localStorage.setItem('table:hosts:' + storageIndex, JSON.stringify(data));
    storageIndex++;
}

function displayTime() {
    var str = '';

    var currentTime = new Date();
    var h = currentTime.getHours();
    var m = currentTime.getMinutes();
    var s = currentTime.getSeconds();
    var day = currentTime.getDate();
    var month = currentTime.getMonth();
    var year = currentTime.getFullYear();

    h = h < 10 ? '0' + h : h;
    m = m < 10 ? '0' + m : m;
    s = s < 10 ? '0' + s : s;
    day = day < 10 ? '0' + day : day;
    month = month < 10 ? '0' + month : month;

    str += year + '/' + month + '/' + day + ' ' + h + ':' + m + ':' + s;
    return str;
}

var parse = function(data) {
    var message = {
        raw: data,
        tags: {},
        prefix: null,
        command: null,
        params: []
    }

    // position and nextspace are used by the parser as a reference.
    var position = 0
    var nextspace = 0

    // The first thing we check for is IRCv3.2 message tags.
    // http://ircv3.atheme.org/specification/message-tags-3.2

    if (data.charCodeAt(0) === 64) {
        var nextspace = data.indexOf(' ')

        if (nextspace === -1) {
            // Malformed IRC message.
            return null
        }

        // Tags are split by a semi colon.
        var rawTags = data.slice(1, nextspace).split(';')

        for (var i = 0; i < rawTags.length; i++) {
            // Tags delimited by an equals sign are key=value tags.
            // If there's no equals, we assign the tag a value of true.
            var tag = rawTags[i]
            var pair = tag.split('=')
            message.tags[pair[0]] = pair[1] || true
        }

        position = nextspace + 1
    }

    // Skip any trailing whitespace.
    while (data.charCodeAt(position) === 32) {
        position++
    }

    // Extract the message's prefix if present. Prefixes are prepended
    // with a colon.

    if (data.charCodeAt(position) === 58) {
        nextspace = data.indexOf(' ', position)

        // If there's nothing after the prefix, deem this message to be
        // malformed.
        if (nextspace === -1) {
            // Malformed IRC message.
            return null
        }

        message.prefix = data.slice(position + 1, nextspace)
        position = nextspace + 1

        // Skip any trailing whitespace.
        while (data.charCodeAt(position) === 32) {
            position++
        }
    }

    nextspace = data.indexOf(' ', position)

    // If there's no more whitespace left, extract everything from the
    // current position to the end of the string as the command.
    if (nextspace === -1) {
        if (data.length > position) {
            message.command = data.slice(position)
            return message
        }

        return null
    }

    // Else, the command is the current position up to the next space. After
    // that, we expect some parameters.
    message.command = data.slice(position, nextspace)

    position = nextspace + 1

    // Skip any trailing whitespace.
    while (data.charCodeAt(position) === 32) {
        position++
    }

    while (position < data.length) {
        nextspace = data.indexOf(' ', position)

        // If the character is a colon, we've got a trailing parameter.
        // At this point, there are no extra params, so we push everything
        // from after the colon to the end of the string, to the params array
        // and break out of the loop.
        if (data.charCodeAt(position) === 58) {
            message.params.push(data.slice(position + 1))
            break
        }

        // If we still have some whitespace...
        if (nextspace !== -1) {
            // Push whatever's between the current position and the next
            // space to the params array.
            message.params.push(data.slice(position, nextspace))
            position = nextspace + 1

            // Skip any trailing whitespace and continue looping.
            while (data.charCodeAt(position) === 32) {
                position++
            }

            continue
        }

        // If we don't have any more whitespace and the param isn't trailing,
        // push everything remaining to the params array.
        if (nextspace === -1) {
            message.params.push(data.slice(position))
            break
        }
    }
    return message
}