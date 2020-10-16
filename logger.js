// Console color
const RESET = "\x1b[0m";
const BRIGHT = "\x1b[1m"
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";

module.exports = {
    logMagenta : function (s) {  log(MAGENTA + s + RESET); },
    logGreen : function (s) { log(GREEN + s + RESET); },
    logInfo : function (s) { log(YELLOW + s + RESET); },
    logYellow : function (s) { log(BRIGHT + YELLOW + s + RESET); },
    logError : function (s) { log(RED + s + RESET); },
    logCyan : function (s) { log(CYAN + s + RESET); },
    log : function (s) { log(s); }
};

// Logger dans la console avec timestamp
function log(s, name = undefined) {
    var d = new Date();
    console.log(formatInt(d.getHours(), 2) + ":" + 
                formatInt(d.getMinutes(), 2) + ":" + 
                formatInt(d.getSeconds(), 2) + "." + 
                formatInt(d.getMilliseconds(), 3) + " " +
                ((name != undefined) ? "| " + name + "\t| " : "") +
                s);
}

// Formatter d'entier pour rajouter des 0 (ex : 9 -> 09) où n est la taille totale
function formatInt(i, n) {
    return ("000000000000000" + i).slice(-n);
}